import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    // Select only columns that certainly exist even if some migrations aren't applied yet
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
        role: true,
        managerId: true,
        // DO NOT select termsAcceptedAt to avoid selecting a non-existent column in older DBs
      },
    });
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'dev_secret', {
      expiresIn: '7d',
    });
    return res.json({ token, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, managerId: user.managerId || null, termsAcceptedAt: null } });
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

export default router;


