import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { Context } from '@netlify/functions'
import { getUser } from '@netlify/identity'

// Accept only browser push services, never arbitrary user-controlled destinations.
export function trustedPushEndpoint(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      (host === 'fcm.googleapis.com' ||
        host === 'updates.push.services.mozilla.com' ||
        host === 'web.push.apple.com' ||
        host.endsWith('.notify.windows.com'))
    )
  } catch {
    return false
  }
}
export const subscriptionSchema = z.object({
  endpoint: z.string().max(3000).refine(trustedPushEndpoint),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/),
  }),
})
export function pushId(endpoint: string) {
  return createHash('sha256').update(endpoint).digest('hex')
}
export async function pushOwner(context: Context) {
  const user = await getUser()
  if (user) return `user:${user.id}`
  const device = context.cookies.get('daystar_device')
  if (!device || !/^[a-f0-9]{64}$/.test(device)) return null
  return `device:${createHash('sha256').update(device).digest('hex')}`
}
export function ownerScope(owner: string) {
  return createHash('sha256').update(owner).digest('hex')
}
