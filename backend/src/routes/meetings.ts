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
    const managerId = (req.query.managerId as string | undefined) || undefined;

    // Admin can fetch all meetings or filter by managerId
    if (currentUser.role === 'ADMIN') {
      let where: any = {};
      if (filterUserId) {
        where.attendeeId = filterUserId;
      } else if (managerId) {
        where.attendee = { managerId };
      } else {
        // all meetings
      }
      const meetingsRaw = await prisma.meeting.findMany({ where, orderBy: { scheduledAt: 'asc' } });
      const now = Date.now()
      const mapped = meetingsRaw.map(m => {
        const hasStatus = (m.status || '').trim().length > 0
        if (hasStatus) return m
        const isPast = new Date(m.scheduledAt).getTime() < now
        return { ...m, status: isPast ? 'Odbyte' : 'Umówione' } as any
      })
      return res.json(mapped);
    }

    // Managers can only see meetings for themselves or sales reps assigned to them
    let targetUserId = currentUser.id;
    if (filterUserId && (currentUser.role === 'MANAGER')) {
      targetUserId = filterUserId;
    }

    // Additional guard for MANAGER -> ensure target user is assigned to this manager
    if (currentUser.role === 'MANAGER' && targetUserId !== currentUser.id) {
      const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { managerId: true } });
      if (!target || target.managerId !== currentUser.id) {
        return res.json([]); // or 403; returning empty list for UX
      }
    }

    const meetings = await prisma.meeting.findMany({ where: { attendeeId: targetUserId }, orderBy: { scheduledAt: 'asc' } });
    // Auto status for returned payload (derive visual status): Odbyte/Umówione based on time if no explicit status
    const now = Date.now()
    const mapped = meetings.map(m => {
      const hasStatus = (m.status || '').trim().length > 0
      if (hasStatus) return m
      const isPast = new Date(m.scheduledAt).getTime() < now
      return { ...m, status: isPast ? 'Odbyte' : 'Umówione' } as any
    })
    res.json(mapped);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Create meeting. Normal user can create only for self. Manager/Admin can create for any user via body.attendeeId
