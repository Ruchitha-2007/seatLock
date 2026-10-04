import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runMigrations = async () => {
  const client = await pool.connect();
  try {
    console.log('🔄 Checking database migrations...');
    await client.query('BEGIN');

    // Create migrations tracker table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const { rows: appliedRows } = await client.query('SELECT filename FROM schema_migrations');
    const appliedFiles = new Set(appliedRows.map((r) => r.filename));

    for (const file of files) {
      if (!appliedFiles.has(file)) {
        console.log(`➡️  Applying migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        console.log(`✅ Applied migration: ${file}`);
      } else {
        console.log(`⏩ Skipping already applied migration: ${file}`);
      }
    }

    await client.query('COMMIT');
    console.log('✨ All migrations are up to date!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed and was rolled back:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Allow direct CLI execution: `node src/db/migrate.js`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
