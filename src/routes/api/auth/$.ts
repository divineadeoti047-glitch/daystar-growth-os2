import { createFileRoute } from '@tanstack/react-router'
import { ensureDatabase } from '../../../../db'
import { getAuth } from '@/lib/auth-server'

async function handle(request: Request) {
  try {
    await ensureDatabase()
    return await getAuth().handler(request)
  } catch {
    return Response.json(
      { message: 'Account services are not configured yet.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
})
