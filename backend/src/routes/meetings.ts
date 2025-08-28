import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireManagerOrAdmin } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

// List meetings. Normal user sees own. Manager/Admin can pass ?userId=
router.get('/', requireAuth, async (req, res) => {
  try {
    const currentUser = req.user!;
    const filterUserId = (req.query.userId as string | undefined) || undefined;
    const targetUserId = (filterUserId && (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER'))
      ? filterUserId
      : currentUser.id;

    const meetings = await prisma.meeting.findMany({
      where: { attendeeId: targetUserId },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json(meetings);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Create meeting. Normal user can create only for self. Manager/Admin can create for any user via body.attendeeId
router.post('/', requireAuth, async (req, res) => {
  try {
    const currentUser = req.user!;
    const { scheduledAt, location, notes, attendeeId } = req.body as { scheduledAt: string; location?: string; notes?: string; attendeeId?: string };
    const ownerId = (attendeeId && (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER')) ? attendeeId : currentUser.id;

    const meeting = await prisma.meeting.create({ data: { scheduledAt: new Date(scheduledAt), location, notes, attendeeId: ownerId, leadId: (req.body as any).leadId || undefined } as any });
    res.status(201).json(meeting);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Update meeting. Normal user can update only own. Manager/Admin any.
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const currentUser = req.user!;
    const { id } = req.params;
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) return res.status(404).json({ error: 'Not found' });
    if (currentUser.role !== 'ADMIN' && currentUser.role !== 'MANAGER' && meeting.attendeeId !== currentUser.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { scheduledAt, location, notes } = req.body as { scheduledAt?: string; location?: string; notes?: string };
    const updated = await prisma.meeting.update({ where: { id }, data: {
      ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(notes !== undefined ? { notes } : {}),
    }});
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Delete meeting. Normal user can delete only own. Manager/Admin any.
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const currentUser = req.user!;
    const { id } = req.params;
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) return res.status(404).json({ error: 'Not found' });
    if (currentUser.role !== 'ADMIN' && currentUser.role !== 'MANAGER' && meeting.attendeeId !== currentUser.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await prisma.meeting.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;


