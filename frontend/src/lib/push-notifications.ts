import api from './api';

// VAPID public key - should match the one in backend
const VAPID_PUBLIC_KEY = 'BCyel-OSO5pHk5Qvj-8CpIzTNh4MQm4dHrBA53YH2XYrXZvmuGlPtkBgb8m948HTxB6l0tOsE_Z9pCts_Y_otgY';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToPushNotifications(): Promise<boolean> {
  try {
    // Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return false;
    }

    // Check if push messaging is supported
    if (!('PushManager' in window)) {
      console.warn('Push messaging not supported');
      return false;
    }

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Create new subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    // Send subscription to server
    await api.post('/api/push-notifications/subscribe', {
      subscription: subscription.toJSON()
    });

    console.log('Successfully subscribed to push notifications');
    return true;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return false;
  }
}

export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      console.log('Successfully unsubscribed from push notifications');
    }

    return true;
  } catch (error) {
    console.error('Failed to unsubscribe from push notifications:', error);
    return false;
  }
}

export async function checkPushNotificationStatus(): Promise<boolean> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    return subscription !== null;
  } catch (error) {
    console.error('Failed to check push notification status:', error);
    return false;
  }
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  return new Promise((resolve) => {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      resolve('denied');
      return;
    }

    if (Notification.permission !== 'default') {
      resolve(Notification.permission);
      return;
    }

    Notification.requestPermission().then(resolve);
  });
}
