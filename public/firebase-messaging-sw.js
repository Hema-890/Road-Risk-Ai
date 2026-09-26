// Firebase Cloud Messaging Background Service Worker for RoadRisk AI
// Handles background push notifications for emergency routing, hazards, and reroutes

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Track processed notification IDs to prevent duplication
const processedNotifications = new Set();

// Default background handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();
    const data = payload.data || payload.notification || {};
    const dedupeKey = data.deduplicationKey || `${data.missionId || 'gen'}_${data.type || 'alert'}_${data.timestamp || Date.now()}`;

    if (processedNotifications.has(dedupeKey)) {
      return;
    }
    processedNotifications.add(dedupeKey);
    // Keep set bounded to 100 entries
    if (processedNotifications.size > 100) {
      const first = processedNotifications.values().next().value;
      processedNotifications.delete(first);
    }

    const title = data.title || 'RoadRisk AI Emergency Alert';
    const body = data.body || 'Mission status updated.';
    const severity = data.severity || 'normal';

    const icon = '/favicon.ico';
    const badge = '/favicon.ico';

    const options = {
      body,
      icon,
      badge,
      tag: dedupeKey,
      renotify: severity === 'critical',
      requireInteraction: severity === 'critical',
      data: {
        missionId: data.missionId,
        url: data.deepLink || '/',
      },
      actions: [
        { action: 'open', title: 'Open Navigation' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.warn('[SW] Push payload parse error:', err);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
