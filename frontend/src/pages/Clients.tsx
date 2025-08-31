import { useEffect, useState } from 'react'
import { fetchClients, createClient, updateClient, deleteClient, type Client } from '../lib/api'

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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.firstName || !form.lastName) return alert('Imię i nazwisko są wymagane')
    await createClient({
      id: '' as any, // ignored by backend; type compatibility
      firstName: form.firstName!, lastName: form.lastName!, phone: form.phone || undefined, email: form.email || undefined,
      street: form.street || undefined, city: form.city || undefined, category: form.category || undefined,
    })
    setForm({ firstName: '', lastName: '', phone: '', email: '', street: '', city: '', category: '' })
    await load()
  }

  async function onDelete(id: string) {
    if (!confirm('Usunąć klienta?')) return
    await deleteClient(id)
    await load()
  }

  return (
    <div className="container" style={{ paddingTop: 16 }}>
      <h2>Klienci</h2>

      <form className="card" onSubmit={onSubmit} style={{ marginBottom: 16 }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <input placeholder="Imię" value={form.firstName || ''} onChange={e => setForm({ ...form, firstName: e.target.value })} />
          <input placeholder="Nazwisko" value={form.lastName || ''} onChange={e => setForm({ ...form, lastName: e.target.value })} />
          <input placeholder="Telefon" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input placeholder="E-mail" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Ulica i numer domu" value={form.street || ''} onChange={e => setForm({ ...form, street: e.target.value })} />
          <input placeholder="Miasto" value={form.city || ''} onChange={e => setForm({ ...form, city: e.target.value })} />
          <input placeholder="Kategoria" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} />
        </div>
        <div style={{ marginTop: 8 }}>
          <button className="primary" type="submit">Dodaj klienta</button>
        </div>
      </form>

      <div className="card">
        {loading ? <div className="muted">Ładowanie…</div> : (
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Imię</th>
                <th>Nazwisko</th>
                <th>Telefon</th>
                <th>E-mail</th>
                <th>Adres</th>
                <th>Kategoria</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id}>
                  <td>{c.firstName}</td>
                  <td>{c.lastName}</td>
                  <td>{c.phone || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td>{[c.street, c.city].filter(Boolean).join(', ') || '-'}</td>
                  <td>{c.category || '-'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="danger" onClick={() => onDelete(c.id)}>Usuń</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}


