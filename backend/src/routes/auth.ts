import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth';
import { sendPasswordResetEmail } from '../lib/email';

const prisma = new PrismaClient();
const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    // Try selecting termsAcceptedAt if the column exists; fallback otherwise
    let user: any = null
    let hasTerms = false
    try {
      user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          passwordHash: true,
          role: true,
          managerId: true,
          termsAcceptedAt: true,
        },
      })
      hasTerms = true
    } catch {
      user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          passwordHash: true,
          role: true,
          managerId: true,
        },
      })
      hasTerms = false
    }
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'dev_secret', {
      expiresIn: '7d',
    });
    const termsAcceptedAt = hasTerms && user.termsAcceptedAt ? user.termsAcceptedAt : null
    return res.json({ token, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, managerId: user.managerId || null, termsAcceptedAt } });
  } catch (e) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/accept-terms', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id
    try {
      await prisma.user.update({ where: { id: userId }, data: { termsAcceptedAt: new Date() } } as any)
      return res.json({ ok: true })
    } catch (err) {
      // If the column doesn't exist yet in this environment, avoid blocking the user
      console.warn('accept-terms failed to persist, continuing:', (err as Error).message)
      return res.json({ ok: true, persisted: false })
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to accept terms' })
  }
})

// Verify that user still exists and is active
router.get('/verify', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id
    
    // Check if user exists in database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        managerId: true,
        termsAcceptedAt: true,
      },
    })
    
    if (!user) {
      // User was deleted - return 401 to force logout
      return res.status(401).json({ error: 'User no longer exists', deleted: true })
    }
    
    // User exists - return fresh user data
    return res.json({ 
      valid: true, 
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        managerId: user.managerId || null,
        termsAcceptedAt: user.termsAcceptedAt || null,
      }
    })
  } catch (e) {
    console.error('[Auth] Verify error:', e)
    return res.status(500).json({ error: 'Verification failed' })
  }
})

// Request password reset - send email with reset token
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body as { email: string };
    
    if (!email) {
      return res.status(400).json({ error: 'Email jest wymagany' });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true, firstName: true, lastName: true }
    });

    // Always return success to prevent email enumeration
    // But only send email if user exists
    if (user) {
      // Generate secure random token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save token to database
      await prisma.passwordReset.create({
        data: {
          email: user.email,
          token,
          expiresAt,
        },
      });

      // Send email
      try {
        await sendPasswordResetEmail(user.email, token, user.firstName);
        console.log(`[Auth] Password reset email sent to ${user.email}`);
      } catch (emailError) {
        console.error('[Auth] Failed to send reset email:', emailError);
        // Don't fail the request if email fails - token is still valid
      }
    } else {
      console.log(`[Auth] Password reset requested for non-existent email: ${email}`);
    }

    // Always return success
    return res.json({ 
      success: true, 
      message: 'Jeśli podany email istnieje w systemie, wysłaliśmy na niego link do resetu hasła.' 
    });
  } catch (e) {
    console.error('[Auth] Forgot password error:', e);
    return res.status(500).json({ error: 'Nie udało się wysłać emaila z resetem hasła' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body as { token: string; newPassword: string };

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token i nowe hasło są wymagane' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Hasło musi mieć minimum 6 znaków' });
    }

    // Find valid token
    const resetToken = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return res.status(400).json({ error: 'Nieprawidłowy link resetowania hasła' });
    }

    if (resetToken.used) {
      return res.status(400).json({ error: 'Ten link został już wykorzystany' });
    }

    if (resetToken.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Link resetowania hasła wygasł. Poproś o nowy.' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
    });

    if (!user) {
      return res.status(404).json({ error: 'Użytkownik nie został znaleziony' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordReset.update({
        where: { token },
        data: { used: true },
      }),
    ]);

    console.log(`[Auth] Password reset successful for ${user.email}`);

    return res.json({ 
      success: true, 
      message: 'Hasło zostało zmienione. Możesz się teraz zalogować.' 
    });
  } catch (e) {
    console.error('[Auth] Reset password error:', e);
    return res.status(500).json({ error: 'Nie udało się zresetować hasła' });
  }
});

// Verify reset token (check if valid before showing reset form)
router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const resetToken = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return res.status(400).json({ valid: false, error: 'Nieprawidłowy link' });
    }

    if (resetToken.used) {
      return res.status(400).json({ valid: false, error: 'Link został już wykorzystany' });
    }

    if (resetToken.expiresAt < new Date()) {
      return res.status(400).json({ valid: false, error: 'Link wygasł' });
    }

    return res.json({ valid: true, email: resetToken.email });
  } catch (e) {
    console.error('[Auth] Verify token error:', e);
    return res.status(500).json({ valid: false, error: 'Błąd weryfikacji' });
  }
});

export default router;


