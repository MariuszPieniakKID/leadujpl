import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'dev_secret', {
      expiresIn: '7d',
    });
    return res.json({ token, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, managerId: user.managerId || null, termsAcceptedAt: (user as any).termsAcceptedAt || null } });
  } catch (e) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/accept-terms', async (req, res) => {
  try {
    const { userId } = req.body as { userId: string }
    if (!userId) return res.status(400).json({ error: 'Missing userId' })
    const updated = await prisma.user.update({ where: { id: userId }, data: { termsAcceptedAt: new Date() }, select: { id: true, termsAcceptedAt: true } })
    res.json(updated)
  } catch {
    res.status(500).json({ error: 'Failed to accept terms' })
  }
})

export default router;


