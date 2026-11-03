import { describe, test, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

const T0 = '2026-10-13T01:00:00.000Z';
const password = 'password123';

async function login(email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ email, password }).expect(201);
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  return agent;
}

const account = (id) => ({
  id, name: 'Cash', opening_balance_cents: 0, archived: false, created_at: T0, updated_at: T0, deleted_at: null, book: 'personal',
});
const txn = (id, account_id, amount_cents, updated_at = T0) => ({
  id, account_id, category_id: null, to_account_id: null, type: 'expense', amount_cents,
  txn_date: '2026-10-13', note: null, created_at: T0, updated_at, deleted_at: null, book: 'personal',
});

describe('sync', () => {
  let a;
  let b;
  const acc = crypto.randomUUID();
  const tx = crypto.randomUUID();

  beforeAll(async () => {
    a = await login(`a-${Date.now()}@test.com`);
    b = await login(`b-${Date.now()}@test.com`);
  });

  test('push then pull returns the same row', async () => {
    await a.post('/api/sync/push').send({ table: 'accounts', rows: [account(acc)] }).expect(200);
    await a.post('/api/sync/push').send({ table: 'transactions', rows: [txn(tx, acc, 15075)] }).expect(200);

    const { body } = await a.get('/api/sync/pull').expect(200);
    expect(body.rows.accounts).toEqual([account(acc)]);
    expect(body.rows.transactions).toEqual([txn(tx, acc, 15075)]); // bigint -> number, date -> 'YYYY-MM-DD'
    expect(body.cursor > T0).toBe(true);
  });

  test('an older updated_at does not overwrite a newer one', async () => {
    await a.post('/api/sync/push').send({ table: 'transactions', rows: [txn(tx, acc, 20000, '2026-10-13T02:00:00.000Z')] }).expect(200);
    await a.post('/api/sync/push').send({ table: 'transactions', rows: [txn(tx, acc, 1, '2026-10-13T00:30:00.000Z')] }).expect(200);

    const { body } = await a.get('/api/sync/pull');
    expect(body.rows.transactions[0].amount_cents).toBe(20000);
    expect(body.rows.transactions[0].updated_at).toBe('2026-10-13T02:00:00.000Z');
  });

  test('user B cannot read or overwrite user A rows, even with the right id', async () => {
    const before = await b.get('/api/sync/pull').expect(200);
    expect(before.body.rows.accounts).toEqual([]);
    expect(before.body.rows.transactions).toEqual([]);

    // Newer timestamp and the exact id: still ignored, because the row belongs to A.
    await b.post('/api/sync/push').send({ table: 'transactions', rows: [txn(tx, acc, 999999, '2026-10-13T09:00:00.000Z')] }).expect(200);

    const asA = await a.get('/api/sync/pull');
    expect(asA.body.rows.transactions[0].amount_cents).toBe(20000);
    const asB = await b.get('/api/sync/pull');
    expect(asB.body.rows.transactions).toEqual([]);
  });

  test('book round-trips, and a row without a book (older app) is stored as personal', async () => {
    const biz = crypto.randomUUID();
    const old = crypto.randomUUID();
    const { book: _, ...withoutBook } = txn(old, acc, 500);
    await a.post('/api/sync/push').send({ table: 'transactions', rows: [{ ...txn(biz, acc, 250000), book: 'business' }, withoutBook] }).expect(200);

    const { body } = await a.get('/api/sync/pull');
    const byId = Object.fromEntries(body.rows.transactions.map((t) => [t.id, t.book]));
    expect(byId[biz]).toBe('business');
    expect(byId[old]).toBe('personal');

    await a.post('/api/sync/push').send({ table: 'transactions', rows: [{ ...txn(biz, acc, 1), book: 'shop' }] }).expect(400);
  });

  test('a category keeps its book; one without a book (older app) is offered in both', async () => {
    const cat = (id, extra = {}) => ({ id, name: 'Stock', type: 'expense', created_at: T0, updated_at: T0, ...extra });
    const biz = crypto.randomUUID();
    const old = crypto.randomUUID();
    await a.post('/api/sync/push').send({ table: 'categories', rows: [cat(biz, { book: 'business' }), cat(old)] }).expect(200);

    const { body } = await a.get('/api/sync/pull');
    const byId = Object.fromEntries(body.rows.categories.map((c) => [c.id, c.book]));
    expect(byId).toMatchObject({ [biz]: 'business', [old]: 'both' });
  });

  test('an account keeps its book; one without a book (older app) is personal', async () => {
    const biz = crypto.randomUUID();
    const old = crypto.randomUUID();
    const { book: _, ...withoutBook } = account(old);
    await a.post('/api/sync/push').send({ table: 'accounts', rows: [{ ...account(biz), name: 'Business GCash', book: 'business' }, withoutBook] }).expect(200);

    const { body } = await a.get('/api/sync/pull');
    const byId = Object.fromEntries(body.rows.accounts.map((r) => [r.id, r.book]));
    expect(byId).toMatchObject({ [biz]: 'business', [old]: 'personal' });
  });

  test('push and pull without a cookie return 401', async () => {
    await request(app).post('/api/sync/push').send({ table: 'accounts', rows: [] }).expect(401);
    await request(app).get('/api/sync/pull').expect(401);
  });

  test('invalid rows and unknown tables are rejected with 400', async () => {
    const bad = await a.post('/api/sync/push').send({ table: 'transactions', rows: [txn(crypto.randomUUID(), acc, -5)] }).expect(400);
    expect(bad.body.fields[0].field).toBe('amount_cents');
    await a.post('/api/sync/push').send({ table: 'users', rows: [] }).expect(400);
  });

  test('pull since a future cursor returns nothing and keeps the cursor', async () => {
    const { body } = await a.get('/api/sync/pull?since=2030-01-01T00:00:00.000Z').expect(200);
    expect(Object.values(body.rows).every((rows) => rows.length === 0)).toBe(true);
    expect(body.cursor).toBe('2030-01-01T00:00:00.000Z');
  });
});
