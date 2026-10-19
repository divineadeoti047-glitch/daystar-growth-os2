const assetPattern =
  /\.(?:css|eot|ico|jpe?g|js|png|svg|ttf|webp|woff2?)$/i

function precacheableAsset(value: string) {
  try {
    const url = new URL(value, window.location.origin)
    return (
      url.origin === window.location.origin &&
      url.pathname.startsWith('/assets/') &&
      assetPattern.test(url.pathname)
    )
  } catch {
    return false
  }
}

export async function registerAppShellServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return false

  const registration = await navigator.serviceWorker.register(
    '/notifications-sw.js',
    { scope: '/' },
  )
  await navigator.serviceWorker.ready

  const assets = Array.from(
    new Set(
      performance
        .getEntriesByType('resource')
        .map((entry) => entry.name)
        .filter(precacheableAsset),
    ),
  ).slice(0, 120)

  registration.active?.postMessage({
    type: 'CACHE_APP_ASSETS',
    assets,
  })
  return true
}
