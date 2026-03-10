const nodemailer = require('nodemailer');

const SITE_URL = process.env.SITE_URL || 'https://finlog.site';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendVerificationEmail(email, nickname, token) {
  const verifyUrl = `${SITE_URL}/api/auth/verify-email?token=${token}`;
  await transporter.sendMail({
    from: `"핀로그" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '[핀로그] 이메일 인증을 완료해주세요',
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="background:#4a7c59;padding:1.5rem;text-align:center;border-radius:12px 12px 0 0;">
          <h1 style="color:white;margin:0;font-size:1.3rem;">핀로그 이메일 인증</h1>
        </div>
        <div style="padding:2rem;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p style="font-size:1rem;color:#333;">안녕하세요, <strong>${nickname}</strong>님!</p>
          <p style="font-size:0.9rem;color:#666;line-height:1.6;">아래 버튼을 클릭하여 이메일 인증을 완료해주세요. 인증 후 커뮤니티에 참여할 수 있습니다.</p>
          <div style="text-align:center;margin:2rem 0;">
            <a href="${verifyUrl}" style="display:inline-block;padding:0.8rem 2rem;background:#4a7c59;color:white;text-decoration:none;border-radius:10px;font-weight:600;font-size:0.95rem;">이메일 인증하기</a>
          </div>
          <p style="font-size:0.75rem;color:#aaa;line-height:1.5;">이 링크는 24시간 동안 유효합니다. 본인이 요청하지 않은 경우 이 이메일을 무시해주세요.</p>
        </div>
      </div>
    `,
  });
}

async function sendPasswordResetEmail(email, nickname, token) {
  const resetUrl = `${SITE_URL}/reset-password/?token=${token}`;
  await transporter.sendMail({
    from: `"핀로그" <${process.env.SMTP_USER}>`,
    to: email,
    subject: '[핀로그] 비밀번호 재설정',
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="background:#4a7c59;padding:1.5rem;text-align:center;border-radius:12px 12px 0 0;">
          <h1 style="color:white;margin:0;font-size:1.3rem;">비밀번호 재설정</h1>
        </div>
        <div style="padding:2rem;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p style="font-size:1rem;color:#333;">안녕하세요, <strong>${nickname}</strong>님!</p>
          <p style="font-size:0.9rem;color:#666;line-height:1.6;">아래 버튼을 클릭하여 비밀번호를 재설정해주세요.</p>
          <div style="text-align:center;margin:2rem 0;">
            <a href="${resetUrl}" style="display:inline-block;padding:0.8rem 2rem;background:#4a7c59;color:white;text-decoration:none;border-radius:10px;font-weight:600;font-size:0.95rem;">비밀번호 재설정</a>
          </div>
          <p style="font-size:0.75rem;color:#aaa;line-height:1.5;">이 링크는 1시간 동안 유효합니다. 본인이 요청하지 않은 경우 이 이메일을 무시해주세요.</p>
        </div>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
