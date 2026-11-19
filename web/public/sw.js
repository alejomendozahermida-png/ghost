// Service worker minimal : il affiche les notifications de Ghost (obligatoire sur Android) et ouvre la bonne page au clic.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const lien = e.notification.data?.lien ?? '/workflows';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      const ghost = fenetres.find((f) => new URL(f.url).origin === self.location.origin);
      if (ghost) return ghost.focus().then(() => ghost.navigate(lien));
      return self.clients.openWindow(lien);
    }),
  );
});
