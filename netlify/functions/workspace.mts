import { getUser } from '@netlify/identity'
import { createHash, randomBytes } from 'node:crypto'
import type { Context } from '@netlify/functions'
import { and, eq } from 'drizzle-orm'
import { database } from '../../db/index'
import { workspaces } from '../../db/schema'
import { initialWorkspace, workspaceSchema } from '../../src/lib/model'
export default async (req: Request, context: Context) => {
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!['GET', 'PUT'].includes(req.method))
    return new Response('Method not allowed', { status: 405, headers })
  if (
    req.method !== 'GET' &&
    req.headers.get('origin') !== new URL(req.url).origin
  )
    return new Response('Forbidden', { status: 403, headers })
  try {
    const user = await getUser()
    let device = context.cookies.get('daystar_device')
    if (!device || !/^[a-f0-9]{64}$/.test(device)) {
      device = randomBytes(32).toString('hex')
      context.cookies.set({
        name: 'daystar_device',
        value: device,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 31536000,
      })
    }
    const owner = user
      ? `user:${user.id}`
      : `device:${createHash('sha256').update(device).digest('hex')}`
    const scope = createHash('sha256').update(owner).digest('hex')
    const db = database()
    if (req.method === 'GET') {
      const empty = initialWorkspace()
      const timezone = new URL(req.url).searchParams.get('timezone')
      if (timezone) {
        try {
          new Intl.DateTimeFormat('en', { timeZone: timezone })
          empty.preferences.timezone = timezone
        } catch {
          /* Keep UTC for invalid time zones. */
        }
      }
      await db
        .insert(workspaces)
        .values({ owner, data: empty })
        .onConflictDoNothing()
      const [row] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.owner, owner))
      return Response.json(
        {
          data: row.data,
          revision: row.revision,
          scope,
          mode: user ? 'account' : 'device',
        },
        { headers },
      )
    }
    const raw = await req.text()
    if (raw.length > 4000000)
      return new Response('Backup too large', { status: 413, headers })
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return Response.json({ error: 'Invalid JSON.' }, { status: 400, headers })
    }
    if (!parsed || typeof parsed !== 'object')
      return Response.json(
        { error: 'Invalid payload.' },
        { status: 400, headers },
      )
    if (parsed.scope !== scope)
      return Response.json(
        {
          error:
            'Your session changed or expired. Sign in again before saving. Your form is still available.',
        },
        { status: 401, headers },
      )
    const valid = workspaceSchema.safeParse(parsed.data)
    if (!valid.success || !Number.isInteger(parsed.revision))
      return Response.json(
        { error: 'The records did not pass validation.' },
        { status: 400, headers },
      )
    const [row] = await db
      .update(workspaces)
      .set({
        data: valid.data,
        revision: parsed.revision + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(workspaces.owner, owner),
          eq(workspaces.revision, parsed.revision),
        ),
      )
      .returning({ revision: workspaces.revision })
    if (!row)
      return Response.json(
        {
          error:
            'Another device changed this workspace. Copy any unsaved form text, then use Retry connection and submit again. Your saved records have not been overwritten.',
        },
        { status: 409, headers },
      )
    return Response.json(row, { headers })
  } catch {
    return Response.json(
      {
        error:
          'Your workspace is unavailable. Please retry; no changes were discarded.',
      },
      { status: 503, headers },
    )
  }
}
