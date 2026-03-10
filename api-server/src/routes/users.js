const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { query } = require('../db');

const router = express.Router();

// Get current user profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, provider, nickname, email, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get user error:', err.message);
    res.status(500).json({ error: '사용자 정보를 불러올 수 없습니다.' });
  }
});

module.exports = router;
