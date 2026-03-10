const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { query } = require('../db');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const SITE_URL = process.env.SITE_URL || 'https://finlog.site';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

function createToken(user) {
  return jwt.sign(
    { id: user.id, nickname: user.nickname, avatar_url: user.avatar_url },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function upsertUser(provider, providerId, email, nickname, avatarUrl) {
  const result = await query(
    `INSERT INTO users (provider, provider_id, email, nickname, avatar_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (provider, provider_id)
     DO UPDATE SET email = COALESCE($3, users.email),
                   nickname = COALESCE($4, users.nickname),
                   avatar_url = COALESCE($5, users.avatar_url)
     RETURNING id, nickname, avatar_url`,
    [provider, providerId, email, nickname, avatarUrl]
  );
  return result.rows[0];
}

// Google OAuth
router.get('/google', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${SITE_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Authorization code missing' });

    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${SITE_URL}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    });

    const { access_token } = tokenRes.data;
    const profileRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const profile = profileRes.data;
    const user = await upsertUser('google', profile.id, profile.email, profile.name, profile.picture);
    const token = createToken(user);

    res.cookie('token', token, COOKIE_OPTIONS);
    res.redirect(`${SITE_URL}/community`);
  } catch (err) {
    console.error('Google OAuth error:', err.message);
    res.redirect(`${SITE_URL}/community?error=auth_failed`);
  }
});

// Kakao OAuth
router.get('/kakao', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_CLIENT_ID,
    redirect_uri: `${SITE_URL}/api/auth/kakao/callback`,
    response_type: 'code',
  });
  res.redirect(`https://kauth.kakao.com/oauth/authorize?${params}`);
});

router.get('/kakao/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Authorization code missing' });

    const tokenRes = await axios.post('https://kauth.kakao.com/oauth/token', null, {
      params: {
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_CLIENT_ID,
        client_secret: process.env.KAKAO_CLIENT_SECRET,
        redirect_uri: `${SITE_URL}/api/auth/kakao/callback`,
        code,
      },
    });

    const { access_token } = tokenRes.data;
    const profileRes = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const profile = profileRes.data;
    const kakaoAccount = profile.kakao_account || {};
    const kakaoProfile = kakaoAccount.profile || {};

    const user = await upsertUser(
      'kakao',
      String(profile.id),
      kakaoAccount.email || null,
      kakaoProfile.nickname || `사용자${profile.id}`,
      kakaoProfile.profile_image_url || null
    );
    const token = createToken(user);

    res.cookie('token', token, COOKIE_OPTIONS);
    res.redirect(`${SITE_URL}/community`);
  } catch (err) {
    console.error('Kakao OAuth error:', err.message);
    res.redirect(`${SITE_URL}/community?error=auth_failed`);
  }
});

// Get current user
router.get('/me', optionalAuth, (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  res.json({ user: req.user });
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true });
});

module.exports = router;
