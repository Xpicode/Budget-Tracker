import pg from 'pg';
import { mainUrl, testUrl } from './env.js';

// Runs once before all test files: make sure budget_test exists, is migrated, and is empty.
export default async function setup() {
  const admin = new pg.Client({ connectionString: mainUrl });
  await admin.connect();
  const { rowCount } = await admin.query("select 1 from pg_database where datname = 'budget_test'");
  if (!rowCount) await admin.query('create database budget_test');
  await admin.end();

  process.env.DATABASE_URL = testUrl(mainUrl);
  await import('../src/migrate.js'); // applies migrations/*.sql to budget_test

  const test = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await test.connect();
  await test.query('truncate users cascade');
  await test.end();
}
