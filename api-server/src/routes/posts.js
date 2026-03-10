const express = require('express');
const { query } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = ['saving', 'investing', 'tax', 'frugal', 'tools', 'general'];

// List posts
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const { category } = req.query;

    let where = '';
    const params = [];

    if (category && VALID_CATEGORIES.includes(category)) {
      where = 'WHERE p.category = $1';
      params.push(category);
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM posts p ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const postsResult = await query(
      `SELECT p.id, p.category, p.title, p.likes, p.created_at, p.updated_at,
              u.id AS author_id, u.nickname AS author_nickname, u.avatar_url AS author_avatar,
              (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
       FROM posts p
       JOIN users u ON p.user_id = u.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      posts: postsResult.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('List posts error:', err.message);
    res.status(500).json({ error: '게시글 목록을 불러올 수 없습니다.' });
  }
});

// Get single post
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const postResult = await query(
      `SELECT p.*, u.id AS author_id, u.nickname AS author_nickname, u.avatar_url AS author_avatar
       FROM posts p
       JOIN users u ON p.user_id = u.id
       WHERE p.id = $1`,
      [id]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }

    const commentsResult = await query(
      `SELECT c.*, u.nickname AS author_nickname, u.avatar_url AS author_avatar
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.post_id = $1
       ORDER BY c.created_at ASC`,
      [id]
    );

    res.json({
      post: postResult.rows[0],
      comments: commentsResult.rows,
    });
  } catch (err) {
    console.error('Get post error:', err.message);
    res.status(500).json({ error: '게시글을 불러올 수 없습니다.' });
  }
});

// Create post
router.post('/', requireAuth, async (req, res) => {
  try {
    const { category, title, body } = req.body;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: '유효하지 않은 카테고리입니다.' });
    }
    if (!title || title.trim().length === 0 || title.length > 200) {
      return res.status(400).json({ error: '제목은 1~200자 이내로 입력해주세요.' });
    }
    if (!body || body.trim().length === 0) {
      return res.status(400).json({ error: '내용을 입력해주세요.' });
    }

    const result = await query(
      `INSERT INTO posts (user_id, category, title, body)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.id, category, title.trim(), body.trim()]
    );

    res.status(201).json({ post: result.rows[0] });
  } catch (err) {
    console.error('Create post error:', err.message);
    res.status(500).json({ error: '게시글을 작성할 수 없습니다.' });
  }
});

// Update post
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { category, title, body } = req.body;

    const existing = await query('SELECT user_id FROM posts WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }
    if (existing.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: '수정 권한이 없습니다.' });
    }

    if (category && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: '유효하지 않은 카테고리입니다.' });
    }
    if (title !== undefined && (title.trim().length === 0 || title.length > 200)) {
      return res.status(400).json({ error: '제목은 1~200자 이내로 입력해주세요.' });
    }

    const result = await query(
      `UPDATE posts
       SET category = COALESCE($1, category),
           title = COALESCE($2, title),
           body = COALESCE($3, body),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [category || null, title?.trim() || null, body?.trim() || null, id]
    );

    res.json({ post: result.rows[0] });
  } catch (err) {
    console.error('Update post error:', err.message);
    res.status(500).json({ error: '게시글을 수정할 수 없습니다.' });
  }
});

// Delete post
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT user_id FROM posts WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }
    if (existing.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: '삭제 권한이 없습니다.' });
    }

    await query('DELETE FROM posts WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete post error:', err.message);
    res.status(500).json({ error: '게시글을 삭제할 수 없습니다.' });
  }
});

module.exports = router;
