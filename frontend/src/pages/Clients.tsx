import { useEffect, useState } from 'react'
import { getUser } from '../lib/auth'
import { fetchUsers, type AppUserSummary } from '../lib/api'
import { fetchClients, createClient, deleteClient, type Client, listClientAttachments, type AttachmentItem, viewAttachmentUrl, downloadAttachmentUrl, getClientLatestStatus, setClientLatestStatus } from '../lib/api'
import { offlineStore, pendingQueue, newLocalId } from '../lib/offline'

export default function ClientsPage() {
  const user = getUser()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Partial<Client>>({ firstName: '', lastName: '', phone: '', email: '', street: '', city: '', postalCode: '', category: '' })

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  // Admin-only controls ported from MyClients
  const [managers, setManagers] = useState<AppUserSummary[]>([])
  const [managerId, setManagerId] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  async function load() {
    setLoading(true)
    try {
      let params: any = { q: query || undefined, status: status || undefined }
      // For MANAGER we default to team scope to keep parity with previous view
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

  // Load managers list for admin filter (PWA-safe)
  useEffect(() => {
    if (!(user && user.role === 'ADMIN')) return
    ;(async () => {
      try {
        const all = await fetchUsers()
        setManagers(all.filter(u => u.role === 'MANAGER'))
      } catch {}
    })()
  }, [user?.role])

  // Listen for offline-added clients and update list immediately
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

  async function onDelete(id: string) {
    if (!confirm('Usunąć klienta?')) return
    await deleteClient(id)
    await load()
  }

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Klienci</h1>
          <p className="text-gray-600">Zarządzaj bazą klientów</p>
        </div>
        <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, flex: '1 1 240px', minWidth: 0 }}>
            <label className="form-label">Szukaj</label>
            <input className="form-input" placeholder="Nazwisko, telefon, e-mail, adres" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load() }} />
          </div>
          <div className="form-group" style={{ margin: 0, flex: '1 1 180px', minWidth: 0 }}>
            <label className="form-label">Status spotkania</label>
            <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Wszystkie</option>
              <option value="Sukces">Sukces</option>
              <option value="Porażka">Porażka</option>
              <option value="Dogrywka">Dogrywka</option>
              <option value="Przełożone">Przełożone</option>
              <option value="Umówione">Umówione</option>
              <option value="Odbyte">Odbyte</option>
            </select>
          </div>
          {(user && user.role === 'ADMIN') && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Manager</label>
              <select className="form-select" value={managerId} onChange={e => setManagerId(e.target.value)}>
                <option value="">Wszyscy</option>
                {managers.map(m => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                ))}
              </select>
            </div>
          )}
          <button className="secondary" onClick={load}>Filtruj</button>
          {(user && user.role === 'ADMIN') && (
            <button className="primary" onClick={() => exportCsv(clients)}>Eksport do CSV</button>
          )}
          <span className="text-sm text-gray-500" style={{ flex: '0 0 auto' }}>{clients.length} klientów</span>
          <button className="primary" onClick={() => setIsCreateOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Dodaj klienta
          </button>
        </div>
      </div>

      {isCreateOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Nowy klient</h3>
              <button className="secondary" onClick={() => setIsCreateOpen(false)} style={{ padding: 'var(--space-2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <form onSubmit={onSubmit}>
              <div className="form-grid-2">
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
                  <input className="form-input" placeholder="Telefon" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
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
              {createError && <div className="text-error text-sm mt-4 p-3 bg-error-50 rounded border border-error-200">{createError}</div>}
              <div className="modal-footer">
                <button className="secondary" type="button" onClick={() => setIsCreateOpen(false)}>Anuluj</button>
                <button className="primary" type="submit">Zapisz</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            <p>Brak klientów w systemie</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {clients.map(c => (
              <div key={c.id} className="list-item" style={{ alignItems: 'stretch', overflowX: 'hidden', width: '100%', minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%', minWidth: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="font-medium">{c.firstName} {c.lastName}</span>
                    <span style={{ color: 'var(--gray-600)', fontSize: 12 }}>{c.phone || '—'}</span>
                  </div>
                  <div className="client-actions" style={{ display: 'flex', gap: 8, flexShrink: 0, minWidth: 0 }}>
                    <button className="btn btn-sm secondary" onClick={() => setExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }))}>{expanded[c.id] ? 'Zwiń' : 'Szczegóły'}</button>
                    <button className="btn btn-sm danger" onClick={() => onDelete(c.id)}>Usuń</button>
                  </div>
                </div>
                {expanded[c.id] && (
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                    <div className="list" style={{ width: '100%', minWidth: 0 }}>
                      <div className="list-row"><span>E-mail</span><span>{c.email || <span className="text-gray-400">—</span>}</span></div>
                      <div className="list-row"><span>Adres</span><span style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{[c.street, c.city].filter(Boolean).join(', ') || <span className="text-gray-400">—</span>}</span></div>
                      <div className="list-row"><span>Kod pocztowy</span><span>{(c as any).postalCode || <span className="text-gray-400">—</span>}</span></div>
                      <div className="list-row"><span>Kategoria</span><span>{renderCategory(c.category)}</span></div>
                    </div>
                    <div className="client-status-actions" style={{ display: 'grid', gridTemplateColumns: '1fr', rowGap: 8, width: '100%', minWidth: 0 }}>
                      <div style={{ width: '100%', minWidth: 0 }}>
                        <ClientStatusSelect clientId={c.id} />
                      </div>
                      <div className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%', minWidth: 0, overflow: 'hidden' }}>
                        <span className="text-gray-600" style={{ minWidth: 90 }}>Rodzaj pliku:</span>
                        <AttachmentCategoriesInline clientId={c.id} />
                      </div>
                    </div>
                    <div>
                      <strong>Załączniki</strong>
                      <div style={{ marginTop: 6 }}>
                        <ClientAttachments clientId={c.id} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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

function ClientStatusSelect({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string | null>(null)
  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const s = await getClientLatestStatus(clientId)
        setStatus(s.status)
      } catch (e: any) {
        // ignore error, show empty
      } finally {
        setLoading(false)
      }
    })()
  }, [clientId])
  async function onChangeStatus(next: string) {
    try {
      if (navigator.onLine) {
        const res = await setClientLatestStatus(clientId, next as any)
        setStatus(res.status)
      } else {
        await pendingQueue.enqueue({ id: newLocalId('att'), method: 'PATCH', url: (import.meta.env.VITE_API_BASE || '') + `/api/clients/${clientId}/status`, body: { status: next }, headers: {}, createdAt: Date.now(), entityStore: 'meetings' })
        setStatus(next)
      }
    } catch (e: any) {
      // ignore
    }
  }
  if (loading) return <span className="text-xs text-gray-500">Ładowanie statusu…</span>
  return (
    <select className="form-select" value={status || ''} onChange={e => onChangeStatus(e.target.value)} style={{ flex: '1 1 220px', minWidth: 0, maxWidth: '100%' }}>
      <option value="">—</option>
      <option value="Umówione">Umówione</option>
      <option value="Odbyte">Odbyte</option>
      <option value="Dogrywka">Dogrywka</option>
      <option value="Przełożone">Przełożone</option>
      <option value="Sukces">Umowa</option>
      <option value="Porażka">Porażka</option>
    </select>
  )
}

function AttachmentCategoriesInline({ clientId }: { clientId: string }) {
  const cats = ['umowa','aum','formatka kredytowa','zdjęcia'] as const
  const [selected, setSelected] = useState<typeof cats[number]>('umowa')
  return (
    <div className="att-cat-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', paddingBottom: 4, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
      {cats.map(opt => (
        <label key={opt} className="inline-flex items-center" style={{ gap: 6 }}>
          <input type="radio" name={`att-cat-admin-${clientId}`} value={opt} checked={selected === opt} onChange={() => setSelected(opt)} style={{ display: 'none' }} />
          <span
            aria-pressed={selected === opt}
            role="button"
            style={{ fontSize: 12, padding: '6px 10px', borderRadius: 9999, border: '1px solid', borderColor: selected === opt ? 'var(--primary-500)' : 'var(--gray-300)', background: selected === opt ? 'var(--primary-50)' : '#fff', color: selected === opt ? 'var(--primary-700)' : 'var(--gray-700)', boxShadow: selected === opt ? 'inset 0 0 0 1px var(--primary-100)' : 'none', display: 'inline-block' }}
          >{opt === 'aum' ? 'AUM' : opt === 'zdjęcia' ? 'Zdjęcia' : opt === 'umowa' ? 'Umowa' : 'Formatka kredytowa'}</span>
        </label>
      ))}
    </div>
  )
}

function ClientAttachments({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AttachmentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const list = await listClientAttachments(clientId)
      setItems(list)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Nie udało się pobrać załączników')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button className="btn btn-sm secondary" onClick={() => { setOpen(o => !o); if (!open) load() }}>{open ? 'Ukryj' : 'Pokaż'}</button>
      {open && (
        <div className="card" style={{ marginTop: 6 }}>
          {loading ? <div className="text-sm text-gray-500">Ładowanie…</div> : error ? <div className="text-error text-sm">{error}</div> : (
            items.length === 0 ? <div className="text-sm text-gray-500">Brak załączników</div> : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                {items.map(a => (
                  <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{a.fileName}</span>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <a className="btn btn-sm secondary" href={viewAttachmentUrl(a.id)} target="_blank" rel="noreferrer">Podgląd</a>
                      <a className="btn btn-sm" href={downloadAttachmentUrl(a.id)} target="_blank" rel="noreferrer">Pobierz</a>
                    </span>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}
    </div>
  )
}

function renderCategory(category?: string | null) {
  if (!category || category.trim() === '') return <span className="text-gray-400">—</span>
  const c = category.toUpperCase()
  if (c === 'PV') return 'PV'
  if (c === 'ME') return 'ME'
  return <span className="text-gray-400">—</span>
}


