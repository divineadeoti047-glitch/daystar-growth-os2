const CACHE = 'daystar-shell-v1'
const SHELL = ['/', '/daystar.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('daystar-shell-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/.netlify/')
  )
    return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok)
            void caches
              .open(CACHE)
              .then((cache) => cache.put('/', response.clone()))
          return response
        })
        .catch(
          async () =>
            (await caches.match(url.pathname)) ??
            (await caches.match('/')) ??
            Response.error(),
        ),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request)
      const network = fetch(request).then((response) => {
        if (response.ok)
          void caches
            .open(CACHE)
            .then((cache) => cache.put(request, response.clone()))
        return response
      })
      if (cached) {
        event.waitUntil(network.then(() => undefined).catch(() => undefined))
        return cached
      }
      return network
    })(),
  )
})

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
  // Generic text keeps private task and journal content off the lock screen.
  event.waitUntil(
    self.registration.showNotification('DAYSTAR · Your next small step', {
      body: 'A scheduled commitment is ready. Open your private workspace to see it.',
      icon: '/daystar.svg',
      tag: 'daystar-routines',
    }),
  )
})
