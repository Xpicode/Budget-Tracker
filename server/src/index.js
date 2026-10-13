import express from 'express';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { auth } from './auth.js';
import { sync } from './sync.js';

const app = express();
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});
app.use('/api/auth', auth);
app.use('/api/sync', sync);

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

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
