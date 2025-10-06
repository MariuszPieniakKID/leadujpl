import { useEffect, useState } from 'react'
import { getPendingCount } from '../lib/offline'
import { getToken } from '../lib/auth'

export default function SyncStatus() {
  const [pending, setPending] = useState(0)
  const [last, setLast] = useState<number | null>(null)
  const [isOfflineLogin, setIsOfflineLogin] = useState(false)

  async function refresh() {
    const c = await getPendingCount()
    setPending(c)
    try { const v = localStorage.getItem('offline_last_sync'); setLast(v ? Number(v) : null) } catch { setLast(null) }
    
    // Check if user is logged in with offline credentials
    try {
      const token = getToken()
      if (token) {
        const payload = JSON.parse(atob(token))
        setIsOfflineLogin(payload.offline === true)
      }
    } catch {
      setIsOfflineLogin(false)
    }
  }

  useEffect(() => {
    refresh()
    const onDone = () => refresh()
    window.addEventListener('offline-sync-complete', onDone as any)
    return () => window.removeEventListener('offline-sync-complete', onDone as any)
  }, [])

  const lastLabel = last ? new Date(last).toLocaleTimeString() : '—'
  return (
    <div className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: '8px' }}>
      {isOfflineLogin && (
        <span style={{ 
          color: 'var(--warning-700)', 
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1h15M1 7h15M1 13h15"/>
            <path strokeDasharray="2 3" d="M17 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"/>
          </svg>
          Offline
        </span>
      )}
      <span>Sync: {pending > 0 ? `${pending} w kolejce` : 'OK'}</span>
      <span>Ost.: {lastLabel}</span>
    </div>
  )
}


