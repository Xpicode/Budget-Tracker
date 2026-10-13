import { Router } from 'express';
import { z } from 'zod';
import { pool } from './db.js';
import { requireAuth } from './auth.js';

// Fixed whitelist. Table names and column lists in the SQL below come from these schemas,
// never from the request. Every incoming row is validated against its schema first.
const base = {
  id: z.uuid(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  deleted_at: z.iso.datetime().nullish(),
};
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const SCHEMAS = {
  accounts: z.object({
    ...base,
    name: z.string().min(1),
    opening_balance_cents: z.number().int(),
    archived: z.boolean(),
  }),
  categories: z.object({
    ...base,
    name: z.string().min(1),
    type: z.enum(['income', 'expense']),
    icon: z.string().nullish(),
    color: z.string().nullish(),
  }),
  budgets: z.object({
    ...base,
    category_id: z.uuid(),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    limit_cents: z.number().int().positive(),
  }),
  recurring_rules: z.object({
    ...base,
    account_id: z.uuid(),
    category_id: z.uuid().nullish(),
    type: z.enum(['income', 'expense']),
    amount_cents: z.number().int().positive(),
    frequency: z.enum(['daily', 'weekly', 'monthly']),
    next_run_date: ymd,
    note: z.string().nullish(),
  }),
  transactions: z.object({
    ...base,
    account_id: z.uuid(),
    category_id: z.uuid().nullish(),
    to_account_id: z.uuid().nullish(),
    type: z.enum(['income', 'expense', 'transfer']),
    amount_cents: z.number().int().positive(),
    txn_date: ymd,
    note: z.string().nullish(),
  }),
};

const TABLES = Object.keys(SCHEMAS);
// Data columns per table: everything in the schema except id (id and user_id are bound separately).
const COLS = Object.fromEntries(TABLES.map((t) => [t, Object.keys(SCHEMAS[t].shape).filter((c) => c !== 'id')]));

// One upsert statement per table, built once. The `where` is the whole conflict rule:
// never touch another user's row, and an older edit is silently skipped (last write wins).
const UPSERT = Object.fromEntries(TABLES.map((t) => {
  const cols = COLS[t];
  return [t, `
    insert into ${t} (id, user_id, ${cols.join(', ')}, server_updated_at)
    values ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(', ')}, now())
    on conflict (id) do update set
      ${cols.map((c) => `${c} = excluded.${c}`).join(', ')},
      server_updated_at = now()
    where ${t}.user_id = excluded.user_id
      and ${t}.updated_at < excluded.updated_at`];
}));

const pushBody = z.object({
  table: z.enum(TABLES),
  rows: z.array(z.record(z.string(), z.unknown())).max(100),
});

export const sync = Router();
sync.use(requireAuth);

sync.post('/push', async (req, res) => {
  const { table, rows } = pushBody.parse(req.body);
  const schema = SCHEMAS[table];
  const cols = COLS[table];
  const client = await pool.connect();
  try {
    await client.query('begin'); // the whole batch lands or none of it does
    for (const raw of rows) {
      const row = schema.parse(raw);
      await client.query(UPSERT[table], [row.id, req.userId, ...cols.map((c) => row[c] ?? null)]);
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
  res.json({ ok: true });
});

sync.get('/pull', async (req, res) => {
  const since = z.iso.datetime().default('1970-01-01T00:00:00.000Z').parse(req.query.since);
  const rows = {};
  let cursor = new Date(since);
  for (const table of TABLES) {
    const cols = ['id', ...COLS[table], 'server_updated_at'].join(', ');
    // 5-second overlap: a row committed just before the last cursor is re-sent; re-applying is harmless.
    const result = await pool.query(
      `select ${cols} from ${table}
       where user_id = $1 and server_updated_at > $2::timestamptz - interval '5 seconds'
       order by server_updated_at`,
      [req.userId, since],
    );
    rows[table] = result.rows.map(({ server_updated_at, ...row }) => {
      if (server_updated_at > cursor) cursor = server_updated_at;
      return row;
    });
  }
  res.json({ rows, cursor: cursor.toISOString() });
});
