import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import api, { listClientOffers, downloadOffer, listClientAttachments, type AttachmentItem, viewAttachmentUrl, downloadAttachmentUrl, getClientLatestStatus, setClientLatestStatus, deleteAttachment, fetchUsers, type AppUserSummary } from '../lib/api'
import { offlineStore, pendingQueue, newLocalId } from '../lib/offline'
import { getUser } from '../lib/auth'
import EmbeddedCalculator from '../components/EmbeddedCalculator'

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
  const [managers, setManagers] = useState<AppUserSummary[]>([])
  const [managerId, setManagerId] = useState<string>('')
  const user = getUser()

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const isManager = user && user.role === 'MANAGER'
      const isAdmin = user && user.role === 'ADMIN'
      if (isAdmin) {
        const res = await api.get<Client[]>('/api/clients', { params: { q: query || undefined, status: status || undefined, managerId: managerId || undefined } })
        setClients(res.data)
        try { for (const c of res.data) { await offlineStore.put('clients', c as any) } } catch {}
      } else if (isManager && scope === 'team') {
        const res = await api.get<Client[]>('/api/clients', { params: { q: query || undefined, status: status || undefined, scope: 'team' } })
        setClients(res.data)
        try { for (const c of res.data) { await offlineStore.put('clients', c as any) } } catch {}
      } else {
        const res = await api.get<Client[]>('/api/clients/mine', { params: { q: query || undefined, status: status || undefined } })
        setClients(res.data)
        try { for (const c of res.data) { await offlineStore.put('clients', c as any) } } catch {}
      }
    } catch (e: any) {
      // Fallback offline
      try {
        const local = await offlineStore.getAll<Client>('clients')
        const q = (query || '').trim().toLowerCase()
        const filtered = (local || []).filter(c => {
          if (!q) return true
          const hay = [c.firstName, c.lastName, c.phone, c.email, c.city, c.street].filter(Boolean).join(' ').toLowerCase()
          return hay.includes(q)
        })
        setClients(filtered)
        setError(null)
      } catch {
        setError(e?.response?.data?.error || e?.message || 'Nie udało się pobrać klientów')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  // Update list immediately when client added offline
  useEffect(() => {
    function onOfflineClientAdded(e: any) {
      const c = e?.detail?.client as any
      if (!c) return
      setClients(prev => {
        if (prev.find(x => (x as any).id === c.id)) return prev
        return [c, ...prev]
      })
    }
    window.addEventListener('offline-client-added', onOfflineClientAdded as any)
    return () => window.removeEventListener('offline-client-added', onOfflineClientAdded as any)
  }, [])

  // Load managers list for admin filter
  useEffect(() => {
    const isAdmin = user && user.role === 'ADMIN'
    if (!isAdmin) return
    ;(async () => {
      try {
        const users = await fetchUsers()
        setManagers(users.filter(u => u.role === 'MANAGER'))
      } catch (e) {
        // ignore
      }
    })()
  }, [user?.role])

  function exportCsv() {
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
    const scopeLabel = (user && user.role === 'MANAGER' && scope === 'team') ? 'zespol' : 'moi'
    const statusLabel = status || 'all'
    a.download = `klienci_${scopeLabel}_${statusLabel}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Moi klienci</h1>
          <p className="text-gray-600">Klienci z Twoimi spotkaniami</p>
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
          {(user && user.role === 'MANAGER') && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Zakres</label>
              <select className="form-select" value={scope} onChange={e => setScope(e.target.value as any)}>
                <option value="mine">Moi klienci</option>
                <option value="team">Klienci mojego zespołu</option>
              </select>
            </div>
          )}
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
            <button className="primary" onClick={exportCsv}>Eksport CSV</button>
          )}
          <span className="text-sm text-gray-500" style={{ flex: '0 0 auto' }}>{clients.length} klientów</span>
        </div>
      </div>

      {error && (
        <div className="text-error text-sm p-3 bg-error-50 rounded border border-error-200 mb-6">
          {error}
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
            <p>Brak klientów</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {clients.map(c => (
              <div key={c.id} className="list-item" style={{ alignItems: 'stretch', overflowX: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span className="font-medium">{c.firstName} {c.lastName}</span>
                    <span style={{ color: 'var(--gray-600)', fontSize: 12 }}>{c.phone || '—'}</span>
                  </div>
                  <div className="client-actions" style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <ClientStatusAndActions clientId={c.id} />
                    <button className="btn btn-sm secondary" onClick={() => {
                      const id = c.id
                      const el = document.getElementById('mc-'+id)
                      if (el) el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none'
                    }}>Szczegóły</button>
                  </div>
                </div>
                <div id={'mc-'+c.id} style={{ display: 'none', marginTop: 8 }}>
                  <div className="list">
                    <div className="list-row"><span>E-mail</span><span>{c.email || <span className="text-gray-400">—</span>}</span></div>
                    <div className="list-row"><span>Adres</span><span style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{[c.street, c.city].filter(Boolean).join(', ') || <span className="text-gray-400">—</span>}</span></div>
                    <div className="list-row"><span>Kategoria</span><span>{renderCategory(c.category)}</span></div>
                    <div className="list-row"><span>Załączniki</span><span><ClientAttachments clientId={c.id} /></span></div>
                    <div className="list-row"><span>Oferty</span><span><ClientOffers clientId={c.id} /></span></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ClientStatusAndActions({ clientId }: { clientId: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [meetingId, setMeetingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [attCategory, setAttCategory] = useState<'umowa' | 'aum' | 'formatka kredytowa' | 'zdjęcia'>('umowa')
  const categoryOptions = [
    { value: 'umowa' as const, label: 'Umowa' },
    { value: 'aum' as const, label: 'AUM' },
    { value: 'formatka kredytowa' as const, label: 'Formatka kredytowa' },
    { value: 'zdjęcia' as const, label: 'Zdjęcia' },
  ]
  const user = getUser()

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const s = await getClientLatestStatus(clientId)
      setStatus(s.status)
      setMeetingId(s.meetingId)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Nie udało się pobrać statusu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [clientId])

  async function onChangeStatus(next: string) {
    try {
      setError(null)
      if (navigator.onLine) {
        const res = await setClientLatestStatus(clientId, next as any)
        setStatus(res.status)
        setMeetingId(res.meetingId)
      } else {
        // Queue PATCH and optimistically update UI
        await pendingQueue.enqueue({ id: newLocalId('att'), method: 'PATCH', url: (import.meta.env.VITE_API_BASE || '') + `/api/clients/${clientId}/status`, body: { status: next }, headers: {}, createdAt: Date.now(), entityStore: 'meetings' })
        setStatus(next)
      }
      setInfo('Zapisano status')
      setTimeout(() => setInfo(null), 1500)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Nie udało się zapisać statusu')
    }
  }

  async function onUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    if (!meetingId) { setError('Brak spotkania do przypisania plików'); return }
    try {
      setUploading(true)
      if (navigator.onLine) {
        const form = new FormData()
        form.append('meetingId', meetingId)
        form.append('clientId', clientId)
        form.append('category', attCategory)
        for (const f of Array.from(files)) form.append('files', f)
        await api.post(`/api/attachments/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      } else {
        for (const f of Array.from(files)) {
          const id = newLocalId('att')
          await offlineStore.put('attachments', { id, meetingId, clientId, fileName: f.name, data: f, uploaded: false, category: attCategory })
        }
      }
      setInfo('Dodano pliki')
      try { window.dispatchEvent(new CustomEvent('client-attachments-uploaded', { detail: { clientId } })) } catch {}
      setTimeout(() => setInfo(null), 1500)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Nie udało się wgrać plików')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <span className="text-sm text-gray-500">Ładowanie…</span>
  // Admin has read-only view here
  if (user && user.role === 'ADMIN') {
    return <span className="text-sm text-gray-500">—</span>
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <select className="form-select" value={status || ''} onChange={e => onChangeStatus(e.target.value)}>
        <option value="">—</option>
        <option value="Umówione">Umówione</option>
        <option value="Odbyte">Odbyte</option>
        <option value="Dogrywka">Dogrywka</option>
        <option value="Przełożone">Przełożone</option>
        <option value="Sukces">Umowa</option>
        <option value="Porażka">Porażka</option>
      </select>
      <div className="text-xs" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%' }}>
        <span className="text-gray-600" style={{ minWidth: 90 }}>Rodzaj pliku:</span>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
          {categoryOptions.map(opt => {
            const selected = attCategory === opt.value
            return (
              <label key={opt.value} className="inline-flex items-center" style={{ gap: 6, whiteSpace: 'nowrap' }}>
                <input type="radio" name={`att-cat-${clientId}`} value={opt.value} checked={selected} onChange={() => setAttCategory(opt.value)} style={{ display: 'none' }} />
                <span
                  aria-pressed={selected}
                  role="button"
                  style={{
                    fontSize: 12,
                    padding: '6px 10px',
                    borderRadius: 9999,
                    border: '1px solid',
                    borderColor: selected ? 'var(--primary-500)' : 'var(--gray-300)',
                    background: selected ? 'var(--primary-50)' : '#fff',
                    color: selected ? 'var(--primary-700)' : 'var(--gray-700)',
                    boxShadow: selected ? 'inset 0 0 0 1px var(--primary-100)' : 'none',
                  }}
                >
                  {opt.label}
                </span>
              </label>
            )
          })}
        </div>
      </div>
      <label className="btn btn-sm secondary" style={{ margin: 0 }}>
        {uploading ? 'Wgrywanie…' : 'Dodaj pliki'}
        <input type="file" multiple onChange={e => onUpload(e.target.files)} style={{ display: 'none' }} />
      </label>
      <span className="text-xs" style={{ background: 'var(--gray-100)', color: 'var(--gray-700)', padding: '4px 8px', borderRadius: 9999 }}>
        {categoryOptions.find(o => o.value === attCategory)?.label}
      </span>
      {info && <span className="text-xs text-green-600">{info}</span>}
      {error && <span className="text-xs text-error">{error}</span>}
    </div>
  )
}

function ClientOffers({ clientId }: { clientId: string }) {
  const [offers, setOffers] = useState<Array<{ id: string; fileName: string; createdAt: string }>>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCalcModal, setShowCalcModal] = useState(false)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const list = await listClientOffers(clientId)
      setOffers(list)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Nie udało się pobrać ofert')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button className="btn btn-sm secondary" onClick={() => { const next = !open; setOpen(next); if (next) { setShowCalcModal(false); load() } }}>{open ? 'Ukryj' : 'Pokaż'}</button>
      {open && (
        <div className="card" style={{ marginTop: 6 }}>
          {loading ? <div className="text-sm text-gray-500">Ładowanie…</div> : error ? <div className="text-error text-sm">{error}</div> : (
            offers.length === 0 ? (
              <div>
                {!showCalcModal ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="text-sm text-gray-500">Brak ofert</div>
                    <button className="btn btn-sm primary" onClick={() => setShowCalcModal(true)}>Dodaj ofertę</button>
                  </div>
                ) : null}
              </div>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                {offers.map(o => (
                  <li key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{o.fileName}</span>
                    <a className="btn btn-sm" href={downloadOffer(o.id)} target="_blank" rel="noreferrer">Pobierz</a>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}

      {showCalcModal && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 2147483647, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24 }}>
          <div onClick={() => setShowCalcModal(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)' }} />
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', background: '#fff', width: 'min(1000px, 95vw)', maxHeight: '90vh', overflow: 'auto', border: '1px solid var(--gray-200)', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
            <div className="modal-header">
              <h3 className="modal-title">Dodaj ofertę</h3>
              <button className="secondary" onClick={() => setShowCalcModal(false)} style={{ padding: 'var(--space-2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div style={{ padding: 12 }}>
              <EmbeddedCalculator clientId={clientId} onSaved={async () => { setShowCalcModal(false); await load() }} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function ClientAttachments({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<AttachmentItem[]>([])
  const [open, setOpen] = useState(false)
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

  // Auto-open and reload when any upload happens for this client
  useEffect(() => {
    function handler(e: any) {
      if (e?.detail?.clientId === clientId) {
        setOpen(true)
        load()
      }
    }
    window.addEventListener('client-attachments-uploaded', handler as any)
    return () => window.removeEventListener('client-attachments-uploaded', handler as any)
  }, [clientId])

  // Group by category for clearer UX
  const order = ['umowa', 'aum', 'formatka kredytowa', 'zdjęcia']
  const groups = items.reduce<Record<string, AttachmentItem[]>>((acc, it) => {
    const key = (it.category || 'Inne').toLowerCase()
    acc[key] = acc[key] || []
    acc[key].push(it)
    return acc
  }, {})
  const sortedGroupKeys = Object.keys(groups).sort((a, b) => {
    const ia = order.indexOf(a)
    const ib = order.indexOf(b)
    const aa = ia === -1 ? 999 : ia
    const bb = ib === -1 ? 999 : ib
    if (aa !== bb) return aa - bb
    return a.localeCompare(b)
  })

  return (
    <div>
      <button className="btn btn-sm secondary" onClick={() => { setOpen(o => !o); if (!open) load() }}>{open ? 'Ukryj' : 'Pokaż'}</button>
      {open && (
        <div className="card" style={{ marginTop: 6 }}>
          {loading ? <div className="text-sm text-gray-500">Ładowanie…</div> : error ? <div className="text-error text-sm">{error}</div> : (
            items.length === 0 ? <div className="text-sm text-gray-500">Brak załączników</div> : (
              <div style={{ display: 'grid', gap: 10 }}>
                {sortedGroupKeys.map(key => {
                  const display = key === 'inne' ? 'Inne' : key.charAt(0).toUpperCase() + key.slice(1)
                  const list = [...groups[key]].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  return (
                    <div key={key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
                        <span style={{ fontSize: 12, background: 'var(--gray-100)', color: 'var(--gray-700)', padding: '4px 10px', borderRadius: 9999 }}>{display}</span>
                        <span className="text-xs text-gray-500">{list.length}</span>
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                        {list.map(a => (
                          <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.fileName}</span>
                            <span style={{ display: 'flex', gap: 6 }}>
                              <a className="btn btn-sm secondary" href={viewAttachmentUrl(a.id)} target="_blank" rel="noreferrer" aria-label="Podgląd" title="Podgląd">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                              </a>
                              <a className="btn btn-sm" href={downloadAttachmentUrl(a.id)} target="_blank" rel="noreferrer" aria-label="Pobierz" title="Pobierz">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              </a>
                              <button className="btn btn-sm danger" onClick={async () => { if (!confirm('Usunąć plik trwale?')) return; try { await deleteAttachment(a.id); await load() } catch (e) {} }} aria-label="Usuń" title="Usuń">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                              </button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
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

