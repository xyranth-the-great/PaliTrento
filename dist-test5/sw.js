// Service Worker for PaliTrento Push Notifications
const CACHE_NAME = 'palitrento-v1';
const VAPID_PUBLIC_KEY = '{{VAPID_PUBLIC_KEY}}'; // Will be replaced at build time

// Install event
self.addEventListener('install', (event) => {
  self.skipWaiting();
  console.log('[SW] Installed');
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  console.log('[SW] Activated');
});

// Push event - show notification
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/',
      advisoryId: data.advisoryId
    },
    actions: data.actions || [],
    requireInteraction: data.priority === 'critical' || data.priority === 'high',
    tag: `advisory-${data.advisoryId}`
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Try to focus existing window
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        return clients.openWindow(url);
      })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event.notification.tag);
});

// Background sync for offline actions (future enhancement)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
});