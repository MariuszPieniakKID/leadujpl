import { Router } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { requireAdmin, requireAuth, requireManagerOrAdmin } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

// Authenticated user: get my profile
router.get('/me', requireAuth, async (req, res) => {
  try {
    const id = req.user!.id
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        street: true,
        city: true,
        postalCode: true,
        houseNumber: true,
        apartmentNumber: true,
        company: true,
        industry: true,
        role: true,
      },
    })
    if (!user) return res.status(404).json({ error: 'Not found' })
    res.json(user)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

// Authenticated user: update my profile
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const id = req.user!.id
    const { firstName, lastName, phone, street, city, postalCode, houseNumber, apartmentNumber, company, industry } = req.body as any
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(street !== undefined ? { street } : {}),
        ...(city !== undefined ? { city } : {}),
        ...(postalCode !== undefined ? { postalCode } : {}),
        ...(houseNumber !== undefined ? { houseNumber } : {}),
        ...(apartmentNumber !== undefined ? { apartmentNumber } : {}),
        ...(company !== undefined ? { company } : {}),
        ...(industry !== undefined ? { industry } : {}),
      },
      select: { id: true },
    })
    res.json({ id: user.id, ok: true })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

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

// Manager creates a sales rep and auto-assigns to themselves
router.post('/create-sales', requireAuth, requireAdmin, async (req, res) => {
  try {
    const current = req.user!
    // Only ADMIN can create sales reps
    if (current.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' })
    const { email, password, firstName, lastName, phone } = req.body as { email: string; password?: string; firstName: string; lastName: string; phone?: string }
    if (!email || !firstName || !lastName) return res.status(400).json({ error: 'Missing required fields' })
    const pwd = password && password.trim() ? password : 'test123'
    const passwordHash = await bcrypt.hash(pwd, 10)
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'SALES_REP',
        firstName,
        lastName,
        phone,
        // Created by ADMIN without assignment; can be assigned later
        managerId: null,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, managerId: true },
    })
    res.status(201).json(user)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

export default router;
// List users (manager/admin)
router.get('/', requireAuth, requireManagerOrAdmin, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, firstName: true, lastName: true, email: true, role: true, managerId: true } });
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Assign a sales rep to current manager
router.post('/:id/assign-to-me', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const current = req.user!
    if (current.role !== 'MANAGER' && current.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' })
    const { id } = req.params
    const updated = await prisma.user.update({ where: { id }, data: { managerId: current.id } })
    res.json({ id: updated.id, managerId: updated.managerId })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

// Remove assignment
router.post('/:id/unassign', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const current = req.user!
    if (current.role !== 'MANAGER' && current.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' })
    const { id } = req.params
    const updated = await prisma.user.update({ where: { id }, data: { managerId: null } })
    res.json({ id: updated.id, managerId: updated.managerId })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})


