import { readFileSync } from 'fs';
import { join } from 'path';
import { pool } from './client';

const MIGRATIONS = [
  '001_initial.sql',
  '002_add_region.sql',
  '003_add_accounts.sql',
  '004_autopost.sql',
];

export async function runMigrations(): Promise<void> {
  const dir = join(__dirname, 'migrations');
  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(dir, file), 'utf8');
    try {
      await pool.query(sql);
      console.log(`[DB] Migration ${file} applied`);
    } catch (err: any) {
      console.error(`[DB] Migration ${file} error: ${err.message}`);
      throw err;
    }
  }
}
