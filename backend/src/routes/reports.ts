import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

// Admin-only endpoint: fetch data for custom reports
router.post('/data', requireAdmin, async (req, res) => {
  try {
    const { 
      includeClients, 
      includeMeetings, 
      includeOffers, 
      includeAttachments, 
      includeUsers,
      includePoints,
      startDate, 
      endDate,
      managerId
    } = req.body as {
      includeClients?: boolean;
      includeMeetings?: boolean;
      includeOffers?: boolean;
      includeAttachments?: boolean;
      includeUsers?: boolean;
      includePoints?: boolean;
      startDate?: string;
      endDate?: string;
      managerId?: string;
    };

    const result: any = {};

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate + 'T00:00:00.000Z');
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    // Fetch clients
    if (includeClients) {
      const where: any = {};
      if (Object.keys(dateFilter).length > 0) {
        where.createdAt = dateFilter;
      }
      
      const clients = await prisma.client.findMany({
        where,
        include: {
          meetings: {
            select: {
              attendee: {
                select: { id: true, firstName: true, lastName: true, email: true, managerId: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      result.clients = clients.map(c => {
        // Get unique sales reps for this client
        const reps = Array.from(new Set(c.meetings.map(m => m.attendee?.id))).filter(Boolean);
        const repNames = Array.from(new Set(c.meetings.map(m => 
          m.attendee ? `${m.attendee.firstName} ${m.attendee.lastName}` : ''
        ))).filter(Boolean).join(', ');
        const managerIds = Array.from(new Set(c.meetings.map(m => m.attendee?.managerId).filter(Boolean)));

        return {
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone || '',
          email: c.email || '',
          street: c.street || '',
          city: c.city || '',
          postalCode: c.postalCode || '',
          category: c.category || '',
          pvInstalled: c.pvInstalled ? 'Tak' : 'Nie',
          pvPower: c.pvPower || '',
          billRange: c.billRange || '',
          extraComments: c.extraComments || '',
          newRules: c.newRules ? 'Tak' : 'Nie',
          buildingType: c.buildingType || '',
          assignedSalesReps: repNames,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        };
      });
    }

    // Fetch meetings
    if (includeMeetings) {
      const where: any = {};
      if (Object.keys(dateFilter).length > 0) {
        where.scheduledAt = dateFilter;
      }
      if (managerId) {
        where.attendee = { managerId };
      }

      const meetings = await prisma.meeting.findMany({
        where,
        include: {
          attendee: {
            select: { id: true, firstName: true, lastName: true, email: true, managerId: true, manager: { select: { firstName: true, lastName: true } } }
          },
          client: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true }
          },
          lead: {
            select: { id: true, firstName: true, lastName: true }
          }
        },
        orderBy: { scheduledAt: 'desc' }
      });

      result.meetings = meetings.map(m => ({
        id: m.id,
        scheduledAt: m.scheduledAt.toISOString(),
        endsAt: m.endsAt?.toISOString() || '',
        location: m.location || '',
        notes: m.notes || '',
        status: m.status || '',
        pvInstalled: m.pvInstalled ? 'Tak' : 'Nie',
        billRange: m.billRange || '',
        extraComments: m.extraComments || '',
        contactConsent: m.contactConsent ? 'Tak' : 'Nie',
        salesRep: m.attendee ? `${m.attendee.firstName} ${m.attendee.lastName}` : '',
        salesRepEmail: m.attendee?.email || '',
        manager: m.attendee?.manager ? `${m.attendee.manager.firstName} ${m.attendee.manager.lastName}` : '',
        clientName: m.client ? `${m.client.firstName} ${m.client.lastName}` : '',
        clientPhone: m.client?.phone || '',
        clientEmail: m.client?.email || '',
        leadName: m.lead ? `${m.lead.firstName} ${m.lead.lastName}` : '',
        salesLocationAddress: m.salesLocationAddress || '',
        salesLocationCity: m.salesLocationCity || '',
        salesLocationPostalCode: m.salesLocationPostalCode || '',
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      }));
    }

    // Fetch offers
    if (includeOffers) {
      const where: any = {};
      if (Object.keys(dateFilter).length > 0) {
        where.createdAt = dateFilter;
      }
      if (managerId) {
        where.owner = { managerId };
      }

      const offers = await prisma.offer.findMany({
        where,
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true, managerId: true, manager: { select: { firstName: true, lastName: true } } }
          },
          client: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true }
          },
          meeting: {
            select: { id: true, scheduledAt: true, status: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      result.offers = offers.map(o => ({
        id: o.id,
        fileName: o.fileName,
        salesRep: o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : '',
        salesRepEmail: o.owner?.email || '',
        manager: o.owner?.manager ? `${o.owner.manager.firstName} ${o.owner.manager.lastName}` : '',
        clientName: o.client ? `${o.client.firstName} ${o.client.lastName}` : '',
        clientPhone: o.client?.phone || '',
        clientEmail: o.client?.email || '',
        meetingDate: o.meeting?.scheduledAt?.toISOString() || '',
        meetingStatus: o.meeting?.status || '',
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      }));
    }

    // Fetch attachments
    if (includeAttachments) {
      const where: any = {};
      if (Object.keys(dateFilter).length > 0) {
        where.createdAt = dateFilter;
      }
      if (managerId) {
        where.owner = { managerId };
      }

      const attachments = await prisma.attachment.findMany({
        where,
        include: {
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true, managerId: true, manager: { select: { firstName: true, lastName: true } } }
          },
          client: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true }
          },
          meeting: {
            select: { id: true, scheduledAt: true, status: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      result.attachments = attachments.map(a => ({
        id: a.id,
        fileName: a.fileName,
        category: a.category || '',
        mimeType: a.mimeType,
        salesRep: a.owner ? `${a.owner.firstName} ${a.owner.lastName}` : '',
        salesRepEmail: a.owner?.email || '',
        manager: a.owner?.manager ? `${a.owner.manager.firstName} ${a.owner.manager.lastName}` : '',
        clientName: a.client ? `${a.client.firstName} ${a.client.lastName}` : '',
        clientPhone: a.client?.phone || '',
        clientEmail: a.client?.email || '',
        meetingDate: a.meeting?.scheduledAt?.toISOString() || '',
        meetingStatus: a.meeting?.status || '',
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      }));
    }

    // Fetch users (sales reps)
    if (includeUsers) {
      const where: any = {
        role: { in: ['SALES_REP', 'MANAGER'] }
      };
      if (managerId) {
        where.OR = [
          { id: managerId },
          { managerId }
        ];
      }

      const users = await prisma.user.findMany({
        where,
        include: {
          manager: {
            select: { firstName: true, lastName: true, email: true }
          },
          _count: {
            select: {
              meetings: true,
              offers: true,
              attachments: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      result.users = users.map(u => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone || '',
        street: u.street || '',
        city: u.city || '',
        postalCode: u.postalCode || '',
        role: u.role,
        manager: u.manager ? `${u.manager.firstName} ${u.manager.lastName}` : '',
        managerEmail: u.manager?.email || '',
        meetingsCount: u._count.meetings,
        offersCount: u._count.offers,
        attachmentsCount: u._count.attachments,
        createdAt: u.createdAt.toISOString(),
      }));
    }

    // Fetch points events
    if (includePoints) {
      const where: any = {};
      if (Object.keys(dateFilter).length > 0) {
        where.createdAt = dateFilter;
      }
      if (managerId) {
        where.user = { managerId };
      }

      const points = await prisma.pointsEvent.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, managerId: true, manager: { select: { firstName: true, lastName: true } } }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      result.points = points.map(p => ({
        id: p.id,
        points: p.points,
        reason: p.reason,
        salesRep: p.user ? `${p.user.firstName} ${p.user.lastName}` : '',
        salesRepEmail: p.user?.email || '',
        manager: p.user?.manager ? `${p.user.manager.firstName} ${p.user.manager.lastName}` : '',
        clientId: p.clientId || '',
        meetingId: p.meetingId || '',
        createdAt: p.createdAt.toISOString(),
      }));
    }

    res.json(result);
  } catch (e: any) {
    console.error('Reports error:', e);
    res.status(500).json({ error: e.message || 'Nie udało się pobrać danych raportu' });
  }
});

export default router;

