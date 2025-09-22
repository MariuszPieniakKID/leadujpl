import { useEffect, useState } from 'react'
import { getPendingCount } from '../lib/offline'

export default function SyncStatus() {
  const [pending, setPending] = useState(0)
  const [last, setLast] = useState<number | null>(null)

  async function refresh() {
    const c = await getPendingCount()
    setPending(c)
    try { const v = localStorage.getItem('offline_last_sync'); setLast(v ? Number(v) : null) } catch { setLast(null) }
  }

  useEffect(() => {
    refresh()
    const onDone = () => refresh()
    window.addEventListener('offline-sync-complete', onDone as any)
    return () => window.removeEventListener('offline-sync-complete', onDone as any)
  }, [])

  const lastLabel = last ? new Date(last).toLocaleTimeString() : '—'
  return (
    <div className="muted" style={{ fontSize: 12 }}>
      <span>Sync: {pending > 0 ? `${pending} w kolejce` : 'OK'}</span>
      <span style={{ marginLeft: 8 }}>Ost.: {lastLabel}</span>
    </div>
  )
}


