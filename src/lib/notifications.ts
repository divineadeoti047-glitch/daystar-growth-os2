// Android Chrome requires persistent service-worker notifications. This worker
// delivers notifications only; it does not schedule push or cache private data.
export async function enableNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator))
    throw new Error('Notifications unavailable')
  const permission = await Notification.requestPermission()
  if (permission === 'granted')
    await navigator.serviceWorker.register('/notifications-sw.js')
  return permission
}
export async function deliverNotification(
  body = 'Review today’s commitments, study and spiritual routines. Choose your next step.',
  tag = 'daystar-daily-check-in',
) {
  if (!('Notification' in window) || Notification.permission !== 'granted')
    return
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.register(
    '/notifications-sw.js',
  )
  if (!registration.active) await navigator.serviceWorker.ready
  await registration.showNotification('DAYSTAR · A moment for your growth', {
    body,
    icon: '/daystar.svg',
    tag,
  })
}
