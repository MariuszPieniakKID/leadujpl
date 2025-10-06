export type User = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'ADMIN' | 'MANAGER' | 'SALES_REP'
  managerId?: string | null
  termsAcceptedAt?: string | null
}

type OfflineCredentials = {
  email: string
  passwordHash: string
  user: User
  savedAt: number
}

// Simple hash function for storing password offline
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Save credentials for offline use after successful online login
export async function saveOfflineCredentials(email: string, password: string, user: User) {
  try {
    const passwordHash = await hashPassword(password)
    const credentials: OfflineCredentials = {
      email: email.toLowerCase().trim(),
      passwordHash,
      user,
      savedAt: Date.now()
    }
    localStorage.setItem('offline_credentials', JSON.stringify(credentials))
    console.log('[Auth] Offline credentials saved for:', email)
  } catch (err) {
    console.error('[Auth] Failed to save offline credentials:', err)
  }
}

// Verify credentials for offline login
export async function verifyOfflineCredentials(email: string, password: string): Promise<User | null> {
  try {
    const credentialsRaw = localStorage.getItem('offline_credentials')
    if (!credentialsRaw) return null
    
    const credentials: OfflineCredentials = JSON.parse(credentialsRaw)
    const inputEmail = email.toLowerCase().trim()
    
    // Check if email matches
    if (credentials.email !== inputEmail) {
      return null
    }
    
    // Hash the input password and compare
    const inputHash = await hashPassword(password)
    if (credentials.passwordHash !== inputHash) {
      return null
    }
    
    // Credentials match - return the stored user
    console.log('[Auth] Offline login successful for:', email)
    return credentials.user
  } catch (err) {
    console.error('[Auth] Failed to verify offline credentials:', err)
    return null
  }
}

// Generate a temporary offline token
export function generateOfflineToken(user: User): string {
  // Create a simple JWT-like token for offline use
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    offline: true,
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  }
  return btoa(JSON.stringify(payload))
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
  localStorage.removeItem('offline_credentials')
}