router.post('/', requireAuth, async (req, res) => {
  try {
    const currentUser = req.user!;
    const { scheduledAt, endsAt, location, notes, attendeeId, client, clientId, pvInstalled, billRange, extraComments, status, contactConsent } = req.body as { scheduledAt: string; endsAt?: string; location?: string; notes?: string; attendeeId?: string; client?: { firstName?: string; lastName?: string; phone?: string; email?: string; street?: string; city?: string; postalCode?: string; category?: string; newRules?: boolean; buildingType?: string; billRange?: string; extraComments?: string; pvInstalled?: boolean }; clientId?: string; pvInstalled?: boolean; billRange?: string; extraComments?: string; status?: string; contactConsent?: boolean };
    if (contactConsent !== true) {
      return res.status(400).json({ error: 'Wymagana jest zgoda klienta na kontakt handlowy.' });
    }
    let ownerId = currentUser.id;
    if (attendeeId && (currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER')) {
      ownerId = attendeeId;
    }
    // For MANAGER, only allow creating for themselves or assigned sales reps
    if (currentUser.role === 'MANAGER' && ownerId !== currentUser.id) {
      const target = await prisma.user.findUnique({ where: { id: ownerId }, select: { managerId: true } });
      if (!target || target.managerId !== currentUser.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    const createData: any = {
      scheduledAt: new Date(scheduledAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      location,
      notes,
      attendeeId: ownerId,
    };
    createData.contactConsent = true;
    if (status !== undefined) createData.status = status;
    if (pvInstalled !== undefined) createData.pvInstalled = pvInstalled;
    if (billRange !== undefined) createData.billRange = billRange;
    if (extraComments !== undefined) createData.extraComments = extraComments;
    const bodyLeadId = (req.body as any).leadId as string | undefined;
    if (bodyLeadId) {
      createData.leadId = bodyLeadId;
    }
    // If clientId provided, link existing client first
    if (clientId) {
      createData.clientId = clientId;
      // Optionally mirror extra fields to client if provided
      if (pvInstalled !== undefined || billRange !== undefined || extraComments !== undefined || (client && (client.category != null || client.newRules != null || client.buildingType != null))) {
        try {
          await prisma.client.update({ where: { id: clientId }, data: {
            ...(pvInstalled !== undefined ? { pvInstalled } : {}),
            ...(billRange !== undefined ? { billRange } : {}),
            ...(extraComments !== undefined ? { extraComments } : {}),
            ...(client?.category !== undefined ? { category: client.category } : {}),
            ...(client?.postalCode !== undefined ? { postalCode: client.postalCode } : {}),
            ...(client?.newRules !== undefined ? { newRules: client.newRules } : {}),
            ...(client?.buildingType !== undefined ? { buildingType: client.buildingType } : {}),
          }});
        } catch {}
      }
    }

    // If client payload provided, create client and link by clientId
    if (client && (client.firstName || client.lastName || client.email || client.phone || client.street || client.city || client.postalCode || client.category || client.newRules != null || client.buildingType != null || client.billRange || client.pvInstalled != null || client.extraComments)) {
      const createdClient = await prisma.client.create({ data: {
        firstName: client.firstName || '',
        lastName: client.lastName || '',
        phone: client.phone,
        email: client.email,
        street: client.street,
        city: client.city,
        postalCode: client.postalCode,
        category: client.category,
        pvInstalled: client.pvInstalled ?? pvInstalled,
        billRange: client.billRange ?? billRange,
        extraComments: client.extraComments ?? extraComments,
        newRules: client.newRules,
        buildingType: client.buildingType,
      }});
      createData.clientId = createdClient.id;
    }

    const meeting = await prisma.meeting.create({ data: createData });
    res.status(201).json(meeting);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Get single meeting with details (including client). Normal user can view only own.
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const currentUser = req.user!;
    const { id } = req.params;
    const meeting = await prisma.meeting.findUnique({ where: { id }, include: { client: true } });
    if (!meeting) return res.status(404).json({ error: 'Not found' });
    if (currentUser.role !== 'ADMIN' && currentUser.role !== 'MANAGER' && meeting.attendeeId !== currentUser.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(meeting);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// Update meeting. Normal user can update only own. Manager/Admin any.
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const currentUser = req.user!;
    const { id } = req.params;
    const meeting = await prisma.meeting.findUnique({ where: { id }, include: { attendee: { select: { managerId: true, id: true } } } });
    if (!meeting) return res.status(404).json({ error: 'Not found' });
    if (currentUser.role !== 'ADMIN') {
      if (meeting.attendeeId !== currentUser.id) {
        // If manager, ensure assigned
        if (currentUser.role === 'MANAGER') {
          if (meeting.attendee.managerId !== currentUser.id) {
            return res.status(403).json({ error: 'Forbidden' });
          }
        } else {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
    }
    const { scheduledAt, endsAt, location, notes, client, pvInstalled, billRange, extraComments, status } = req.body as { scheduledAt?: string; endsAt?: string; location?: string; notes?: string; client?: { firstName?: string; lastName?: string; phone?: string; email?: string; street?: string; city?: string; category?: string; newRules?: boolean; buildingType?: string; billRange?: string; extraComments?: string; pvInstalled?: boolean }; pvInstalled?: boolean; billRange?: string; extraComments?: string; status?: string };

    const patchData: any = {
      ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
      ...(endsAt ? { endsAt: new Date(endsAt) } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(notes !== undefined ? { notes } : {}),
    };
    if (status !== undefined) patchData.status = status;
    if (pvInstalled !== undefined) patchData.pvInstalled = pvInstalled;
    if (billRange !== undefined) patchData.billRange = billRange;
    if (extraComments !== undefined) patchData.extraComments = extraComments;

    // Optionally update or create client and link
    if (client && (client.firstName || client.lastName || client.email || client.phone || client.street || client.city || client.postalCode || client.category || client.newRules != null || client.buildingType != null || client.billRange || client.pvInstalled != null || client.extraComments)) {
      if (meeting.clientId) {
        await prisma.client.update({ where: { id: meeting.clientId }, data: {
          ...(client.firstName !== undefined ? { firstName: client.firstName } : {}),
          ...(client.lastName !== undefined ? { lastName: client.lastName } : {}),
          ...(client.phone !== undefined ? { phone: client.phone } : {}),
          ...(client.email !== undefined ? { email: client.email } : {}),
          ...(client.street !== undefined ? { street: client.street } : {}),
          ...(client.city !== undefined ? { city: client.city } : {}),
          ...(client.postalCode !== undefined ? { postalCode: client.postalCode } : {}),
          ...(client.category !== undefined ? { category: client.category } : {}),
          ...(client.pvInstalled !== undefined ? { pvInstalled: client.pvInstalled } : (pvInstalled !== undefined ? { pvInstalled } : {})),
          ...(client.billRange !== undefined ? { billRange: client.billRange } : (billRange !== undefined ? { billRange } : {})),
          ...(client.extraComments !== undefined ? { extraComments: client.extraComments } : (extraComments !== undefined ? { extraComments } : {})),
          ...(client.newRules !== undefined ? { newRules: client.newRules } : {}),
          ...(client.buildingType !== undefined ? { buildingType: client.buildingType } : {}),
        }});
      } else {
        const createdClient = await prisma.client.create({ data: {
          firstName: client.firstName || '',
          lastName: client.lastName || '',
          phone: client.phone,
          email: client.email,
          street: client.street,
          city: client.city,
          postalCode: client.postalCode,
          category: client.category,
          pvInstalled: client.pvInstalled ?? pvInstalled,
          billRange: client.billRange ?? billRange,
          extraComments: client.extraComments ?? extraComments,
          newRules: client.newRules,
          buildingType: client.buildingType,
        }});
        patchData.clientId = createdClient.id;
      }
    }

    const updated = await prisma.meeting.update({ where: { id }, data: patchData });
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
    const meeting = await prisma.meeting.findUnique({ where: { id }, include: { attendee: { select: { managerId: true, id: true } } } });
    if (!meeting) return res.status(404).json({ error: 'Not found' });
    if (currentUser.role !== 'ADMIN') {
      if (meeting.attendeeId !== currentUser.id) {
        if (currentUser.role === 'MANAGER') {
          if (meeting.attendee.managerId !== currentUser.id) {
            return res.status(403).json({ error: 'Forbidden' });
          }
        } else {
          return res.status(403).json({ error: 'Forbidden' });
        }
      }
    }
    await prisma.meeting.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;


