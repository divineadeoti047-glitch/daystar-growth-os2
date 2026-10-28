import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { database } from '../../db'
import { account, session, user, verification } from '../../db/schema'

export function getAuth() {
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.DATABASE_URL
  if (!secret) throw new Error('Database setup is required before sign-in.')
  const baseURL =
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000')
  return betterAuth({
    appName: 'DAYSTAR',
    secret,
    baseURL,
    database: drizzleAdapter(database(), {
      provider: 'pg',
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [tanstackStartCookies()],
  })
}
