import fs from 'node:fs/promises';
import { pool } from './db.js';

const dir = new URL('../migrations/', import.meta.url);
await pool.query('create table if not exists migrations (name text primary key, applied_at timestamptz not null default now())');
const done = new Set((await pool.query('select name from migrations')).rows.map((r) => r.name));

for (const file of (await fs.readdir(dir)).filter((f) => f.endsWith('.sql')).sort()) {
    if (done.has(file)) continue;
    const client = await pool.connect();
    try {
        await client.query('begin');
        await client.query(await fs.readFile(new URL(file, dir), 'utf8'));
        await client.query('insert into migrations (name) values ($1)', [file]);
        await client.query('commit');
        console.log('applied', file);
    } catch (err) {
        await client.query('rollback');
        throw err;
    } finally {
        client.release();
    }
}
await pool.end();
