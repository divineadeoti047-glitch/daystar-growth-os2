// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@netlify/functions'
import { initialWorkspace } from './model'
const f = vi.hoisted(() => ({
  user: null as { id: string } | null,
  rows: new Map<string, { owner: string; data: unknown; revision: number }>(),
  unavailable: false,
}))
vi.mock('@netlify/identity', () => ({ getUser: async () => f.user }))
vi.mock('drizzle-orm', () => ({
  eq: (column: string, value: unknown) => ({ column, value }),
  and: (...items: unknown[]) => items,
}))
vi.mock('../../db/schema', () => ({
  workspaces: { owner: 'owner', revision: 'revision' },
}))
vi.mock('../../db/index', () => ({
  database: () => ({
    select: () => ({
      from: () => ({
        where: async (c: { value: string }) => {
          if (f.unavailable) throw new Error('unavailable')
          return f.rows.has(c.value) ? [f.rows.get(c.value)] : []
        },
      }),
    }),
    insert: () => ({
      values: (row: { owner: string; data: unknown }) => ({
        onConflictDoNothing: async () => {
          if (f.unavailable) throw new Error('unavailable')
          if (!f.rows.has(row.owner))
            f.rows.set(row.owner, { ...row, revision: 0 })
        },
      }),
    }),
    update: () => ({
      set: (value: { data: unknown; revision: number }) => ({
        where: (conditions: { column: string; value: unknown }[]) => ({
          returning: async () => {
            if (f.unavailable) throw new Error('unavailable')
            const owner = conditions.find((c) => c.column === 'owner')!
              .value as string
            const revision = conditions.find(
              (c) => c.column === 'revision',
            )!.value
            const row = f.rows.get(owner)
            if (!row || row.revision !== revision) return []
            f.rows.set(owner, { ...row, ...value })
            return [{ revision: value.revision }]
          },
        }),
      }),
    }),
  }),
}))
import handler from '../../netlify/functions/workspace.mts'
function browser() {
  const cookies = new Map<string, string>()
  const context = {
    cookies: {
      get: (key: string) => cookies.get(key),
      set: (cookie: { name: string; value: string }) =>
        cookies.set(cookie.name, cookie.value),
    },
  } as unknown as Context
  return {
    cookies,
    request: (
      method = 'GET',
      body?: unknown,
      origin = 'https://daystar.example',
    ) =>
      handler(
        new Request('https://daystar.example/.netlify/functions/workspace', {
          method,
          headers: { origin, 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
        context,
      ),
  }
}
beforeEach(() => {
  f.user = null
  f.rows.clear()
  f.unavailable = false
})
describe('private, conflict-safe workspace API', () => {
  it('isolates browser workspaces with a server-issued cookie', async () => {
    const a = browser(),
      b = browser()
    const first = await (await a.request()).json()
    const next = {
      ...initialWorkspace(),
      preferences: { ...initialWorkspace().preferences, name: 'First browser' },
    }
    expect(
      (await a.request('PUT', { data: next, revision: 0, scope: first.scope }))
        .status,
    ).toBe(200)
    const second = await (await b.request()).json()
    expect(second.data.preferences.name).toBe('')
    expect(second.scope).not.toBe(first.scope)
    expect(a.cookies.has('daystar_device')).toBe(true)
  })
  it('isolates accounts regardless of supplied user IDs', async () => {
    const client = browser()
    f.user = { id: 'account-a' }
    const a = await (await client.request()).json()
    const data = initialWorkspace()
    data.preferences.name = 'Private account'
    expect(
      (
        await client.request('PUT', {
          data,
          scope: a.scope,
          revision: 0,
          userId: 'account-b',
        })
      ).status,
    ).toBe(200)
    f.user = { id: 'account-b' }
    const b = await (await client.request()).json()
    expect(b.data.preferences.name).toBe('')
    expect(
      (await client.request('PUT', { data, scope: a.scope, revision: 0 }))
        .status,
    ).toBe(401)
    f.user = { id: 'account-a' }
    expect((await (await client.request()).json()).data.preferences.name).toBe(
      'Private account',
    )
  })
  it('rejects stale writes instead of losing another device’s changes', async () => {
    const c = browser()
    const row = await (await c.request()).json()
    const payload = {
      data: initialWorkspace(),
      revision: row.revision,
      scope: row.scope,
    }
    expect((await c.request('PUT', payload)).status).toBe(200)
    expect((await c.request('PUT', payload)).status).toBe(409)
  })
  it('rejects account data writes after session expiry', async () => {
    const c = browser()
    f.user = { id: 'account-a' }
    const row = await (await c.request()).json()
    f.user = null
    expect(
      (
        await c.request('PUT', {
          data: initialWorkspace(),
          revision: 0,
          scope: row.scope,
        })
      ).status,
    ).toBe(401)
  })
  it('rejects cross-origin writes, invalid payloads and destructive methods', async () => {
    const c = browser()
    const row = await (await c.request()).json()
    expect(
      (await c.request('PUT', {}, 'https://different.example')).status,
    ).toBe(403)
    expect((await c.request('DELETE')).status).toBe(405)
    expect(
      (await c.request('PUT', { scope: row.scope, revision: 0, data: {} }))
        .status,
    ).toBe(400)
  })
  it('returns private no-store headers and a safe error when database is unavailable', async () => {
    const c = browser()
    f.unavailable = true
    const res = await c.request()
    expect(res.status).toBe(503)
    expect(res.headers.get('Cache-Control')).toContain('no-store')
    expect(JSON.stringify(await res.json())).not.toContain('unavailable at')
  })
})
