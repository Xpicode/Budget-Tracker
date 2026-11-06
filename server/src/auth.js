import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from './db.js';
import { createHash, randomBytes } from 'node:crypto';

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

const newPassword = z.string().min(8).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 UTF-8 bytes');

auth.post('/forgot-password', async (req, res) => {
  const { email } = z.object({ email: z.email().toLowerCase() }).parse(req.body);
  const reply = { message: 'If that account exists, a reset link has been sent. Check your inbox and spam folder.' };
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.APP_URL) {
    console.error('Password reset email configuration is missing');
    return res.status(503).json({ error: 'Email recovery is unavailable. Please contact the system owner.' });
  }
  const url = new URL('/reset-password', process.env.APP_URL);
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.hostname === 'localhost')) {
    return res.status(503).json({ error: 'Email recovery is unavailable. Please contact the system owner.' });
  }
  const token = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(token).digest('hex');
  const { rowCount } = await pool.query(
    `update users set password_reset_hash = $1, password_reset_expires_at = now() + interval '15 minutes',
      password_reset_requested_at = now()
      where email = $2 and (password_reset_requested_at is null or password_reset_requested_at < now() - interval '1 minute')`,
    [hash, email],
  );
  if (rowCount) {
    // Fragments are not sent to the web server or included in HTTP referrers.
    url.hash = new URLSearchParams({ token }).toString();
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM, to: [email], subject: 'Reset your Budget Tracker password',
          text: `Use this link to reset your Budget Tracker password:\n\n${url.href}\n\nThis link expires in 15 minutes and works once. If you did not request it, ignore this email.`,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Delivery failed');
    } catch {
      await pool.query('update users set password_reset_hash = null, password_reset_expires_at = null where email = $1 and password_reset_hash = $2', [email, hash]);
      // Do not log provider responses, tokens, addresses, or API credentials.
      console.error('Password reset email delivery failed; check Resend configuration');
    }
  }
  res.json(reply);
});

auth.post('/reset-password-email', async (req, res) => {
  const { token, password } = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: newPassword }).parse(req.body);
  const hash = createHash('sha256').update(token).digest('hex');
  const { rows } = await pool.query('select id from users where password_reset_hash = $1 and password_reset_expires_at > now()', [hash]);
  if (!rows.length) return res.status(400).json({ error: 'Reset link is invalid or expired. Request another email.' });
  const password_hash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `update users set password_hash = $1, password_reset_hash = null, password_reset_expires_at = null
      where id = $2 and password_reset_hash = $3 and password_reset_expires_at > now()`,
    [password_hash, rows[0].id, hash],
  );
  if (!result.rowCount) return res.status(400).json({ error: 'Reset link is invalid or expired. Request another email.' });
  res.json({ ok: true });
});

auth.post('/change-password', requireAuth, async (req, res) => {
  const { current_password, password } = z.object({ current_password: z.string().min(8), password: newPassword }).parse(req.body);
  const { rows } = await pool.query('select password_hash from users where id = $1', [req.userId]);
  if (!rows.length || !(await bcrypt.compare(current_password, rows[0].password_hash))) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const password_hash = await bcrypt.hash(password, 10);
  const result = await pool.query('update users set password_hash = $1, password_reset_hash = null, password_reset_expires_at = null where id = $2 and password_hash = $3', [password_hash, req.userId, rows[0].password_hash]);
  if (!result.rowCount) return res.status(409).json({ error: 'Password changed. Please try again.' });
  res.json({ ok: true });
});

auth.post('/register', async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const client = await pool.connect();
  try {
    await client.query('begin');
    // Serialize registrations so simultaneous requests cannot create extra accounts.
    await client.query('lock table users in share row exclusive mode');
    const existing = await client.query('select 1 from users limit 1');
    if (existing.rowCount) {
      await client.query('rollback');
      return res.status(403).json({ error: 'Registration is closed. Please log in with your existing account.' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const { rows } = await client.query(
      'insert into users (email, password_hash) values ($1, $2) returning id, email',
      [email, password_hash],
    );
    await client.query('commit');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
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
