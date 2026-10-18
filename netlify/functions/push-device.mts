import type { Context } from '@netlify/functions'
import { and, eq } from 'drizzle-orm'
import { database } from '../../db/index'
import { pushDevices } from '../../db/schema'
import { ownerScope, pushId, pushOwner, subscriptionSchema } from '../lib/push'

export default async (req: Request, context: Context) => {
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!['GET', 'PUT', 'DELETE'].includes(req.method))
    return new Response(null, { status: 405, headers })
  if (
    req.method !== 'GET' &&
    req.headers.get('origin') !== new URL(req.url).origin
  )
    return new Response(null, { status: 403, headers })
  try {
    const owner = await pushOwner(context)
    if (!owner) return new Response(null, { status: 401, headers })
    const publicKey = Netlify.env.get('DAYSTAR_PUSH_PUBLIC_KEY')
    const configured = !!(
      publicKey &&
      Netlify.env.get('DAYSTAR_PUSH_PRIVATE_KEY') &&
      Netlify.env.get('DAYSTAR_PUSH_SUBJECT')
    )
    if (req.method === 'GET') {
      const devices = await database()
        .select({ id: pushDevices.id })
        .from(pushDevices)
        .where(eq(pushDevices.owner, owner))
      return Response.json(
        {
          configured,
          publicKey: configured ? publicKey : null,
          deviceIds: devices.map((d) => d.id),
        },
        { headers },
      )
    }
    const text = await req.text()
    if (text.length > 6000) return new Response(null, { status: 413, headers })
    let body
    try {
      body = JSON.parse(text)
    } catch {
      return new Response(null, { status: 400, headers })
    }
    if (!body || body.scope !== ownerScope(owner))
      return new Response(null, { status: 401, headers })
    const parsed = subscriptionSchema.safeParse(body.subscription)
    if (!parsed.success) return new Response(null, { status: 400, headers })
    const db = database(),
      id = pushId(parsed.data.endpoint)
    if (req.method === 'DELETE') {
      await db
        .delete(pushDevices)
        .where(and(eq(pushDevices.owner, owner), eq(pushDevices.id, id)))
      return Response.json({ saved: true }, { headers })
    }
    if (!configured)
      return Response.json(
        { error: 'Background push is not configured yet.' },
        { status: 503, headers },
      )
    const devices = await db
      .select({ id: pushDevices.id })
      .from(pushDevices)
      .where(eq(pushDevices.owner, owner))
    if (devices.length >= 10 && !devices.some((d) => d.id === id))
      return Response.json(
        {
          error:
            'The device limit has been reached. Disable an older device first.',
        },
        { status: 409, headers },
      )
    await db
      .insert(pushDevices)
      .values({ id, owner, subscription: parsed.data })
      .onConflictDoUpdate({
        target: pushDevices.id,
        set: { owner, subscription: parsed.data, updatedAt: new Date() },
      })
    return Response.json({ saved: true }, { headers })
  } catch {
    return Response.json(
      { error: 'Notification settings are unavailable. Please retry.' },
      { status: 503, headers },
    )
  }
}
