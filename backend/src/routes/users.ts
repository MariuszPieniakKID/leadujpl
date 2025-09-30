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

// Delete user (ADMIN only) with reassignment logic
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const current = req.user!
    if (current.role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' })
    const { id } = req.params
    if (id === current.id) return res.status(400).json({ error: 'Nie można usunąć własnego konta' })

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } })
    if (!target) return res.status(404).json({ error: 'Użytkownik nie istnieje' })

    await prisma.$transaction(async (tx) => {
      // If deleting a MANAGER: reassign their sales reps to the current ADMIN
      if (target.role === 'MANAGER') {
        await tx.user.updateMany({ where: { managerId: id }, data: { managerId: current.id } })
      }

      // Reassign entities owned/attended by the user to the current ADMIN
      await tx.meeting.updateMany({ where: { attendeeId: id }, data: { attendeeId: current.id } })
      await tx.offer.updateMany({ where: { ownerId: id }, data: { ownerId: current.id } })
      await tx.attachment.updateMany({ where: { ownerId: id }, data: { ownerId: current.id } })
      // Also reassign leads ownership to current ADMIN
      await tx.lead.updateMany({ where: { ownerId: id }, data: { ownerId: current.id } })

      // Finally, delete the user
      await tx.user.delete({ where: { id } })
    })

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})


// Total points for current user
router.get('/me/points', requireAuth, async (req, res) => {
  try {
    const uid = req.user!.id
    const sum = await prisma.pointsEvent.aggregate({ _sum: { points: true }, where: { userId: uid } })
    res.json({ total: sum._sum.points || 0 })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

// Leaderboard by points (optionally filter by managerId -> only that manager's sales reps)
router.get('/leaderboard/points', requireAuth, async (req, res) => {
  try {
    const managerId = (req.query.managerId as string | undefined) || undefined
    let users
    if (managerId) {
      users = await prisma.user.findMany({ where: { role: 'SALES_REP', managerId }, select: { id: true, firstName: true, lastName: true } })
    } else {
      users = await prisma.user.findMany({ where: { role: 'SALES_REP' }, select: { id: true, firstName: true, lastName: true, managerId: true } })
    }
    if (users.length === 0) return res.json([])
    const ids = users.map(u => u.id)
    const sums = await prisma.pointsEvent.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _sum: { points: true } })
    const map = new Map<string, number>(sums.map(s => [s.userId, s._sum.points || 0]))
    const rows = users.map((u: any) => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, total: map.get(u.id) || 0 }))
    rows.sort((a: any, b: any) => b.total - a.total)
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

