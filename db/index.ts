import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

let db: ReturnType<typeof drizzle> | undefined

export function database() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not configured.')
  db ??= drizzle({ client: neon(url), schema })
  return db
}

let schemaPromise: Promise<void> | undefined

export function ensureDatabase() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not configured.')
  if (!schemaPromise) {
    const sql = neon(url)
    schemaPromise = (async () => {
      const statements = [
        `CREATE TABLE IF NOT EXISTS daystar_v2_workspaces (owner text PRIMARY KEY, data jsonb NOT NULL, revision integer NOT NULL DEFAULT 0, updated_at timestamp NOT NULL DEFAULT now(), coach_last_at timestamp)`,
        `CREATE TABLE IF NOT EXISTS daystar_v2_push_devices (id text PRIMARY KEY, owner text NOT NULL, subscription jsonb NOT NULL, updated_at timestamp NOT NULL DEFAULT now())`,
        `CREATE TABLE IF NOT EXISTS "user" (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, email_verified boolean NOT NULL DEFAULT false, image text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`,
        `CREATE TABLE IF NOT EXISTS "session" (id text PRIMARY KEY, expires_at timestamp NOT NULL, token text NOT NULL UNIQUE, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), ip_address text, user_agent text, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE)`,
        `CREATE INDEX IF NOT EXISTS session_userId_idx ON "session" (user_id)`,
        `CREATE TABLE IF NOT EXISTS "account" (id text PRIMARY KEY, account_id text NOT NULL, provider_id text NOT NULL, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, access_token text, refresh_token text, id_token text, access_token_expires_at timestamp, refresh_token_expires_at timestamp, scope text, password text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`,
        `CREATE INDEX IF NOT EXISTS account_userId_idx ON "account" (user_id)`,
        `CREATE TABLE IF NOT EXISTS "verification" (id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamp NOT NULL, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`,
        `CREATE INDEX IF NOT EXISTS verification_identifier_idx ON "verification" (identifier)`,
      ]
      for (const statement of statements) await sql.query(statement)
    })().catch((error) => {
      schemaPromise = undefined
      throw error
    })
  }
  return schemaPromise
}
