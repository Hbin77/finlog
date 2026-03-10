const express = require('express');
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// List comments for a post
router.get('/posts/:postId/comments', async (req, res) => {
  try {
    const { postId } = req.params;
    const result = await query(
      `SELECT c.*, u.nickname AS author_nickname, u.avatar_url AS author_avatar
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [postId]
    );
    res.json({ comments: result.rows });
  } catch (err) {
    console.error('List comments error:', err.message);
    res.status(500).json({ error: '댓글을 불러올 수 없습니다.' });
  }
});

// Add comment
router.post('/posts/:postId/comments', requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { body } = req.body;

    if (!body || body.trim().length === 0) {
      return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
    }

    // Check post exists
    const post = await query('SELECT id FROM posts WHERE id = $1', [postId]);
    if (post.rows.length === 0) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }

    const result = await query(
      `INSERT INTO comments (post_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [postId, req.user.id, body.trim()]
    );

    res.status(201).json({ comment: result.rows[0] });
  } catch (err) {
    console.error('Add comment error:', err.message);
    res.status(500).json({ error: '댓글을 작성할 수 없습니다.' });
  }
});

// Delete comment
router.delete('/comments/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT user_id FROM comments WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
    }
    if (existing.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }

    await query('DELETE FROM comments WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete comment error:', err.message);
    res.status(500).json({ error: '댓글을 삭제할 수 없습니다.' });
  }
});

module.exports = router;
