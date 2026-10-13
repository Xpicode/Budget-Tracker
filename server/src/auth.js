import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from './db.js';

// One rule for both register and login. parse() throws a ZodError on bad input,
// which the central error handler in index.js turns into a 400.
const credentials = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(8),
});

const cookieOptions = {
  httpOnly: true,                                 // page JavaScript can't read it
  sameSite: 'strict',                             // only sent to our own site
  secure: process.env.NODE_ENV === 'production',  // HTTPS only once deployed
  maxAge: 30 * 24 * 60 * 60 * 1000,               // 30 days, in milliseconds
};

export const auth = Router();

auth.post('/register', async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const password_hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    'insert into users (email, password_hash) values ($1, $2) returning id, email',
    [email, password_hash],
  );
  res.status(201).json(rows[0]);
});

auth.post('/login', async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const { rows } = await pool.query(
    'select id, email, password_hash from users where email = $1',
    [email],
  );
  const user = rows[0];
  // Same message for unknown email and wrong password, so emails can't be probed.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, cookieOptions).json({ id: user.id, email: user.email });
});

auth.post('/logout', (req, res) => {
  res.clearCookie('token', cookieOptions).json({ ok: true });
});

// Verifies the cookie and sets req.userId. Routes must read the user from here only.
export function requireAuth(req, res, next) {
  try {
    req.userId = jwt.verify(req.cookies.token, process.env.JWT_SECRET).sub;
    next();
  } catch {
    res.status(401).json({ error: 'Not logged in' });
  }
}

auth.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query('select id, email from users where id = $1', [req.userId]);
  res.json(rows[0]);
});
