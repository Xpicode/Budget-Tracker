import { test, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';

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
