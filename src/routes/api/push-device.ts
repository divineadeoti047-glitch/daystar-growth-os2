import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { database, ensureDatabase } from '../../../db'
import { pushDevices } from '../../../db/schema'
import { getAuth } from '@/lib/auth-server'

const headers = { 'Cache-Control': 'private, no-store' }

function deviceCookie(request: Request) {
  const entry = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('daystar_device='))
  const value = entry?.slice('daystar_device='.length)
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null
}

function trustedEndpoint(value: string) {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      (url.hostname.endsWith('.push.services.mozilla.com') ||
        url.hostname.endsWith('.push.apple.com') ||
        url.hostname.endsWith('.notify.windows.com') ||
        url.hostname === 'fcm.googleapis.com' ||
        url.hostname === 'updates.push.services.mozilla.com' ||
        url.hostname === 'web.push.apple.com')
    )
  } catch {
    return false
  }
}

const subscriptionSchema = z.object({
  endpoint: z.string().max(3000).refine(trustedEndpoint),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}={0,2}$/),
  }),
})

function idFor(endpoint: string) {
  return createHash('sha256').update(endpoint).digest('hex')
}

async function handle(request: Request) {
  if (!['GET', 'PUT', 'DELETE'].includes(request.method))
    return new Response(null, { status: 405, headers })
  if (request.method !== 'GET' && request.headers.get('origin') !== new URL(request.url).origin)
    return new Response(null, { status: 403, headers })
  try {
    await ensureDatabase()
    const session = await getAuth().api.getSession({ headers: request.headers })
    const device = deviceCookie(request)
    const owner = session
      ? `user:${session.user.id}`
      : device
        ? `device:${createHash('sha256').update(device).digest('hex')}`
        : null
    // Background reminder dispatch still needs a Vercel Cron route.
    const configured = false
    if (request.method === 'GET') {
      if (!owner)
        return Response.json({ configured, deviceIds: [] }, { headers })
      const devices = await database()
        .select({ id: pushDevices.id })
        .from(pushDevices)
        .where(eq(pushDevices.owner, owner))
      return Response.json({ configured, deviceIds: devices.map((item) => item.id) }, { headers })
    }
    if (!owner)
      return Response.json({ error: 'Open your workspace first.' }, { status: 401, headers })
    const text = await request.text()
    if (text.length > 12000) return Response.json({ error: 'Subscription too large.' }, { status: 413, headers })
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return Response.json({ error: 'Invalid subscription.' }, { status: 400, headers })
    }
    if (!body || typeof body !== 'object')
      return Response.json({ error: 'Invalid subscription.' }, { status: 400, headers })
    const payload = body as { scope?: unknown; subscription?: unknown }
    const scope = createHash('sha256').update(owner).digest('hex')
    if (payload.scope !== scope)
      return Response.json({ error: 'Reconnect your workspace and retry.' }, { status: 401, headers })
    const valid = subscriptionSchema.safeParse(payload.subscription)
    if (!valid.success)
      return Response.json({ error: 'Invalid notification subscription.' }, { status: 400, headers })
    const subscription = valid.data
    const id = idFor(subscription.endpoint)
    const db = database()
    if (request.method === 'DELETE') {
      await db.delete(pushDevices).where(and(eq(pushDevices.owner, owner), eq(pushDevices.id, id)))
      return Response.json({ ok: true }, { headers })
    }
    if (!configured)
      return Response.json({ error: 'Background push is not configured yet.' }, { status: 503, headers })
    await db
      .insert(pushDevices)
      .values({ id, owner, subscription, updatedAt: new Date() })
      .onConflictDoUpdate({ target: pushDevices.id, set: { owner, subscription, updatedAt: new Date() } })
    return Response.json({ ok: true }, { headers })
  } catch {
    return Response.json({ error: 'Background notifications are unavailable.' }, { status: 503, headers })
  }
}

export const Route = createFileRoute('/api/push-device')({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      PUT: ({ request }) => handle(request),
      DELETE: ({ request }) => handle(request),
    },
  },
})
