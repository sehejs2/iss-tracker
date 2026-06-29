import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from './db';

// Runs every *.sql file in ../migrations in lexicographic order.
// Idempotent: each migration uses CREATE TABLE IF NOT EXISTS.
async function migrate(): Promise<void> {
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    await pool.query(sql);
  }

  console.log('All migrations complete.');
  await pool.end();
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
