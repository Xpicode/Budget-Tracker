import { test, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';
import { app } from '../src/app.js';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

test('email recovery hides account existence, throttles sends, expires and consumes tokens', async () => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('EMAIL_FROM', 'Budget <onboarding@resend.dev>');
  vi.stubEnv('APP_URL', 'https://budget.example.com');
  const send = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', send);
  const email = `email-${crypto.randomUUID()}@test.com`;
  await pool.query('insert into users (email, password_hash) values ($1, $2)', [email, await bcrypt.hash('original-password', 10)]);
  const missing = await request(app).post('/api/auth/forgot-password').send({ email: 'missing@example.com' }).expect(200);
  expect(send).not.toHaveBeenCalled();
  const sent = await request(app).post('/api/auth/forgot-password').send({ email }).expect(200);
  expect(sent.body).toEqual(missing.body);
  const body = JSON.parse(send.mock.calls[0][1].body);
  expect(body.to).toEqual([email]);
  const link = new URL(body.text.match(/https:\/\/\S+/)[0]);
  expect(link.origin).toBe('https://budget.example.com');
  const token = new URLSearchParams(link.hash.slice(1)).get('token');
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  const stored = await pool.query('select password_reset_hash from users where email = $1', [email]);
  expect(stored.rows[0].password_reset_hash === token).toBe(false);
  await request(app).post('/api/auth/forgot-password').send({ email }).expect(200);
  expect(send).toHaveBeenCalledTimes(1);
  const reset = () => request(app).post('/api/auth/reset-password-email').send({ token, password: 'replacement-password' });
  await pool.query("update users set password_reset_expires_at = now() - interval '1 second' where email = $1", [email]);
  await reset().expect(400);
  await pool.query("update users set password_reset_expires_at = now() + interval '1 minute' where email = $1", [email]);
  const results = await Promise.all([reset(), reset()]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  await reset().expect(400);
  await request(app).post('/api/auth/login').send({ email, password: 'original-password' }).expect(401);
  await request(app).post('/api/auth/login').send({ email, password: 'replacement-password' }).expect(200);
});

test('failed email delivery does not expose provider details or leave a usable token', async () => {
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('EMAIL_FROM', 'Budget <onboarding@resend.dev>');
  vi.stubEnv('APP_URL', 'https://budget.example.com');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  const email = `failure-${crypto.randomUUID()}@test.com`;
  await pool.query('insert into users (email, password_hash) values ($1, $2)', [email, 'unused']);
  const response = await request(app).post('/api/auth/forgot-password').send({ email }).expect(200);
  expect(response.body.message).toContain('If that account exists');
  const stored = await pool.query('select password_reset_hash from users where email = $1', [email]);
  expect(stored.rows[0].password_reset_hash).toBeNull();
});
