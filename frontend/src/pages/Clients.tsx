import { useEffect, useState } from 'react'
import { fetchClients, createClient, deleteClient, type Client, listClientAttachments, type AttachmentItem, viewAttachmentUrl, downloadAttachmentUrl } from '../lib/api'

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<Partial<Client>>({ firstName: '', lastName: '', phone: '', email: '', street: '', city: '', category: '' })

  async function load() {
    setLoading(true)
    try {
      const data = await fetchClients()
      setClients(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    if (!form.firstName || !form.lastName) { setCreateError('Imię i nazwisko są wymagane'); return }
    await createClient({
      firstName: form.firstName!, lastName: form.lastName!, phone: form.phone || undefined, email: form.email || undefined,
      street: form.street || undefined, city: form.city || undefined, category: form.category || undefined,
    } as any)
    setForm({ firstName: '', lastName: '', phone: '', email: '', street: '', city: '', category: '' })
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
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{clients.length} klientów</span>
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
                  <label className="form-label">Kategoria</label>
                  <input className="form-input" placeholder="Kategoria" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} />
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
                  <th>Załączniki</th>
                  <th></th>
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
                    <td>{c.category || <span className="text-gray-400">—</span>}</td>
                    <td>
                      <ClientAttachments clientId={c.id} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="danger btn-sm" onClick={() => onDelete(c.id)}>Usuń</button>
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


