/// <reference lib="webworker" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

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

// Background Sync Plugin for API writes
const bgSyncPlugin = new BackgroundSyncPlugin('api-write-queue', {
  maxRetentionTime: 24 * 60, // Retry for max of 24 hours (in minutes)
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone());
        console.log('Replay successful for request', entry.request.url);
      } catch (error) {
        console.error('Replay failed for request', entry.request.url, error);
        // Put the request back in the queue to retry later
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
  },
});

// API caching for GET requests
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 5,
  })
);

// API writes (POST, PUT, PATCH, DELETE) with Background Sync
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method),
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  })
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

// Background Sync event handler
self.addEventListener('sync', function(event: any) {
  console.log('Background sync event:', event.tag);
  
  if (event.tag === 'sync-pending-requests') {
    event.waitUntil(
      // Notify all clients to process their queues
      self.clients.matchAll().then(function(clients) {
        return Promise.all(
          clients.map(client => 
            client.postMessage({
              type: 'SYNC_PENDING_REQUESTS',
              timestamp: Date.now()
            })
          )
        );
      })
    );
  }
});

// Message handling from main thread
self.addEventListener('message', function(event) {
  console.log('Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
