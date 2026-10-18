import { pgTable, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core'
import type { Workspace } from '../src/lib/model'
export const workspaces = pgTable('daystar_v2_workspaces', {
  owner: text('owner').primaryKey(),
  data: jsonb('data').$type<Workspace>().notNull(),
  revision: integer('revision').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  coachLastAt: timestamp('coach_last_at'),
})

// Push capabilities are server-only and deliberately excluded from JSON backups.
export const pushDevices = pgTable('daystar_v2_push_devices', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull(),
  subscription: jsonb('subscription')
    .$type<{ endpoint: string; keys: { p256dh: string; auth: string } }>()
    .notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
