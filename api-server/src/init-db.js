const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  try {
    await pool.query(schema);
    console.log('Database schema initialized');
  } catch (err) {
    console.error('Schema init warning:', err.message);
  }

  // Migration: add new columns to existing users table
  const migrations = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ",
    // Set existing OAuth users as verified
    "UPDATE users SET email_verified = TRUE WHERE provider != 'local' AND email_verified IS NULL",
    // Remove category CHECK constraint if exists (old schema had it)
    "ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_category_check",
  ];

  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      // ignore if column already exists or other non-critical errors
      if (!err.message.includes('already exists')) {
        console.error('Migration warning:', err.message);
      }
    }
  }

  // Create unique index for local email (ignore if exists)
  try {
    await pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_local ON users(email) WHERE provider = 'local'");
  } catch (err) {
    // ignore
  }

  console.log('Database migrations complete');
}

module.exports = initDb;
