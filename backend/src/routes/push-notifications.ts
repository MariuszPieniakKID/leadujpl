import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireManagerOrAdmin } from '../middleware/auth';
import webpush from 'web-push';

const prisma = new PrismaClient();
const router = Router();

// Configure web-push
webpush.setVapidDetails(
  'mailto:admin@leaduj.local',
  process.env.VAPID_PUBLIC_KEY || 'BCyel-OSO5pHk5Qvj-8CpIzTNh4MQm4dHrBA53YH2XYrXZvmuGlPtkBgb8m948HTxB6l0tOsE_Z9pCts_Y_otgY',
  process.env.VAPID_PRIVATE_KEY || 'bLPIT1jnklybwFHrj3opc-bubNgaoaFkM2ZTyCPVN_U'
);

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
    
    res.json({ success: true, message: 'Successfully subscribed to push notifications' });
  } catch (error) {
    console.error('Push subscription error:', error);
    res.status(500).json({ error: 'Failed to subscribe to push notifications' });
  }
});

// Send push notification to specific users (only managers can send)
router.post('/send', requireManagerOrAdmin, async (req, res) => {
  try {
    const senderId = req.user!.id;
    const { message, userIds } = req.body;

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

    // For managers, verify they can only send to their own team
    if (sender.role === 'MANAGER') {
      const managerUsers = await prisma.user.findMany({
        where: { managerId: senderId },
        select: { id: true }
      });
      
      const managerUserIds = managerUsers.map(u => u.id);
      const unauthorizedUsers = userIds.filter(id => !managerUserIds.includes(id));
      
      if (unauthorizedUsers.length > 0) {
        return res.status(403).json({ error: 'You can only send notifications to your team members' });
      }
    }

    // Get recipient info
    const recipients = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true }
    });

    const pushPayload = JSON.stringify({
      title: `Wiadomość od ${sender.firstName} ${sender.lastName}`,
      body: message,
      icon: '/leady_logo.png',
      badge: '/leady_logo.png',
      data: {
        senderId,
        timestamp: new Date().toISOString()
      }
    });

    const notifications = [];
    let successCount = 0;
    let failureCount = 0;

    for (const userId of userIds) {
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
