import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireManagerOrAdmin } from '../middleware/auth';
import webpush from 'web-push';

const prisma = new PrismaClient();
const router = Router();

// Configure web-push (do not crash if keys are missing/invalid)
let pushConfigured = false;
(() => {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    try {
      webpush.setVapidDetails('mailto:admin@leaduj.local', pub, priv);
      pushConfigured = true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('web-push VAPID configuration failed. Push disabled.', (err as Error).message);
      pushConfigured = false;
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn('VAPID keys not set. Push disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.');
  }
})();

// Store push subscriptions for users
const userSubscriptions: Map<string, any> = new Map();

// Subscribe to push notifications
router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const subscription = req.body.subscription;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }

    userSubscriptions.set(userId, subscription);
    
    res.json({ success: true, pushConfigured, message: pushConfigured ? 'Successfully subscribed to push notifications' : 'Subscribed, but push is disabled on server (missing VAPID keys)' });
  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({ error: 'Failed to subscribe to push notifications' });
  }
});

// Send push notification to specific users (only managers can send)
router.post('/send', requireManagerOrAdmin, async (req, res) => {
  try {
    if (!pushConfigured) {
      return res.status(503).json({ error: 'Push notifications are not configured on the server' });
    }
    const senderId = req.user!.id;
    const { message, userIds } = req.body as { message?: string; userIds?: string[] };

    if (!message || !userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ error: 'Message and userIds are required' });
    }

    // Get sender info
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { firstName: true, lastName: true, role: true }
    });

    if (!sender) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    // Resolve recipients server-side to avoid client-side inconsistencies
    let targetUserIds: string[] = Array.isArray(userIds) ? userIds : [];

    if (sender.role === 'MANAGER') {
      const managerUsers = await prisma.user.findMany({
        where: { managerId: senderId },
        select: { id: true }
      });
      const managerUserIds = managerUsers.map(u => u.id);

      // If client provided no ids, send to entire team
      if (targetUserIds.length === 0) {
        targetUserIds = managerUserIds;
      } else {
        // Restrict to intersection with manager's team
        targetUserIds = targetUserIds.filter(id => managerUserIds.includes(id));
        if (targetUserIds.length === 0) {
          return res.status(403).json({ error: 'Brak uprawnień — żaden z odbiorców nie należy do Twojego zespołu' });
        }
      }
    }
    // ADMIN can target any provided users (already in targetUserIds)
    if (sender.role === 'ADMIN') {
      // keep targetUserIds as provided
    }

    // Get recipient info
    const recipients = await prisma.user.findMany({
      where: { id: { in: targetUserIds } },
      select: { id: true, firstName: true, lastName: true }
    });

    const pushPayload = JSON.stringify({
      title: `Wiadomość od ${sender.firstName} ${sender.lastName}`,
      body: message,
      icon: '/atomic_logo.png',
      badge: '/atomic_logo.png',
      data: {
        senderId,
        timestamp: new Date().toISOString()
      }
    });

    const notifications = [];
    let successCount = 0;
    let failureCount = 0;

    for (const userId of targetUserIds) {
      const subscription = userSubscriptions.get(userId);
      
      if (subscription) {
        try {
          await webpush.sendNotification(subscription, pushPayload);
          successCount++;
          notifications.push({ userId, status: 'sent' });
        } catch (error) {
          console.error(`Failed to send push notification to user ${userId}:`, error);
          failureCount++;
          notifications.push({ userId, status: 'failed', error: (error as Error).message });
          
          // Remove invalid subscription
          if ((error as any).statusCode === 410) {
            userSubscriptions.delete(userId);
          }
        }
      } else {
        failureCount++;
        notifications.push({ userId, status: 'no_subscription' });
      }
    }

    res.json({
      success: true,
      message: `Notifications sent: ${successCount} successful, ${failureCount} failed`,
      details: {
        successCount,
        failureCount,
        totalRecipients: recipients.length,
        recipients: recipients.map(r => ({ id: r.id, name: `${r.firstName} ${r.lastName}` })),
        notifications
      }
    });

  } catch (error) {
    console.error('Push notification error:', error);
    res.status(500).json({ error: 'Failed to send push notifications' });
  }
});

// Get push notification status
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const hasSubscription = userSubscriptions.has(userId);
    
    res.json({
      subscribed: hasSubscription,
      subscription: hasSubscription ? userSubscriptions.get(userId) : null
    });
  } catch (error) {
    console.error('Push status error:', error);
    res.status(500).json({ error: 'Failed to get push notification status' });
  }
});

export default router;
