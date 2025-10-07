import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getUser } from '../lib/auth'
import api from '../lib/api'
import { offlineStore } from '../lib/offline'

type Client = {
  id: string
  firstName: string
  lastName: string
  phone?: string | null
  email?: string | null
  street?: string | null
  city?: string | null
  category?: string | null
}

export default function MyClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [scope, setScope] = useState<'mine' | 'team'>('mine')
  const user = getUser()

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const isManager = user && user.role === 'MANAGER'
      if (isManager && scope === 'team') {
        const res = await api.get<Client[]>('/api/clients', { params: { q: query || undefined, status: status || undefined, scope: 'team' } })
        setClients(res.data)
        try { for (const c of res.data) { await offlineStore.put('clients', c as any) } } catch {}
      } else {
        const res = await api.get<Client[]>('/api/clients/mine', { params: { q: query || undefined, status: status || undefined } })
        setClients(res.data)
        try { for (const c of res.data) { await offlineStore.put('clients', c as any) } } catch {}
      }
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Błąd ładowania klientów')
      try {
        const local = await offlineStore.getAll<Client>('clients')
        const q = (query || '').trim().toLowerCase()
        const filtered = (local || []).filter(c => {
          if (!q) return true
          const hay = [c.firstName, c.lastName, c.phone, c.email, c.city, c.street].filter(Boolean).join(' ').toLowerCase()
          return hay.includes(q)
        })
        setClients(filtered)
      } catch {}
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="app-wrapper">
      <div className="app-content">
        <div className="container">
          <div className="page-header">
            <div>
              <h1 className="page-title">👤 Moi klienci</h1>
              <p className="page-subtitle">Klienci z którymi miałeś spotkania</p>
            </div>
          </div>

          {/* Filters */}
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="form-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Szukaj</label>
                <input 
                  className="form-input" 
                  placeholder="Nazwisko, telefon..." 
                  value={query} 
                  onChange={e => setQuery(e.target.value)} 
                  onKeyDown={e => { if (e.key === 'Enter') load() }} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Status</label>
                <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="">Wszystkie</option>
                  <option value="Sukces">Sukces</option>
                  <option value="Umowa">Umowa</option>
                  <option value="Rezygnacja">Rezygnacja</option>
                  <option value="Przełożone">Przełożone</option>
                </select>
              </div>
              {user && user.role === 'MANAGER' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Zakres</label>
                  <select className="form-select" value={scope} onChange={e => setScope(e.target.value as 'mine' | 'team')}>
                    <option value="mine">Moi klienci</option>
                    <option value="team">Zespół</option>
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', alignItems: 'center' }}>
              <button className="secondary" onClick={load}>Filtruj</button>
              <span className="text-sm text-gray-500">{clients.length} klientów</span>
            </div>
          </div>

          {error && (
            <div className="text-error text-sm" style={{ padding: 'var(--space-3)', background: 'var(--error-50)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--error-200)', marginBottom: 'var(--space-6)' }}>
              {error}
            </div>
          )}

          {/* Clients List */}
          <div className="card">
            {loading ? (
              <div className="loading">Ładowanie…</div>
            ) : clients.length === 0 ? (
              <div className="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <path d="m22 2-5 5M17 2l5 5"/>
                </svg>
                <div className="empty-state-title">Brak klientów</div>
              </div>
            ) : (
              <div className="list">
                {clients.map(c => (
                  <Link 
                    key={c.id} 
                    to={`/my-clients/${c.id}`} 
                    className="list-item"
                  >
                    <div className="list-item-content">
                      <div className="list-item-title">{c.firstName} {c.lastName}</div>
                      <div className="list-item-subtitle">{c.phone || c.email || '—'}</div>
                      {c.city && <div className="list-item-meta">📍 {c.city}</div>}
                    </div>
                    <div className="list-item-arrow">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m9 18 6-6-6-6"/>
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
