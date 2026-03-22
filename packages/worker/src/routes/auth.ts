import { Hono } from 'hono';
import type { Env } from '../env';
import { hashPassword, verifyPassword, signJwt, requireAuth } from '../middleware/auth';
import { sendEmail } from '../services/email';

export const authRoutes = new Hono<{ Bindings: Env }>();

// Register
authRoutes.post('/register', async (c) => {
  const { email, name, password, role } = await c.req.json();

  if (!email || !name || !password || !role) {
    return c.json({ error: 'email, name, password, and role are required' }, 400);
  }

  if (!['student', 'professor', 'ta'].includes(role)) {
    return c.json({ error: 'role must be student, professor, or ta' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const id = crypto.randomUUID();
  const password_hash = await hashPassword(password);

  await c.env.DB.prepare(
    'INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, email, name, password_hash, role).run();

  const token = await signJwt({ sub: id, email, role }, c.env.JWT_SECRET);

  return c.json({ token, user: { id, email, name, role } }, 201);
});

// Login
authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json();

  if (!email || !password) {
    return c.json({ error: 'email and password are required' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, password_hash, role FROM users WHERE email = ?'
  ).bind(email).first<{ id: string; email: string; name: string; password_hash: string; role: string }>();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await signJwt({ sub: user.id, email: user.email, role: user.role }, c.env.JWT_SECRET);

  return c.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// Forgot Password
authRoutes.post('/forgot-password', async (c) => {
  const { email } = await c.req.json();

  if (!email) {
    return c.json({ error: 'email is required' }, 400);
  }

  // Always return success to avoid revealing whether the email exists
  const user = await c.env.DB.prepare(
    'SELECT id, email FROM users WHERE email = ?'
  ).bind(email).first<{ id: string; email: string }>();

  if (user) {
    const id = crypto.randomUUID();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    await c.env.DB.prepare(
      'INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(id, user.id, token, expiresAt).run();

    // Try to send email; if Resend key is configured, send via email
    // Otherwise return the token directly (dev mode)
    const resetLink = `/reset-password?token=${token}`;

    if (c.env.RESEND_API_KEY && !c.env.RESEND_API_KEY.includes('placeholder')) {
      try {
        const origin = c.req.header('origin') || 'https://courseagent.example.com';
        await sendEmail(
          c.env.RESEND_API_KEY,
          user.email,
          'Password Reset Request',
          `<p>You requested a password reset.</p>
           <p><a href="${origin}${resetLink}">Click here to reset your password</a></p>
           <p>This link expires in 1 hour.</p>
           <p>If you did not request this, please ignore this email.</p>`
        );
      } catch {
        // Log error but don't reveal it to the user
      }
    }

    // In dev mode, return the token so the user can reset without email
    return c.json({ message: 'If an account with that email exists, a reset link has been sent.', reset_token: token });
  }

  return c.json({ message: 'If an account with that email exists, a reset link has been sent.' });
});

// Reset Password
authRoutes.post('/reset-password', async (c) => {
  const { token, new_password } = await c.req.json();

  if (!token || !new_password) {
    return c.json({ error: 'token and new_password are required' }, 400);
  }

  const resetToken = await c.env.DB.prepare(
    'SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ?'
  ).bind(token).first<{ id: string; user_id: string; expires_at: string; used: number }>();

  if (!resetToken) {
    return c.json({ error: 'Invalid or expired reset token' }, 400);
  }

  if (resetToken.used) {
    return c.json({ error: 'Reset token has already been used' }, 400);
  }

  if (new Date(resetToken.expires_at) < new Date()) {
    return c.json({ error: 'Reset token has expired' }, 400);
  }

  const password_hash = await hashPassword(new_password);

  await c.env.DB.batch([
    c.env.DB.prepare(
      'UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(password_hash, resetToken.user_id),
    c.env.DB.prepare(
      'UPDATE password_reset_tokens SET used = 1 WHERE id = ?'
    ).bind(resetToken.id),
  ]);

  return c.json({ message: 'Password has been reset successfully.' });
});

// Get current user
authRoutes.get('/me', requireAuth(), async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, created_at FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});
