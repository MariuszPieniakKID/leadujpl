import { useEffect, useState } from 'react'
import api from '../lib/api'

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
    <div className="container" style={{ paddingTop: 16 }}>
      <h2>Moi klienci</h2>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}


