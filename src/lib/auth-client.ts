import { createAuthClient } from 'better-auth/react'

const client = createAuthClient()

function ensureSuccess<T>(result: { data: T | null; error: { message?: string } | null }) {
  if (result.error || !result.data)
    throw new Error(result.error?.message ?? 'The account request failed.')
  return result.data
}

export async function getUser() {
  const result = await client.getSession()
  return result.data?.user ?? null
}

export async function login(email: string, password: string) {
  const user = ensureSuccess(await client.signIn.email({ email, password })).user
  return { ...user, confirmedAt: new Date().toISOString() }
}

export async function signup(
  email: string,
  password: string,
  metadata: { full_name?: string },
) {
  const user = ensureSuccess(
    await client.signUp.email({
      email,
      password,
      name: metadata.full_name?.trim() || email,
    }),
  ).user
  return { ...user, confirmedAt: new Date().toISOString() }
}

export async function logout() {
  ensureSuccess(await client.signOut())
}

export async function requestPasswordRecovery(_email: string) {
  throw new Error(
    'Password recovery email is not configured yet. Keep your password somewhere safe.',
  )
}

export async function updateUser(_input: { password: string }) {
  throw new Error('Password recovery is not configured for this project yet.')
}
