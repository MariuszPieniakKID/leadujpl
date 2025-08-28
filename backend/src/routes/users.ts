import { Router } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { requireAdmin, requireAuth, requireManagerOrAdmin } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, password, role, firstName, lastName, phone, street, city, postalCode, houseNumber, apartmentNumber, company, industry } = req.body as any;
    if (!email || !password || !role || !firstName || !lastName) return res.status(400).json({ error: 'Missing required fields' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, role: role as Role, firstName, lastName, phone, street, city, postalCode, houseNumber, apartmentNumber, company, industry },
    });
    res.status(201).json({ id: user.id });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.patch('/:id/role', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body as { role: Role };
    const user = await prisma.user.update({ where: { id }, data: { role } });
    res.json({ id: user.id, role: user.role });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
// List users (manager/admin)
router.get('/', requireAuth, requireManagerOrAdmin, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, firstName: true, lastName: true, email: true, role: true } });
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});


