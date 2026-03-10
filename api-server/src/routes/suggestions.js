const express = require('express');
const { query } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Create suggestion
router.post('/', requireAuth, async (req, res) => {
  try {
    const { post_slug, post_id, original_text, suggested_text, reason } = req.body;

    if (!original_text || !suggested_text) {
      return res.status(400).json({ error: '원본 텍스트와 수정 제안 텍스트를 입력해주세요.' });
    }

    if (!post_slug && !post_id) {
      return res.status(400).json({ error: '게시글 정보가 필요합니다.' });
    }

    const result = await query(
      `INSERT INTO suggestions (post_slug, post_id, user_id, original_text, suggested_text, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [post_slug || null, post_id || null, req.user.id, original_text, suggested_text, reason || '']
    );

    res.status(201).json({ suggestion: result.rows[0] });
  } catch (err) {
    console.error('Create suggestion error:', err.message);
    res.status(500).json({ error: '수정 제안을 등록할 수 없습니다.' });
  }
});

// Get pending suggestions for current user's posts
router.get('/', requireAuth, async (req, res) => {
  try {
    // For blog posts (post_slug, no post_id): belong to user id=1
    // For community posts (post_id): belong to post author
    const result = await query(
      `SELECT s.*, u.nickname AS suggester_nickname
       FROM suggestions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN posts p ON s.post_id = p.id
       WHERE s.status = 'pending'
         AND (
           (s.post_id IS NULL AND $1 = 1)
           OR (s.post_id IS NOT NULL AND p.user_id = $1)
         )
       ORDER BY s.created_at DESC`,
      [req.user.id]
    );
    res.json({ suggestions: result.rows });
  } catch (err) {
    console.error('List suggestions error:', err.message);
    res.status(500).json({ error: '수정 제안을 불러올 수 없습니다.' });
  }
});

// Get approved suggestions count for a post
router.get('/post/:slug', optionalAuth, async (req, res) => {
  try {
    const { slug } = req.params;
    const result = await query(
      `SELECT COUNT(*)::int AS count FROM suggestions WHERE post_slug = $1 AND status = 'approved'`,
      [slug]
    );
    res.json({ count: result.rows[0].count });
  } catch (err) {
    console.error('Suggestion count error:', err.message);
    res.status(500).json({ error: '수정 제안 수를 불러올 수 없습니다.' });
  }
});

// Approve suggestion (post owner)
router.put('/:id/approve', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM suggestions WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: '수정 제안을 찾을 수 없습니다.' });

    const s = existing.rows[0];
    // Check ownership: blog post → user 1, community post → post author
    if (s.post_id) {
      const post = await query('SELECT user_id FROM posts WHERE id = $1', [s.post_id]);
      if (!post.rows.length || post.rows[0].user_id !== req.user.id) return res.status(403).json({ error: '권한이 없습니다.' });
    } else if (req.user.id !== 1) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    const result = await query(`UPDATE suggestions SET status = 'approved' WHERE id = $1 RETURNING *`, [id]);
    res.json({ suggestion: result.rows[0] });
  } catch (err) {
    console.error('Approve suggestion error:', err.message);
    res.status(500).json({ error: '수정 제안을 승인할 수 없습니다.' });
  }
});

// Reject suggestion (post owner)
router.put('/:id/reject', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM suggestions WHERE id = $1', [id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: '수정 제안을 찾을 수 없습니다.' });

    const s = existing.rows[0];
    if (s.post_id) {
      const post = await query('SELECT user_id FROM posts WHERE id = $1', [s.post_id]);
      if (!post.rows.length || post.rows[0].user_id !== req.user.id) return res.status(403).json({ error: '권한이 없습니다.' });
    } else if (req.user.id !== 1) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    const result = await query(`UPDATE suggestions SET status = 'rejected' WHERE id = $1 RETURNING *`, [id]);
    res.json({ suggestion: result.rows[0] });
  } catch (err) {
    console.error('Reject suggestion error:', err.message);
    res.status(500).json({ error: '수정 제안을 거절할 수 없습니다.' });
  }
});

// Delete suggestion (owner or admin)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT * FROM suggestions WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '수정 제안을 찾을 수 없습니다.' });
    }

    const suggestion = existing.rows[0];
    if (suggestion.user_id !== req.user.id && req.user.id !== 1) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    await query('DELETE FROM suggestions WHERE id = $1', [id]);
    res.json({ message: '수정 제안이 삭제되었습니다.' });
  } catch (err) {
    console.error('Delete suggestion error:', err.message);
    res.status(500).json({ error: '수정 제안을 삭제할 수 없습니다.' });
  }
});

module.exports = router;
