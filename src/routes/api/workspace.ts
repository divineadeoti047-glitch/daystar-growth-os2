import { createHash, randomBytes } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { createFileRoute } from '@tanstack/react-router'
import { database, ensureDatabase } from '../../../db'
import { workspaces } from '../../../db/schema'
import { getAuth } from '@/lib/auth-server'
import { initialWorkspace, workspaceSchema } from '@/lib/model'

const headers = { 'Cache-Control': 'private, no-store' }

function deviceCookie(request: Request) {
  const raw = request.headers.get('cookie') ?? ''
  const value = raw
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('daystar_device='))
    ?.slice('daystar_device='.length)
  if (value && /^[a-f0-9]{64}$/.test(value)) return { value, created: false }
  return { value: randomBytes(32).toString('hex'), created: true }
}

function reply(body: unknown, status = 200, device?: string) {
  const responseHeaders = new Headers(headers)
  if (device)
    responseHeaders.append(
      'Set-Cookie',
      `daystar_device=${device}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`,
    )
  return Response.json(body, { status, headers: responseHeaders })
}

async function handle(request: Request) {
  if (!['GET', 'PUT'].includes(request.method))
    return reply('Method not allowed', 405)
  if (
    request.method !== 'GET' &&
    request.headers.get('origin') !== new URL(request.url).origin
  )
    return reply('Forbidden', 403)

  try {
    await ensureDatabase()
    const session = await getAuth().api.getSession({ headers: request.headers })
    const device = deviceCookie(request)
    const owner = session
      ? `user:${session.user.id}`
      : `device:${createHash('sha256').update(device.value).digest('hex')}`
    const scope = createHash('sha256').update(owner).digest('hex')
    const db = database()

    if (request.method === 'GET') {
      const empty = initialWorkspace()
      const timezone = new URL(request.url).searchParams.get('timezone')
      if (timezone) {
        try {
          new Intl.DateTimeFormat('en', { timeZone: timezone })
          empty.preferences.timezone = timezone
        } catch {
          // Keep UTC for invalid time zones.
        }
      }
      await db.insert(workspaces).values({ owner, data: empty }).onConflictDoNothing()
      const [row] = await db.select().from(workspaces).where(eq(workspaces.owner, owner))
      if (!row) return reply({ error: 'Workspace could not be created.' }, 503)
      return reply(
        {
          data: row.data,
          revision: row.revision,
          scope,
          mode: session ? 'account' : 'device',
        },
        200,
        device.created ? device.value : undefined,
      )
    }

    const raw = await request.text()
    if (raw.length > 4000000) return reply({ error: 'Backup too large' }, 413)
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return reply({ error: 'Invalid JSON.' }, 400)
    }
    if (!parsed || typeof parsed !== 'object')
      return reply({ error: 'Invalid payload.' }, 400)
    const payload = parsed as { scope?: unknown; data?: unknown; revision?: unknown }
    if (payload.scope !== scope)
      return reply(
        {
          error:
            'Your session changed or expired. Sign in again before saving. Your form is still available.',
        },
        401,
      )
    const valid = workspaceSchema.safeParse(payload.data)
    if (!valid.success || !Number.isInteger(payload.revision))
      return reply({ error: 'The records did not pass validation.' }, 400)
    const [row] = await db
      .update(workspaces)
      .set({
        data: valid.data,
        revision: (payload.revision as number) + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaces.owner, owner),
          eq(workspaces.revision, payload.revision as number),
        ),
      )
      .returning({ revision: workspaces.revision })
    if (!row)
      return reply(
        {
          error:
            'Another device changed this workspace. Copy any unsaved form text, then retry. Your saved records have not been overwritten.',
        },
        409,
      )
    return reply(row)
  } catch {
    return reply(
      { error: 'Your workspace is unavailable. Please retry; no changes were discarded.' },
      503,
    )
  }
}

export const Route = createFileRoute('/api/workspace')({
  server: { handlers: { GET: ({ request }) => handle(request), PUT: ({ request }) => handle(request) } },
})
