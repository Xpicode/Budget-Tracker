import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from './db.js';

const credentials = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(8).refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
});

// This is deliberately not exposed through an HTTP endpoint.
export async function resetPassword(email, password) {
  const input = credentials.parse({ email, password });
  const password_hash = await bcrypt.hash(input.password, 10);
  const { rowCount } = await pool.query(
    'update users set password_hash = $1 where email = $2',
    [password_hash, input.email],
  );
  if (rowCount !== 1) throw new Error('Account not found');
}

export async function generateRecoveryCode(email) {
  email = z.email().toLowerCase().parse(email);
  const code = randomBytes(32).toString('hex');
  const hash = createHash('sha256').update(code).digest('hex');
  const { rowCount } = await pool.query('update users set recovery_code_hash = $1 where email = $2', [hash, email]);
  if (rowCount !== 1) throw new Error('Account not found');
  return code;
}

async function main() {
  let rl;
  try {
    const recovery = process.argv.length === 3 && process.argv[2] === '--recovery-code';
    if (!process.stdin.isTTY || !process.stdout.isTTY || (process.argv.length !== 2 && !recovery)) {
      throw new Error('Interactive terminal required');
    }
    if (!process.env.DATABASE_URL) throw new Error('Database connection required');
    let hidden = false;
    const output = new Writable({
      write(chunk, encoding, callback) {
        if (!hidden) process.stdout.write(chunk, encoding);
        callback();
      },
    });
    rl = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
    const controller = new AbortController();
    rl.on('SIGINT', () => controller.abort());
    const ask = (prompt) => rl.question(prompt, { signal: controller.signal });
    const secret = async (prompt) => {
      process.stdout.write(prompt);
      hidden = true;
      try {
        return await ask('');
      } finally {
        hidden = false;
        process.stdout.write('\n');
      }
    };

    console.log('Owner password reset. Uses the database configured in DATABASE_URL.');
    console.log('Existing sessions remain signed in. Budget data will not be changed.');
    const email = (await ask('Account email: ')).trim();
    if (recovery) {
      if (await ask('Type GENERATE to replace any existing recovery code: ') !== 'GENERATE') return;
      const code = await generateRecoveryCode(email);
      // Intentional one-time delivery to the owner's interactive terminal, never a server log.
      process.stdout.write(`Recovery code (keep in your password manager): ${code}\n`);
      console.log('This code can be used once. Generate another after using it.');
      return;
    }
    const password = await secret('New password (8+ characters, at most 72 UTF-8 bytes): ');
    const confirmation = await secret('Confirm new password: ');
    if (password !== confirmation) throw new Error('Passwords do not match');
    credentials.parse({ email, password });
    if (await ask('Type RESET to change this account password: ') !== 'RESET') {
      console.log('Cancelled. Password unchanged.');
      return;
    }
    await resetPassword(email, password);
    console.log('Password reset. Log in with your new password.');
  } catch {
    // Never print errors that might include credentials or database connection details.
    console.error('Reset failed. Check the account email, matching valid passwords, and database access. Use an interactive terminal with no command arguments.');
    process.exitCode = 1;
  } finally {
    rl?.close();
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
