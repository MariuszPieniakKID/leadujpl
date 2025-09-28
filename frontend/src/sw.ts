/// <reference lib="webworker" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

// Workbox precaching
self.skipWaiting();
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Navigation route
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler);
registerRoute(navigationRoute);

// API caching
registerRoute(
  /\/api\//,
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
  }),
  'GET'
);

// Push notification handling
self.addEventListener('push', function(event) {
  console.log('Push event received:', event);

  let notificationData: any = {};
  
  try {
    if (event.data) {
      notificationData = event.data.json();
    }
  } catch (e) {
    console.error('Error parsing push data:', e);
    notificationData = {
      title: 'Leaduj - Nowe powiadomienie',
      body: event.data ? event.data.text() : 'Otrzymałeś nową wiadomość',
    };
  }

  // Use any type for notification options due to limited TypeScript definitions
  const options: any = {
    body: notificationData.body || 'Nowa wiadomość',
    icon: notificationData.icon || '/leady_logo.png',
    badge: notificationData.badge || '/leady_logo.png',
    data: notificationData.data || {},
    tag: 'leaduj-notification',
    requireInteraction: false,
    renotify: true,
    actions: [
      {
        action: 'open',
        title: 'Otwórz aplikację'
      },
      {
        action: 'close',
        title: 'Zamknij'
      }
    ]
  };

  // Add vibration if supported by the browser
  if ('vibrate' in navigator) {
    options.vibrate = [200, 100, 200];
  }

  event.waitUntil(
    self.registration.showNotification(
      notificationData.title || 'Leaduj - Nowe powiadomienie',
      options
    )
  );
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('Notification click received:', event);

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Default action or 'open' action
  event.waitUntil(
    self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(function(clientList) {
      // Check if there's already a window/tab open with the target URL
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }

      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});

// Message handling from main thread
self.addEventListener('message', function(event) {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
