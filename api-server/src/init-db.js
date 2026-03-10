const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  try {
    await pool.query(schema);
    console.log('Database schema initialized');
  } catch (err) {
    console.error('Failed to initialize database schema:', err.message);
    throw err;
  }
}

module.exports = initDb;
