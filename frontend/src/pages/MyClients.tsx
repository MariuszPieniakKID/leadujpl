import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import api, { listClientOffers, downloadOffer, listClientAttachments, type AttachmentItem, viewAttachmentUrl, downloadAttachmentUrl, getClientLatestStatus, setClientLatestStatus, uploadAttachments } from '../lib/api'
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

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<Client[]>('/api/clients/mine', { params: { q: query || undefined, status: status || undefined } })
      setClients(res.data)
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Nie udało się pobrać klientów')
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
          <p className="text-gray-600">Klienci z Twoimi spotkaniami</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Szukaj</label>
            <input className="form-input" placeholder="Nazwisko, telefon, e-mail, adres" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') load() }} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
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
          <button className="secondary" onClick={load}>Filtruj</button>
          <span className="text-sm text-gray-500">{clients.length} klientów</span>
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
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Imię</th>
                  <th>Nazwisko</th>
                  <th>Telefon</th>
                  <th>E-mail</th>
                  <th>Adres</th>
                  <th>Kategoria</th>
                  <th>Status</th>
                  <th>Oferty</th>
                  <th>Załączniki</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td className="font-medium">{c.firstName}</td>
                    <td className="font-medium">{c.lastName}</td>
                    <td>{c.phone || <span className="text-gray-400">—</span>}</td>
                    <td>{c.email || <span className="text-gray-400">—</span>}</td>
                    <td>{[c.street, c.city].filter(Boolean).join(', ') || <span className="text-gray-400">—</span>}</td>
                    <td>{renderCategory(c.category)}</td>
                    <td>
                      <ClientStatusAndActions clientId={c.id} />
                    </td>
                    <td>
                      <ClientOffers clientId={c.id} />
                    </td>
                    <td>
                      <ClientAttachments clientId={c.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      const res = await setClientLatestStatus(clientId, next as any)
      setStatus(res.status)
      setMeetingId(res.meetingId)
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
      await uploadAttachments(meetingId, clientId, Array.from(files))
      setInfo('Dodano pliki')
      setTimeout(() => setInfo(null), 1500)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Nie udało się wgrać plików')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <span className="text-sm text-gray-500">Ładowanie…</span>
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <select className="form-select" value={status || ''} onChange={e => onChangeStatus(e.target.value)}>
        <option value="">—</option>
        <option value="Umówione">Umówione</option>
        <option value="Odbyte">Odbyte</option>
        <option value="Dogrywka">Dogrywka</option>
        <option value="Przełożone">Przełożone</option>
        <option value="Sukces">Umowa</option>
        <option value="Porażka">Porażka</option>
      </select>
      {(status === 'Sukces') && (
        <label className="btn btn-sm secondary" style={{ margin: 0 }}>
          {uploading ? 'Wgrywanie…' : 'Dodaj pliki'}
          <input type="file" multiple onChange={e => onUpload(e.target.files)} style={{ display: 'none' }} />
        </label>
      )}
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


