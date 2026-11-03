import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { auth } from './auth.js';
import { sync } from './sync.js';

// The app without listen(), so tests can drive it with Supertest.
export const app = express();
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});
app.use('/api/auth', auth);
app.use('/api/sync', sync);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// Production: serve the built React app; any other path gets index.html so client routes work on reload.
if (process.env.NODE_ENV === 'production') {
  const dist = fileURLToPath(new URL('../../client/dist', import.meta.url));
  app.use(express.static(dist));
  app.get(/.*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Central error handler. Express 5 sends rejected promises from async routes here automatically.
app.use((err, req, res, next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      fields: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Email already registered' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});
