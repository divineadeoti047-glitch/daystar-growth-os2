/* App-shell caching is limited to public HTML/static assets. Private API and
 * identity responses are never intercepted or written to Cache Storage. */
const APP_CACHE = 'daystar-app-shell-v1'
const APP_ROUTES = new Set(['/', '/app'])
const STATIC_ROUTES = new Set([
  '/manifest.webmanifest',
  '/daystar.svg',
  '/daystar-192.png',
  '/daystar-512.png',
  '/favicon.ico',
])
const ASSET_PATTERN = /\.(?:css|eot|ico|jpe?g|js|png|svg|webp|woff2?)$/i

function isPrivateRoute(path) {
  return (
    path.startsWith('/.netlify/') ||
    path.startsWith('/identity/') ||
    path.startsWith('/auth/')
  )
}

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    !url.search &&
    url.pathname.startsWith('/assets/') &&
    ASSET_PATTERN.test(url.pathname)
  )
}

async function cachePageAndAssets(cache, path) {
  try {
    const response = await fetch(path, { cache: 'reload' })
    if (
      !response.ok ||
      !response.headers.get('content-type')?.includes('text/html')
    )
      return
    await cache.put(path, response.clone())
    const html = await response.text()
    const references = Array.from(
      html.matchAll(/(?:src|href)=["']([^"']+)["']/g),
      (match) => match[1],
    )
    const assets = references
      .map((reference) => new URL(reference, self.location.origin))
      .filter(isStaticAsset)
    await Promise.allSettled(
      assets.map(async (asset) => {
        const assetResponse = await fetch(asset)
        if (assetResponse.ok)
          await cache.put(asset.pathname, assetResponse)
      }),
    )
  } catch {
    // Keep installation available when the network is interrupted.
  }
}

self.addEventListener('install', (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE)
      await Promise.all([
        cachePageAndAssets(cache, '/'),
        cachePageAndAssets(cache, '/app'),
        ...Array.from(STATIC_ROUTES, async (path) => {
          try {
            const response = await fetch(path)
            if (response.ok) await cache.put(path, response)
          } catch {
            // A later visit can populate this public asset.
          }
        }),
      ])
      await self.skipWaiting()
    })(),
  ),
)
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith('daystar-app-shell-') && name !== APP_CACHE)
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  ),
)

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'CACHE_APP_ASSETS' || !Array.isArray(event.data.assets))
    return
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE)
      const assets = event.data.assets
        .filter((asset) => typeof asset === 'string')
        .map((asset) => new URL(asset, self.location.origin))
        .filter(isStaticAsset)
      await Promise.allSettled(
        assets.map(async (asset) => {
          const response = await fetch(asset)
          if (response.ok) await cache.put(asset.pathname, response)
        }),
      )
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    isPrivateRoute(url.pathname)
  )
    return

  if (request.mode === 'navigate' && APP_ROUTES.has(url.pathname)) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          if (response.ok && !url.search) {
            const cache = await caches.open(APP_CACHE)
            await cache.put(url.pathname, response.clone())
          }
          return response
        } catch {
          const cache = await caches.open(APP_CACHE)
          return (
            (await cache.match(url.pathname)) ??
            (await cache.match('/')) ??
            new Response('Reconnect to load DAYSTAR.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          )
        }
      })(),
    )
    return
  }

  if (STATIC_ROUTES.has(url.pathname) || isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(APP_CACHE)
        const cached = await cache.match(url.pathname)
        const update = fetch(request)
          .then(async (response) => {
            if (response.ok) await cache.put(url.pathname, response.clone())
            return response
          })
          .catch(() => null)
        if (cached) {
          void update
          return cached
        }
        return (
          (await update) ??
          new Response('', { status: 503, statusText: 'Offline' })
        )
      })(),
    )
  }
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
  // Generic text protects private records on the lock screen.
  event.waitUntil(
    self.registration.showNotification('DAYSTAR · Your next small step', {
      body: 'A scheduled commitment is ready. Open your private workspace to see it.',
      icon: '/daystar.svg',
      tag: 'daystar-routines',
    }),
  )
})
