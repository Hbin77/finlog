const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query } = require('../db');
const { optionalAuth, requireAuth } = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../email');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const SITE_URL = process.env.SITE_URL || 'https://finlog.site';
const CF_TURNSTILE_SECRET = process.env.CF_TURNSTILE_SECRET || '';
const SMTP_CONFIGURED = !!(process.env.SMTP_USER && process.env.SMTP_PASS);
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
};

function createToken(user) {
  return jwt.sign(
    { id: user.id, nickname: user.nickname, avatar_url: user.avatar_url },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Cloudflare Turnstile verification
async function verifyTurnstile(token, ip) {
  if (!CF_TURNSTILE_SECRET) return true; // skip if not configured
  try {
    const res = await axios.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      secret: CF_TURNSTILE_SECRET,
      response: token,
      remoteip: ip,
    });
    return res.data.success === true;
  } catch {
    return false;
  }
}

async function upsertUser(provider, providerId, email, nickname, avatarUrl) {
  // Check if this provider+id already exists
  const existing = await query(
    'SELECT id, nickname, avatar_url FROM users WHERE provider = $1 AND provider_id = $2',
    [provider, providerId]
  );
  if (existing.rows.length > 0) {
    // Update existing social account
    await query(
      'UPDATE users SET email = COALESCE($1, email), nickname = COALESCE($2, nickname), avatar_url = COALESCE($3, avatar_url) WHERE provider = $4 AND provider_id = $5',
      [email, nickname, avatarUrl, provider, providerId]
    );
    return existing.rows[0];
  }

  // Check if same email exists with different provider → link to existing account
  if (email) {
    const sameEmail = await query(
      'SELECT id, nickname, avatar_url FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    if (sameEmail.rows.length > 0) {
      // Update existing account with this provider info (for future lookups, store in a note)
      // Also insert a new provider link row so future logins work
      try {
        await query(
          `INSERT INTO users (provider, provider_id, email, nickname, avatar_url, email_verified)
           VALUES ($1, $2, $3, $4, $5, TRUE)
           ON CONFLICT (provider, provider_id) DO NOTHING`,
          [provider, providerId, email, nickname, avatarUrl]
        );
      } catch (e) { /* ignore */ }
      // Return the original account
      return sameEmail.rows[0];
    }
  }

  // New user
  const result = await query(
    `INSERT INTO users (provider, provider_id, email, nickname, avatar_url, email_verified)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING id, nickname, avatar_url`,
    [provider, providerId, email, nickname, avatarUrl]
  );
  return result.rows[0];
}

// ===== Email/Password Signup =====
router.post('/signup', async (req, res) => {
  try {
    const { email, password, nickname, turnstileToken } = req.body;

    if (!email || !password || !nickname) {
      return res.status(400).json({ error: '이메일, 비밀번호, 닉네임을 모두 입력해주세요.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
    }
    if (nickname.length < 2 || nickname.length > 20) {
      return res.status(400).json({ error: '닉네임은 2~20자로 입력해주세요.' });
    }

    // Turnstile check
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const turnstileOk = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileOk) {
      return res.status(403).json({ error: '봇 인증에 실패했습니다. 다시 시도해주세요.' });
    }

    // Check existing email
    const existing = await query(
      "SELECT id FROM users WHERE email = $1 AND provider = 'local'",
      [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    const autoVerify = !SMTP_CONFIGURED; // SMTP 미설정 시 자동 인증

    const result = await query(
      `INSERT INTO users (provider, provider_id, email, password_hash, nickname, email_verified, verification_token, verification_expires)
       VALUES ('local', $1, $1, $2, $3, $4, $5, $6)
       RETURNING id, nickname, avatar_url`,
      [email, passwordHash, nickname, autoVerify, autoVerify ? null : verificationToken, autoVerify ? null : verificationExpires]
    );

    if (autoVerify) {
      // SMTP 미설정: 바로 로그인 처리
      const user = result.rows[0];
      const token = createToken(user);
      res.cookie('token', token, COOKIE_OPTIONS);
      return res.json({ success: true, autoLogin: true, message: '가입이 완료되었습니다!' });
    }

    // SMTP 설정됨: 인증 이메일 발송
    await sendVerificationEmail(email, nickname, verificationToken);
    res.json({ success: true, message: '가입 완료! 이메일을 확인하여 인증을 완료해주세요.' });
  } catch (err) {
    console.error('Signup error:', err.message);
    if (err.code === '23505') {
      return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
    }
    res.status(500).json({ error: '회원가입에 실패했습니다.' });
  }
});

// ===== Email Verification =====
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.redirect(`${SITE_URL}/?auth_error=invalid_token`);

    const result = await query(
      `UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_expires = NULL
       WHERE verification_token = $1 AND verification_expires > NOW()
       RETURNING id, nickname, avatar_url`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.redirect(`${SITE_URL}/?auth_error=expired_token`);
    }

    const user = result.rows[0];
    const jwtToken = createToken(user);
    res.cookie('token', jwtToken, COOKIE_OPTIONS);
    res.redirect(`${SITE_URL}/?auth_success=verified`);
  } catch (err) {
    console.error('Email verify error:', err.message);
    res.redirect(`${SITE_URL}/?auth_error=verify_failed`);
  }
});

