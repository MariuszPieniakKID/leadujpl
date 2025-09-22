export type User = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'ADMIN' | 'MANAGER' | 'SALES_REP'
  managerId?: string | null
}

export function saveAuth(token: string, user: User) {
  localStorage.setItem('auth_token', token)
  localStorage.setItem('auth_user', JSON.stringify(user))
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


