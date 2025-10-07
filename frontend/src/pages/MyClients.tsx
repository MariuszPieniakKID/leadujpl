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
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Moi klienci</h1>
          <p className="text-gray-600">Klienci z którymi miałeś spotkania</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
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
        <div className="text-error text-sm p-3 bg-error-50 rounded border border-error-200 mb-6">
          {error}
        </div>
      )}

      {/* Clients List */}
      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Ładowanie…</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg style={{ margin: '0 auto 1rem', display: 'block' }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
              <path d="m22 2-5 5M17 2l5 5"/>
            </svg>
            <p>Brak klientów</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
            {clients.map(c => (
              <Link 
                key={c.id} 
                to={`/my-clients/${c.id}`} 
                className="list-item" 
                style={{ 
                  textDecoration: 'none', 
                  color: 'inherit', 
                  transition: 'all 0.2s ease', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-xl)',
                  background: 'white',
                  border: '1px solid var(--gray-200)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                  <span style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>{c.firstName} {c.lastName}</span>
                  <span style={{ color: 'var(--gray-600)', fontSize: 'var(--text-sm)' }}>{c.phone || c.email || '—'}</span>
                  {c.city && <span style={{ color: 'var(--gray-500)', fontSize: 'var(--text-xs)' }}>📍 {c.city}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--primary-600)' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Zobacz</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