// ===== Resend verification email =====
router.post('/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await query(
      "SELECT id, nickname, email_verified FROM users WHERE email = $1 AND provider = 'local'",
      [email]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: '가입되지 않은 이메일입니다.' });
    if (result.rows[0].email_verified) return res.json({ message: '이미 인증된 이메일입니다.' });

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await query(
      "UPDATE users SET verification_token = $1, verification_expires = $2 WHERE email = $3 AND provider = 'local'",
      [verificationToken, verificationExpires, email]
    );

    await sendVerificationEmail(email, result.rows[0].nickname, verificationToken);
    res.json({ success: true, message: '인증 이메일을 다시 보냈습니다.' });
  } catch (err) {
    console.error('Resend verify error:', err.message);
    res.status(500).json({ error: '이메일 발송에 실패했습니다.' });
  }
});

// ===== Email/Password Login =====
router.post('/login', async (req, res) => {
  try {
    const { email, password, turnstileToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    }

    // Turnstile check
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const turnstileOk = await verifyTurnstile(turnstileToken, ip);
    if (!turnstileOk) {
      return res.status(403).json({ error: '봇 인증에 실패했습니다.' });
    }

    const result = await query(
      "SELECT id, nickname, avatar_url, password_hash, email_verified FROM users WHERE email = $1 AND provider = 'local'",
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    if (!user.email_verified && SMTP_CONFIGURED) {
      return res.status(403).json({ error: '이메일 인증이 필요합니다. 이메일을 확인해주세요.', needVerify: true });
    }

    const token = createToken(user);
    res.cookie('token', token, COOKIE_OPTIONS);
    res.json({ success: true, user: { id: user.id, nickname: user.nickname, avatar_url: user.avatar_url } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: '로그인에 실패했습니다.' });
  }
});

// ===== Password Reset Request =====
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await query(
      "SELECT id, nickname FROM users WHERE email = $1 AND provider = 'local'",
      [email]
    );
    // Always respond success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({ success: true, message: '이메일이 전송되었습니다.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
    await query(
      "UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3",
      [resetToken, resetExpires, result.rows[0].id]
    );

    await sendPasswordResetEmail(email, result.rows[0].nickname, resetToken);
    res.json({ success: true, message: '비밀번호 재설정 이메일을 전송했습니다.' });
  } catch (err) {
    console.error('Forgot password error:', err.message);
    res.status(500).json({ error: '이메일 전송에 실패했습니다.' });
  }
});

// ===== Password Reset =====
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: '잘못된 요청입니다.' });
    if (password.length < 8) return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      `UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL
       WHERE reset_token = $2 AND reset_expires > NOW()
       RETURNING id, nickname, avatar_url`,
      [passwordHash, token]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ error: '유효하지 않거나 만료된 링크입니다.' });
    }

    res.json({ success: true, message: '비밀번호가 변경되었습니다.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ error: '비밀번호 변경에 실패했습니다.' });
  }
});

// ===== Google OAuth =====
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
    res.redirect(`${SITE_URL}/community/`);
  } catch (err) {
    console.error('Google OAuth error:', err.message);
    res.redirect(`${SITE_URL}/community/?error=auth_failed`);
  }
});

// ===== Kakao OAuth =====
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
    res.redirect(`${SITE_URL}/community/`);
  } catch (err) {
    console.error('Kakao OAuth error:', err.message);
    res.redirect(`${SITE_URL}/community/?error=auth_failed`);
  }
});

// ===== Get current user =====
router.get('/me', optionalAuth, async (req, res) => {
  if (!req.user) {
    return res.json({ user: null });
  }
  try {
    const result = await query(
      'SELECT id, provider, nickname, email, avatar_url, bio, email_verified, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.json({ user: null });
    res.json({ user: result.rows[0] });
  } catch {
    res.json({ user: req.user });
  }
});

// ===== Logout =====
router.post('/logout', (req, res) => {
  res.clearCookie('token', { path: '/' });
  res.json({ success: true });
});

module.exports = router;
