import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import { getUser } from '../lib/auth'

type User = { id: string; firstName: string; lastName: string; email: string; role: 'ADMIN' | 'MANAGER' | 'SALES_REP'; managerId?: string | null }

export default function SalesPage() {
  const currentUser = getUser()!
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<User[]>('/api/users')
      setUsers(res.data)
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Nie udało się pobrać użytkowników')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const salesOnly = useMemo(() => users.filter(u => u.role === 'SALES_REP'), [users])
  const managersById = useMemo(() => new Map(users.filter(u => u.role === 'MANAGER').map(m => [m.id, m])), [users])

  async function assignToMe(userId: string) {
    await api.post(`/api/users/${userId}/assign-to-me`)
    await load()
  }

  async function unassign(userId: string) {
    await api.post(`/api/users/${userId}/unassign`)
    await load()
  }

  const mySales = useMemo(() => salesOnly.filter(s => s.managerId === currentUser.id), [salesOnly, currentUser.id])
  const allSales = useMemo(() => salesOnly.filter(s => s.managerId !== currentUser.id), [salesOnly, currentUser.id])

  return (
    <div className="container" style={{ paddingTop: 16 }}>
      <h2>Handlowcy</h2>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Moi handlowcy</h3>
          <AddSalesForm onCreated={load} />
        </div>
        {loading ? <div className="muted">Ładowanie…</div> : (
          <ul className="list">
            {mySales.length === 0 && <li className="muted">Brak przypisanych handlowców</li>}
            {mySales.map(u => (
              <li key={u.id}>
                <div>
                  <strong>{u.firstName} {u.lastName}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>{u.email}</div>
                </div>
                <div>
                  <button className="secondary" onClick={() => unassign(u.id)}>Usuń przypisanie</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3>Wszyscy handlowcy</h3>
        {loading ? <div className="muted">Ładowanie…</div> : (
          <ul className="list">
            {allSales.map(u => {
              const currentManager = u.managerId ? managersById.get(u.managerId) : null
              return (
                <li key={u.id}>
                  <div>
                    <strong>{u.firstName} {u.lastName}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>{u.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {currentManager && <span className="muted" style={{ fontSize: 12 }}>Manager: {currentManager.firstName} {currentManager.lastName}</span>}
                    <button onClick={() => assignToMe(u.id)}>{currentManager ? 'Przypisz do mnie' : 'Przypisz do mnie'}</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function AddSalesForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    try {
      setSubmitting(true)
      setError(null)
      if (!form.firstName || !form.lastName || !form.email) {
        setError('Imię, nazwisko i e-mail są wymagane'); return
      }
      await api.post('/api/users/create-sales', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password || undefined,
      })
      setOpen(false)
      setForm({ firstName: '', lastName: '', email: '', phone: '', password: '' })
      onCreated()
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Nie udało się dodać handlowca')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return <button onClick={() => setOpen(true)}>Dodaj handlowca</button>
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <input placeholder="Imię" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
        <input placeholder="Nazwisko" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
        <input placeholder="E-mail" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Telefon" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <input placeholder="Hasło (opcjonalnie)" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
      </div>
      {error && <div style={{ color: 'red', marginTop: 6 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
        <button className="secondary" onClick={() => setOpen(false)}>Anuluj</button>
        <button disabled={submitting} onClick={submit}>{submitting ? 'Zapisywanie…' : 'Zapisz'}</button>
      </div>
    </div>
  )
}



