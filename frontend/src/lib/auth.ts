export type User = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'ADMIN' | 'MANAGER' | 'SALES_REP'
  managerId?: string | null
  termsAcceptedAt?: string | null
}

export function saveAuth(token: string, user: User) {
  const existingRaw = localStorage.getItem('auth_user')
  let existing: User | null = null
  try { existing = existingRaw ? JSON.parse(existingRaw) as User : null } catch { existing = null }
  const merged: User = (() => {
    if (existing && existing.id === user.id && existing.termsAcceptedAt && !user.termsAcceptedAt) {
      return { ...user, termsAcceptedAt: existing.termsAcceptedAt }
    }
    return user
  })()
  localStorage.setItem('auth_token', token)
  localStorage.setItem('auth_user', JSON.stringify(merged))
}

export function getToken() {
  return localStorage.getItem('auth_token')
}

export function getUser(): User | null {
  const raw = localStorage.getItem('auth_user')
  try { return raw ? JSON.parse(raw) as User : null } catch { return null }
}

export function clearAuth() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
}


