const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'finlog',
  user: process.env.POSTGRES_USER || 'finlog',
  password: process.env.POSTGRES_PASSWORD || 'finlog123',
  port: 5432,
});

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query };
