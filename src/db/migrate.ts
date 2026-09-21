import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('🚀 Running database migrations...');
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await pool.query(sql);
    console.log(`✅ Applied: ${file}`);
  }
}

export async function runSeeds() {
  console.log('🌱 Running database seeds...');
  const seedsDir = path.join(__dirname, 'seeds');
  if (fs.existsSync(seedsDir)) {
    const files = fs.readdirSync(seedsDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      console.log(`Applying seed: ${file}`);
      const sql = fs.readFileSync(path.join(seedsDir, file), 'utf-8');
      await pool.query(sql);
      console.log(`✅ Seeded: ${file}`);
    }
  }
}

// Execute directly if run as CLI script
if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  (async () => {
    try {
      await runMigrations();
      await runSeeds();
      console.log('🎉 Migrations and seeds finished successfully!');
      process.exit(0);
    } catch (err) {
      console.error('❌ Migration failed:', err);
      process.exit(1);
    } finally {
      await pool.end();
    }
  })();
}
