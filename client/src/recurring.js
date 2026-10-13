import { v5 as uuidv5 } from 'uuid';
import { db } from './db';
import { save } from './repo';
import { today, addDays, addMonths } from './dates';

const NS = '7a1c9e52-4b3d-4f6e-8a2b-9c0d1e2f3a4b';
// ponytail: a daily rule left for years would create thousands of rows; stop here and continue next start.
const MAX_PER_RUN = 400;

const advance = (ymd, frequency) =>
  frequency === 'daily' ? addDays(ymd, 1) : frequency === 'weekly' ? addDays(ymd, 7) : addMonths(ymd, 1);

// Pure. Every run date from next_run_date up to `today` becomes a transaction; the id is derived
// from rule id + date, so two devices running the same rule offline produce the same row.
export function catchUp(rule, todayYmd) {
  const txns = [];
  let date = rule.next_run_date;
  while (date <= todayYmd && txns.length < MAX_PER_RUN) {
    txns.push({
      id: uuidv5(`${rule.id}:${date}`, NS),
      account_id: rule.account_id,
      category_id: rule.category_id,
      to_account_id: null,
      type: rule.type,
      amount_cents: rule.amount_cents,
      txn_date: date,
      note: rule.note ?? null,
    });
    date = advance(date, rule.frequency);
  }
  return { txns, next_run_date: date };
}

// App start: create what is due and move each rule's next_run_date into the future.
export const runRecurring = () =>
  db.transaction('rw', db.recurring_rules, db.transactions, async () => {
    const now = today();
    const due = await db.recurring_rules.where('next_run_date').belowOrEqual(now).filter((r) => !r.deleted_at).toArray();
    for (const rule of due) {
      const { txns, next_run_date } = catchUp(rule, now);
      for (const t of txns) {
        // Another device may already have made (and synced) this exact row; never overwrite it.
        if (!(await db.transactions.get(t.id))) await save('transactions', t);
      }
      await save('recurring_rules', { ...rule, next_run_date });
    }
  });
