import { test, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';
import { resetPassword, generateRecoveryCode } from '../src/reset-password.js';

const email = `auth-${Date.now()}@test.com`;
const password = 'password123';

beforeAll(async () => {
  // Other test files may have already created users in the isolated test database.
  await pool.query('truncate users cascade');
});

test('simultaneous first sign-ups create only one account; login and me still work', async () => {
  const registrations = await Promise.all([
    request(app).post('/api/auth/register').send({ email: email.toUpperCase(), password }),
    request(app).post('/api/auth/register').send({ email: email.toUpperCase(), password }),
  ]);
  expect(registrations.map((r) => r.status).sort()).toEqual([201, 403]);
  const reg = registrations.find((r) => r.status === 201);
  expect(reg.body).toEqual({ id: expect.any(String), email });
  const { rows } = await pool.query('select count(*) as count from users');
  expect(rows[0].count).toBe(1);
  const agent = request.agent(app); // keeps the cookie between requests, like a browser

  const login = await agent.post('/api/auth/login').send({ email, password }).expect(200);
  expect(login.headers['set-cookie'][0]).toMatch(/^token=.*HttpOnly.*SameSite=Strict/);

  const me = await agent.get('/api/auth/me').expect(200);
  expect(me.body).toEqual({ id: reg.body.id, email });

  await request(app).get('/api/auth/me').expect(401);
});

test('registration closes for both new and existing emails after the first account', async () => {
  for (const address of [email, `stranger-${Date.now()}@test.com`]) {
    const closed = await request(app).post('/api/auth/register').send({ email: address, password }).expect(403);
    expect(closed.body).toEqual({ error: 'Registration is closed. Please log in with your existing account.' });
  }
  const { rows } = await pool.query('select count(*) as count from users');
  expect(rows[0].count).toBe(1);
});

test('wrong password is 401 and bad input is 400', async () => {
  const wrong = await request(app).post('/api/auth/login').send({ email, password: 'wrongpass1' }).expect(401);
  expect(wrong.body).toEqual({ error: 'Invalid email or password' });
  const bad = await request(app).post('/api/auth/register').send({ email: 'nope', password: 'short' }).expect(400);
  expect(bad.body.fields.map((f) => f.field)).toEqual(['email', 'password']);
});

test('logout clears the cookie', async () => {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password }).expect(200);
  await agent.post('/api/auth/logout').expect(200);
  await agent.get('/api/auth/me').expect(401);
});

test('reset rejects invalid credentials and unknown accounts without changing the password', async () => {
  const before = await pool.query('select password_hash from users where email = $1', [email]);
  for (const [address, value] of [[email, 'short'], ['invalid', password], [email, 'a'.repeat(73)], [email, '\u00e9'.repeat(37)]]) {
    await expect(resetPassword(address, value)).rejects.toThrow();
  }
  await expect(resetPassword('missing@test.com', password)).rejects.toThrow('Account not found');
  const after = await pool.query('select password_hash from users where email = $1', [email]);
  expect(after.rows[0].password_hash === before.rows[0].password_hash).toBe(true);
});

test('owner reset replaces the password while preserving the user and budget data', async () => {
  const before = await pool.query('select id, email, created_at from users where email = $1', [email]);
  const user = before.rows[0];
  const id = crypto.randomUUID();
  await pool.query(
    'insert into accounts (id, user_id, name, opening_balance_cents, created_at, updated_at) values ($1, $2, $3, $4, now(), now())',
    [id, user.id, 'Cash', 15075],
  );
  const accountBefore = await pool.query('select * from accounts where id = $1', [id]);
  const nextPassword = 'replacement-password123';
  await resetPassword(email.toUpperCase(), nextPassword);
  await request(app).post('/api/auth/login').send({ email, password }).expect(401);
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: nextPassword }).expect(200);
  const me = await agent.get('/api/auth/me').expect(200);
  expect(me.body).toEqual({ id: user.id, email });
  const after = await pool.query('select id, email, created_at from users where email = $1', [email]);
  expect(after.rows).toEqual(before.rows);
  const accountAfter = await pool.query('select * from accounts where id = $1', [id]);
  expect(accountAfter.rows).toEqual(accountBefore.rows);
});

test('Settings password changes require authentication and the current password', async () => {
  const next = 'settings-password123';
  await request(app).post('/api/auth/change-password').send({ current_password: 'replacement-password123', password: next }).expect(401);
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: 'replacement-password123' }).expect(200);
  await agent.post('/api/auth/change-password').send({ current_password: 'incorrect-password', password: next }).expect(401);
  await agent.post('/api/auth/change-password').send({ current_password: 'replacement-password123', password: 'short' }).expect(400);
  await agent.post('/api/auth/change-password').send({ current_password: 'replacement-password123', password: next }).expect(200);
  await request(app).post('/api/auth/login').send({ email, password: 'replacement-password123' }).expect(401);
  await request(app).post('/api/auth/login').send({ email, password: next }).expect(200);
});

test('recovery codes are hashed, rotated, bound to email, and consumed exactly once', async () => {
  const old = await generateRecoveryCode(email);
  const code = await generateRecoveryCode(email.toUpperCase());
  expect(code).toMatch(/^[a-f0-9]{64}$/);
  const stored = await pool.query('select recovery_code_hash from users where email = $1', [email]);
  expect(stored.rows[0].recovery_code_hash === code).toBe(false);
  const reset = (address, recovery_code, password = 'recovered-password123') => request(app).post('/api/auth/reset-password').send({ email: address, recovery_code, password });
  const invalid = await reset(email, old).expect(400);
  const missing = await reset('missing@test.com', code).expect(400);
  expect(invalid.body).toEqual(missing.body);
  await reset(email, code, 'short').expect(400);
  const results = await Promise.all([reset(email, code), reset(email, code)]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  await reset(email, code).expect(400);
  await request(app).post('/api/auth/login').send({ email, password: 'settings-password123' }).expect(401);
  await request(app).post('/api/auth/login').send({ email, password: 'recovered-password123' }).expect(200);
  const after = await pool.query('select recovery_code_hash from users where email = $1', [email]);
  expect(after.rows[0].recovery_code_hash).toBeNull();
});
