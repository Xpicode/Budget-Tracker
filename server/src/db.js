import pg from 'pg';

pg.types.setTypeParser(1082, (v) => v); // date   -> '2026-10-12' (no time zone shift)
pg.types.setTypeParser(20, Number);     // bigint -> 15075 (not "15075")

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
