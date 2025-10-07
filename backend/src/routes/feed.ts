import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../middleware/auth';

const prisma = new PrismaClient();
const router = Router();

// Get today's feed (admin only)
router.get('/today', requireAdmin, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const activities = await prisma.activityLog.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get today's statistics (admin only)
router.get('/stats/today', requireAdmin, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Count new meetings created today
    const newMeetingsCount = await prisma.activityLog.count({
      where: {
        type: 'meeting_created',
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Count status changes to Sukces today
    const successCount = await prisma.activityLog.count({
      where: {
        OR: [
          { type: 'meeting_status_changed', newStatus: 'Sukces' },
          { type: 'client_status_changed', newStatus: 'Sukces' },
        ],
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Count status changes to Rezygnacja today
    const rezygnacjaCount = await prisma.activityLog.count({
      where: {
        OR: [
          { type: 'meeting_status_changed', newStatus: 'Rezygnacja' },
          { type: 'client_status_changed', newStatus: 'Rezygnacja' },
        ],
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Count status changes to Przełożone today
    const przelozoneCount = await prisma.activityLog.count({
      where: {
        OR: [
          { type: 'meeting_status_changed', newStatus: 'Przełożone' },
          { type: 'client_status_changed', newStatus: 'Przełożone' },
        ],
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    res.json({
      newMeetings: newMeetingsCount,
      success: successCount,
      rezygnacja: rezygnacjaCount,
      przelozone: przelozoneCount,
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get archived feeds (by date)
router.get('/archive', requireAdmin, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({ error: 'date parameter is required' });
    }

    const targetDate = new Date(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const activities = await prisma.activityLog.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// Get list of archived dates (dates with activity)
router.get('/archive/dates', requireAdmin, async (req, res) => {
  try {
    // Get distinct dates from activity log
    const activities = await prisma.activityLog.findMany({
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Extract unique dates
    const dateSet = new Set<string>();
    activities.forEach((activity: { createdAt: Date }) => {
      const dateStr = activity.createdAt.toISOString().split('T')[0];
      dateSet.add(dateStr);
    });

    const dates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

    res.json(dates);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;

