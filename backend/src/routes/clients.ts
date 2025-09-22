import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireManagerOrAdmin } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

// List clients - manager/admin only
router.get('/', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const current = req.user!
    const q = (req.query.q as string | undefined)?.trim()
    const status = (req.query.status as string | undefined)?.trim()
    const scope = (req.query.scope as string | undefined)?.trim()
    const managerId = (req.query.managerId as string | undefined)?.trim()
    const where: any = {}
    // For managers, scope=team shows clients from meetings of their sales reps
    if (scope === 'team' && current.role === 'MANAGER') {
      where.meetings = { some: { attendee: { managerId: current.id } } }
    }
    // For admins, allow filtering by managerId to see clients of that manager's team
    if (managerId && current.role === 'ADMIN') {
      const byManager = { some: { attendee: { managerId } } }
      if (where.meetings) {
        where.meetings = { AND: [where.meetings, byManager] }
      } else {
        where.meetings = byManager
      }
    }
    if (q && q.length > 0) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { street: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (status && status.length > 0) {
      const meetingsFilter = { some: { status } }
      if (where.meetings) {
        // combine filters if scope=team already set
        where.meetings = { AND: [where.meetings, meetingsFilter] }
      } else {
        where.meetings = meetingsFilter
      }
    }
    const clients = await prisma.client.findMany({ where, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] });
    res.json(clients);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// My clients (based on meetings of current user)
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const current = req.user!
    const q = (req.query.q as string | undefined)?.trim()
    const status = (req.query.status as string | undefined)?.trim()
    const where: any = { meetings: { some: { attendeeId: current.id, ...(status ? { status } : {}) } } }
    if (q && q.length > 0) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { street: { contains: q, mode: 'insensitive' } },
      ]
    }
    const clients = await prisma.client.findMany({
      where,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    })
    res.json(clients)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

// Search clients (by multiple fields) - any authenticated user
router.get('/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    if (!q) return res.json([]);
    const clients = await prisma.client.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
          { street: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { billRange: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 10,
    });
    res.json(clients);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Create client - manager/admin only
router.post('/', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const { firstName, lastName, phone, email, street, city, category, pvInstalled, billRange, extraComments } = req.body as {
      firstName: string; lastName: string; phone?: string; email?: string; street?: string; city?: string; category?: string; pvInstalled?: boolean; billRange?: string; extraComments?: string;
    };
    if (!firstName || !lastName) return res.status(400).json({ error: 'firstName and lastName are required' });
    const created = await prisma.client.create({ data: { firstName, lastName, phone, email, street, city, category, pvInstalled, billRange, extraComments } });
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Update client - manager/admin only
router.patch('/:id', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, email, street, city, category, pvInstalled, billRange, extraComments } = req.body as {
      firstName?: string; lastName?: string; phone?: string; email?: string; street?: string; city?: string; category?: string; pvInstalled?: boolean; billRange?: string; extraComments?: string;
    };
    const updated = await prisma.client.update({ where: { id }, data: { firstName, lastName, phone, email, street, city, category, pvInstalled, billRange, extraComments } });
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Delete client - manager/admin only
router.delete('/:id', requireAuth, requireManagerOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.client.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Get latest meeting status for a client (for current user) and its meetingId
router.get('/:id/status', requireAuth, async (req, res) => {
  try {
    const current = req.user!
    const { id } = req.params
    const meeting = await prisma.meeting.findFirst({
      where: { clientId: id, attendeeId: current.id },
      orderBy: { scheduledAt: 'desc' },
      select: { id: true, status: true },
    })
    if (!meeting) return res.json({ meetingId: null, status: null })
    return res.json({ meetingId: meeting.id, status: meeting.status || null })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

// Update latest meeting status for a client (for current user)
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const current = req.user!
    const { id } = req.params
    let { status } = req.body as { status?: string }
    if (!status) return res.status(400).json({ error: 'status is required' })
    // Normalize: treat "Umowa" as "Sukces"
    if (status === 'Umowa') status = 'Sukces'
    if (!['Sukces', 'Porażka', 'Dogrywka', 'Przełożone', 'Umówione', 'Odbyte'].includes(status)) {
      return res.status(400).json({ error: 'invalid status' })
    }
    const meeting = await prisma.meeting.findFirst({
      where: { clientId: id, attendeeId: current.id },
      orderBy: { scheduledAt: 'desc' },
      select: { id: true },
    })
    if (!meeting) return res.status(404).json({ error: 'No meeting for client' })
    const updated = await prisma.meeting.update({ where: { id: meeting.id }, data: { status } })
    return res.json({ meetingId: updated.id, status: updated.status || null })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

export default router;


