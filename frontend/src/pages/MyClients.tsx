import { useEffect, useState } from 'react'
import api, { listClientOffers, downloadOffer, listClientAttachments, type AttachmentItem, viewAttachmentUrl, downloadAttachmentUrl } from '../lib/api'

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

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<Client[]>('/api/clients/mine')
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
        <span className="text-sm text-gray-500">{clients.length} klientów</span>
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

function ClientOffers({ clientId }: { clientId: string }) {
  const [offers, setOffers] = useState<Array<{ id: string; fileName: string; createdAt: string }>>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      <button className="btn btn-sm secondary" onClick={() => { setOpen(o => !o); if (!open) load() }}>{open ? 'Ukryj' : 'Pokaż'}</button>
      {open && (
        <div className="card" style={{ marginTop: 6 }}>
          {loading ? <div className="text-sm text-gray-500">Ładowanie…</div> : error ? <div className="text-error text-sm">{error}</div> : (
            offers.length === 0 ? <div className="text-sm text-gray-500">Brak ofert</div> : (
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
  return c
}


