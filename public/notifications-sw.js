/* Notification delivery only: no fetch interception or private-record caching. */
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (windows) => {
        const page = windows.find(
          (client) => new URL(client.url).origin === self.location.origin,
        )
        if (page) return page.focus()
        return self.clients.openWindow('/')
      }),
  )
})

self.addEventListener('push', (event) => {
  // Generic text protects private records on the lock screen.
  event.waitUntil(
    self.registration.showNotification('DAYSTAR · Your next small step', {
      body: 'A scheduled commitment is ready. Open your private workspace to see it.',
      icon: '/daystar.svg',
      tag: 'daystar-routines',
    }),
  )
})
