import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { isValidPolishPhone, polishPhoneHtmlPattern, polishPhoneTitle } from '../lib/phone'
import { getUser } from '../lib/auth'
import { fetchUsers, type AppUserSummary } from '../lib/api'
import { fetchClients, createClient, type Client } from '../lib/api'
import { offlineStore, pendingQueue, newLocalId } from '../lib/offline'

export default function ClientsPage() {
  const user = getUser()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Partial<Client>>({ firstName: '', lastName: '', phone: '', email: '', street: '', city: '', postalCode: '', category: '' })

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [addedToday, setAddedToday] = useState(false)
  const [sortBy, setSortBy] = useState('name')
  const [managers, setManagers] = useState<AppUserSummary[]>([])
  const [managerId, setManagerId] = useState('')

  async function load() {
    setLoading(true)
    try {
      let params: any = { 
        q: query || undefined, 
        status: status || undefined,
        addedToday: addedToday ? 'true' : undefined,
        sortBy: sortBy || undefined
      }
      if (user && user.role === 'MANAGER') params.scope = 'team'
      if (user && user.role === 'ADMIN' && managerId) params.managerId = managerId
      const data = await fetchClients(params)
      setClients(data)
      try { for (const c of data) { await offlineStore.put('clients', c as any) } } catch {}
    } catch (e) {
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

  useEffect(() => {
    if (!(user && user.role === 'ADMIN')) return
    ;(async () => {
      try {
        const all = await fetchUsers()
        setManagers(all.filter(u => u.role === 'MANAGER'))
      } catch {}
    })()
  }, [user?.role])

  useEffect(() => {
    function onOfflineClientAdded(e: any) {
      const c = e?.detail?.client as Client | undefined
      if (!c) return
      setClients(prev => {
        if (prev.find(x => x.id === (c as any).id)) return prev
        return [c, ...prev]
      })
    }
    window.addEventListener('offline-client-added', onOfflineClientAdded as any)
    return () => window.removeEventListener('offline-client-added', onOfflineClientAdded as any)
  }, [])

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    if (!form.firstName || !form.lastName) { setCreateError('Imię i nazwisko są wymagane'); return }
    if (form.phone && !isValidPolishPhone(form.phone)) { setCreateError('Nieprawidłowy numer telefonu (PL)'); return }
    const payload = {
      firstName: form.firstName!, lastName: form.lastName!, phone: form.phone || undefined, email: form.email || undefined,
      street: form.street || undefined, city: form.city || undefined, postalCode: form.postalCode || undefined, category: form.category || undefined,
    } as any
    if (navigator.onLine) {
      await createClient(payload)
    } else {
      const localId = newLocalId('client')
      const optimistic = { id: localId, ...payload }
      await offlineStore.put('clients', optimistic)
      setClients(prev => [optimistic as any, ...prev])
      await pendingQueue.enqueue({ id: newLocalId('att'), method: 'POST', url: (import.meta.env.VITE_API_BASE || '') + '/api/clients', body: payload, headers: {}, createdAt: Date.now(), entityStore: 'clients', localId })
    }
    setForm({ firstName: '', lastName: '', phone: '', email: '', street: '', city: '', postalCode: '', category: '' })
    setIsCreateOpen(false)
    await load()
  }

  return (
    <div className="app-wrapper">
      <div className="app-content">
        <div className="container">
          <div className="page-header">
            <div>
              <h1 className="page-title">👥 Klienci</h1>
              <p className="page-subtitle">Zarządzaj bazą klientów</p>
            </div>
            <div className="page-header-actions">
              <button className="primary" onClick={() => setIsCreateOpen(true)}>+ Dodaj klienta</button>
            </div>
          </div>

          {/* Filters */}
          <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
            <div className="form-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Szukaj</label>
                <input className="form-input" placeholder="Nazwisko, telefon..." value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load() }} />
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
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Sortuj</label>
                <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="name">Alfabetycznie</option>
                  <option value="dateDesc">Najnowsi</option>
                  <option value="dateAsc">Najstarsi</option>
                </select>
              </div>
              {user && user.role === 'ADMIN' && managers.length > 0 && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Manager</label>
                  <select className="form-select" value={managerId} onChange={e => setManagerId(e.target.value)}>
                    <option value="">Wszyscy</option>
                    {managers.map(m => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={addedToday} onChange={e => setAddedToday(e.target.checked)} />
                <span className="text-sm">Dodani dzisiaj</span>
              </label>
              <button className="secondary" onClick={load}>Filtruj</button>
              {user && user.role === 'ADMIN' && (
                <button className="primary" onClick={() => exportCsv(clients)}>Eksport do CSV</button>
              )}
              <span className="text-sm text-gray-500" style={{ flex: '0 0 auto' }}>{clients.length} klientów</span>
            </div>
          </div>

          {/* Create Modal */}
          {isCreateOpen && (
            <div className="modal-overlay" onClick={() => setIsCreateOpen(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 className="modal-title">Nowy klient</h3>
                  <button className="secondary" onClick={() => setIsCreateOpen(false)} style={{ padding: 'var(--space-2)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                <form onSubmit={onSubmit}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">Imię</label>
                      <input className="form-input" placeholder="Imię" value={form.firstName || ''} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nazwisko</label>
                      <input className="form-input" placeholder="Nazwisko" value={form.lastName || ''} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Telefon</label>
                      <input className="form-input" placeholder="Telefon" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} pattern={polishPhoneHtmlPattern} title={polishPhoneTitle} inputMode="tel" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">E-mail</label>
                      <input className="form-input" placeholder="E-mail" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Ulica i numer domu</label>
                      <input className="form-input" placeholder="Ulica i numer domu" value={form.street || ''} onChange={e => setForm({ ...form, street: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Miasto</label>
                      <input className="form-input" placeholder="Miasto" value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kod pocztowy</label>
                      <input className="form-input" placeholder="Kod pocztowy" value={form.postalCode || ''} onChange={e => setForm({ ...form, postalCode: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kategoria</label>
                      <select className="form-select" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value as any })}>
                        <option value="">— wybierz —</option>
                        <option value="PV">PV</option>
                        <option value="ME">ME</option>
                      </select>
                    </div>
                  </div>
                  {createError && <div className="text-error text-sm" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--error-50)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--error-200)' }}>{createError}</div>}
                  <div className="modal-footer">
                    <button className="secondary" type="button" onClick={() => setIsCreateOpen(false)}>Anuluj</button>
                    <button className="primary" type="submit">Zapisz</button>
                  </div>
                </form>
              </div>
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
                <div className="empty-state-text">Dodaj pierwszego klienta klikając przycisk powyżej</div>
              </div>
            ) : (
              <div className="list">
                {clients.map(c => (
                  <Link 
                    key={c.id} 
                    to={`/clients/${c.id}`} 
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

function exportCsv(clients: Client[]) {
  if (!clients || clients.length === 0) {
    alert('Brak danych do eksportu')
    return
  }
  const headers = ['Imię', 'Nazwisko', 'Telefon', 'E-mail', 'Adres', 'Kategoria']
  const rows = clients.map(c => {
    const address = [c.street, c.city].filter(Boolean).join(', ')
    const cat = (c.category && c.category.toUpperCase()) === 'PV' ? 'PV' : (c.category && c.category.toUpperCase()) === 'ME' ? 'ME' : ''
    return [c.firstName || '', c.lastName || '', c.phone || '', c.email || '', address, cat]
  })
  const escapeCell = (v: string) => '"' + String(v).replace(/"/g, '""') + '"'
  const sep = ';'
  const lines = [headers.map(escapeCell).join(sep), ...rows.map(r => r.map(escapeCell).join(sep))]
  const csv = '\ufeff' + lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  const url = URL.createObjectURL(blob)
  a.href = url
  a.download = 'klienci_admin.csv'
  a.click()
  URL.revokeObjectURL(url)
}
