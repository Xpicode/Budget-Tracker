import { test, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

const email = `auth-${Date.now()}@test.com`;
const password = 'password123';

test('register -> login -> me works; me without the cookie is 401', async () => {
  const agent = request.agent(app); // keeps the cookie between requests, like a browser
  const reg = await agent.post('/api/auth/register').send({ email: email.toUpperCase(), password }).expect(201);
  expect(reg.body).toEqual({ id: expect.any(String), email }); // lowercased, no hash in the response

  const login = await agent.post('/api/auth/login').send({ email, password }).expect(200);
  expect(login.headers['set-cookie'][0]).toMatch(/^token=.*HttpOnly.*SameSite=Strict/);

  const me = await agent.get('/api/auth/me').expect(200);
  expect(me.body).toEqual({ id: reg.body.id, email });

  await request(app).get('/api/auth/me').expect(401);
});

test('duplicate email is 409, wrong password is 401, bad input is 400', async () => {
  await request(app).post('/api/auth/register').send({ email, password }).expect(409);
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
