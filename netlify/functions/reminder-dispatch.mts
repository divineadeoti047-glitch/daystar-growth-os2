import type { Config } from '@netlify/functions'
import webpush from 'web-push'
import { and, eq } from 'drizzle-orm'
import { database } from '../../db/index'
import { pushDevices, workspaces } from '../../db/schema'
import { dateKey, dueReminders, workspaceSchema } from '../../src/lib/model'
import { trustedPushEndpoint } from '../lib/push'

// Netlify invokes scheduled functions only on published deploys. This is not a public record API.
export default async () => {
  const publicKey = Netlify.env.get('DAYSTAR_PUSH_PUBLIC_KEY')
  const privateKey = Netlify.env.get('DAYSTAR_PUSH_PRIVATE_KEY')
  const subject = Netlify.env.get('DAYSTAR_PUSH_SUBJECT')
  if (!publicKey || !privateKey || !subject) return
  const db = database()
  // Subscriptions contain private capabilities. Never log them or provider failures.
  const devices = await db.select().from(pushDevices)
  const groups = new Map<string, typeof devices>()
  for (const device of devices)
    groups.set(device.owner, [...(groups.get(device.owner) ?? []), device])
  const now = new Date()
  for (const [owner, subscriptions] of groups) {
    const [row] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.owner, owner))
    const parsed = workspaceSchema.safeParse(row?.data)
    if (!row || !parsed.success) continue
    const w = parsed.data
    const today = dateKey(w.preferences.timezone, now)
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: w.preferences.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now)
    const due = dueReminders(w, today, time)
    if (!due.length) continue
    const ids = new Set(due.map((r) => r.id))
    const next = {
      ...w,
      reminders: w.reminders.map((r) =>
        ids.has(r.id) ? { ...r, lastDelivered: today } : r,
      ),
    }
    // Claim before delivery using the same revision guard as client writes. Concurrent dispatch
    // or an open page cannot claim the same occurrence twice. Delivery is at most once.
    const claimed = await db
      .update(workspaces)
      .set({ data: next, revision: row.revision + 1, updatedAt: now })
      .where(
        and(eq(workspaces.owner, owner), eq(workspaces.revision, row.revision)),
      )
      .returning({ revision: workspaces.revision })
    if (!claimed.length) continue
    await Promise.allSettled(
      subscriptions.map(async (device) => {
        if (!trustedPushEndpoint(device.subscription.endpoint)) return
        try {
          await webpush.sendNotification(
            device.subscription,
            JSON.stringify({
              title: 'DAYSTAR · Your next small step',
              body: 'A scheduled commitment is ready. Open your private workspace to see it.',
            }),
            {
              vapidDetails: { subject, publicKey, privateKey },
              TTL: 1800,
              timeout: 5000,
              urgency: 'normal',
            },
          )
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode
          if (status === 404 || status === 410)
            await db.delete(pushDevices).where(eq(pushDevices.id, device.id))
        }
      }),
    )
  }
}
export const config: Config = { schedule: '* * * * *' }
