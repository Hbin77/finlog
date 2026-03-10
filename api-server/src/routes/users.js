const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');
const { query } = require('../db');

const router = express.Router();

// Get current user profile + stats
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userResult = await query(
      'SELECT id, provider, nickname, email, avatar_url, bio, email_verified, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    const user = userResult.rows[0];

    // Stats
    const postCount = await query('SELECT COUNT(*) as count FROM posts WHERE user_id = $1', [req.user.id]);
    const commentCount = await query('SELECT COUNT(*) as count FROM comments WHERE user_id = $1', [req.user.id]);

    user.post_count = parseInt(postCount.rows[0].count);
    user.comment_count = parseInt(commentCount.rows[0].count);

    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err.message);
    res.status(500).json({ error: '사용자 정보를 불러올 수 없습니다.' });
  }
});

// Get user's posts
router.get('/me/posts', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 10;
    const offset = (page - 1) * limit;

    const countResult = await query('SELECT COUNT(*) as count FROM posts WHERE user_id = $1', [req.user.id]);
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      'SELECT id, category, title, body, likes, created_at FROM posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.user.id, limit, offset]
    );

    res.json({ posts: result.rows, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Get user posts error:', err.message);
    res.status(500).json({ error: '게시글을 불러올 수 없습니다.' });
  }
});

// Get user's comments
router.get('/me/comments', requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 10;
    const offset = (page - 1) * limit;

    const countResult = await query('SELECT COUNT(*) as count FROM comments WHERE user_id = $1', [req.user.id]);
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT c.id, c.body, c.created_at, p.id as post_id, p.title as post_title
       FROM comments c JOIN posts p ON c.post_id = p.id
       WHERE c.user_id = $1 ORDER BY c.created_at DESC LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    res.json({ comments: result.rows, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('Get user comments error:', err.message);
    res.status(500).json({ error: '댓글을 불러올 수 없습니다.' });
  }
});

// Update profile
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { nickname, bio } = req.body;
    if (!nickname || nickname.length < 2 || nickname.length > 20) {
      return res.status(400).json({ error: '닉네임은 2~20자로 입력해주세요.' });
    }
    if (bio && bio.length > 200) {
      return res.status(400).json({ error: '소개는 200자 이내로 입력해주세요.' });
    }

    const result = await query(
      'UPDATE users SET nickname = $1, bio = $2 WHERE id = $3 RETURNING id, nickname, bio, avatar_url',
      [nickname.trim(), (bio || '').trim(), req.user.id]
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ error: '프로필 수정에 실패했습니다.' });
  }
});

// Change password (local users only)
router.put('/me/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    if (newPassword.length < 8) return res.status(400).json({ error: '새 비밀번호는 8자 이상이어야 합니다.' });

    const userResult = await query(
      "SELECT password_hash, provider FROM users WHERE id = $1",
      [req.user.id]
    );
    if (userResult.rows[0].provider !== 'local') {
      return res.status(400).json({ error: '소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.' });
    }

    const valid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);

    res.json({ success: true, message: '비밀번호가 변경되었습니다.' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ error: '비밀번호 변경에 실패했습니다.' });
  }
});

// Delete account
router.delete('/me', requireAuth, async (req, res) => {
  try {
    await query('DELETE FROM users WHERE id = $1', [req.user.id]);
    res.clearCookie('token', { path: '/' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err.message);
    res.status(500).json({ error: '계정 삭제에 실패했습니다.' });
  }
});

module.exports = router;
