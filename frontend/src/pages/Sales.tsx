import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import api from '../lib/api'
import { getUser } from '../lib/auth'

type User = { id: string; firstName: string; lastName: string; email: string; role: 'ADMIN' | 'MANAGER' | 'SALES_REP'; managerId?: string | null }

export default function SalesPage() {
  const currentUser = getUser()!
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'SALES_REP' | 'MANAGER'>('ALL')

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
  const managersOnly = useMemo(() => users.filter(u => u.role === 'MANAGER'), [users])
  const managersById = useMemo(() => new Map(managersOnly.map(m => [m.id, m])), [managersOnly])

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

  const isAdmin = currentUser.role === 'ADMIN'

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isAdmin ? 'Zespół' : 'Handlowcy'}</h1>
          <p className="text-gray-600">{isAdmin ? 'Zarządzaj użytkownikami, rolami i przypisaniami' : 'Zarządzaj swoim zespołem handlowym'}</p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <AddManagerForm onCreated={load} />
            <AddSalesForm onCreated={load} />
          </div>
        )}
        {!isAdmin && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <PushNotificationButton mySales={mySales} />
            <AddSalesForm onCreated={load} />
          </div>
        )}
      </div>

      {error && (
        <div className="text-error text-sm p-3 bg-error-50 rounded border border-error-200 mb-6">
          {error}
        </div>
      )}

      {isAdmin ? (
        <div className="card">
          <div className="flex justify-between items-center mb-4" style={{ gap: 12, flexWrap: 'wrap' }}>
            <h3 className="card-title">Użytkownicy</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label className="form-label" style={{ margin: 0 }}>Filtr</label>
              <select className="form-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)}>
                <option value="ALL">Wszyscy</option>
                <option value="SALES_REP">Handlowcy</option>
                <option value="MANAGER">Managerowie</option>
              </select>
            </div>
          </div>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Ładowanie…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {users
                .filter(u => roleFilter === 'ALL' ? true : u.role === roleFilter)
                .map(u => {
                  const currentManager = u.managerId ? managersById.get(u.managerId) : null
                  return (
                    <div key={u.id} className="list-item">
                      <div>
                        <div className="font-medium text-gray-900">{u.firstName} {u.lastName} <span className="text-xs text-gray-400">({u.role === 'MANAGER' ? 'Manager' : u.role === 'ADMIN' ? 'Admin' : 'Handlowiec'})</span></div>
                        <div className="text-sm text-gray-500">{u.email}</div>
                        {currentManager && <div className="text-xs text-gray-400">Manager: {currentManager.firstName} {currentManager.lastName}</div>}
                      </div>
                      {u.role === 'SALES_REP' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          {u.managerId ? (
                            <button className="secondary btn-sm" onClick={() => unassign(u.id)}>Usuń przypisanie</button>
                          ) : (
                            <button className="primary btn-sm" onClick={() => assignToMe(u.id)}>Przypisz do mnie</button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="card mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="card-title">Moi handlowcy</h3>
            </div>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Ładowanie…</div>
            ) : mySales.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg style={{ margin: '0 auto 1rem', display: 'block' }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <path d="m22 2-5 5M17 2l5 5"/>
                </svg>
                <p>Brak przypisanych handlowców</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {mySales.map(u => (
                  <div key={u.id} className="list-item">
                    <div>
                      <div className="font-medium text-gray-900">{u.firstName} {u.lastName}</div>
                      <div className="text-sm text-gray-500">{u.email}</div>
                    </div>
                    <button className="secondary btn-sm" onClick={() => unassign(u.id)}>Usuń przypisanie</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="card-title">Wszyscy handlowcy</h3>
              <span className="text-sm text-gray-500">{allSales.length} dostępnych</span>
            </div>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Ładowanie…</div>
            ) : allSales.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Wszyscy handlowcy są już przypisani</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {allSales.map(u => {
                  const currentManager = u.managerId ? managersById.get(u.managerId) : null
                  return (
                    <div key={u.id} className="list-item">
                      <div>
                        <div className="font-medium text-gray-900">{u.firstName} {u.lastName}</div>
                        <div className="text-sm text-gray-500">{u.email}</div>
                        {currentManager && <div className="text-xs text-gray-400">Manager: {currentManager.firstName} {currentManager.lastName}</div>}
                      </div>
                      <button className="primary btn-sm" onClick={() => assignToMe(u.id)}>
                        {currentManager ? 'Przypisz do mnie' : 'Przypisz do mnie'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function AddSalesForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

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

  if (!open) {
    return (
      <button className="primary btn-sm" onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Dodaj handlowca
      </button>
    )
  }

  return createPortal(
    <div className={`modal-overlay${isMobile ? ' sheet' : ''}`} role="dialog" aria-modal="true">
      <div className={`modal-content${isMobile ? ' sheet' : ''}`} style={isMobile ? undefined : { maxWidth: '500px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Nowy handlowiec</h3>
          <button className="secondary" onClick={() => setOpen(false)} style={{ padding: 'var(--space-2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Imię</label>
            <input className="form-input" placeholder="Imię" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Nazwisko</label>
            <input className="form-input" placeholder="Nazwisko" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" placeholder="E-mail" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Telefon</label>
            <input className="form-input" placeholder="Telefon" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Hasło (opcjonalnie)</label>
            <input className="form-input" type="password" placeholder="Zostaw puste dla domyślnego: test123" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
        </div>
        
        {error && <div className="text-error text-sm mt-4 p-3 bg-error-50 rounded border border-error-200">{error}</div>}
        
        <div className="modal-footer">
          <button className="secondary" onClick={() => setOpen(false)}>Anuluj</button>
          <button className="primary" disabled={submitting} onClick={submit}>
            {submitting ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function AddManagerForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  async function submit() {
    try {
      setSubmitting(true)
      setError(null)
      if (!form.firstName || !form.lastName || !form.email) {
        setError('Imię, nazwisko i e-mail są wymagane'); return
      }
      await api.post('/api/users', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password || 'test123',
        role: 'MANAGER',
      })
      setOpen(false)
      setForm({ firstName: '', lastName: '', email: '', phone: '', password: '' })
      onCreated()
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Nie udało się dodać managera')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button className="secondary btn-sm" onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Dodaj managera
      </button>
    )
  }

  return createPortal(
    <div className={`modal-overlay${isMobile ? ' sheet' : ''}`} role="dialog" aria-modal="true">
      <div className={`modal-content${isMobile ? ' sheet' : ''}`} style={isMobile ? undefined : { maxWidth: '500px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Nowy manager</h3>
          <button className="secondary" onClick={() => setOpen(false)} style={{ padding: 'var(--space-2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Imię</label>
            <input className="form-input" placeholder="Imię" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Nazwisko</label>
            <input className="form-input" placeholder="Nazwisko" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" placeholder="E-mail" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Telefon</label>
            <input className="form-input" placeholder="Telefon" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Hasło (opcjonalnie)</label>
            <input className="form-input" type="password" placeholder="Zostaw puste dla domyślnego: test123" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
        </div>
        
        {error && <div className="text-error text-sm mt-4 p-3 bg-error-50 rounded border border-error-200">{error}</div>}
        
        <div className="modal-footer">
          <button className="secondary" onClick={() => setOpen(false)}>Anuluj</button>
          <button className="primary" disabled={submitting} onClick={submit}>
            {submitting ? 'Zapisywanie…' : 'Zapisz'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

function PushNotificationButton({ mySales }: { mySales: User[] }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  async function sendNotification() {
    if (!message.trim()) {
      setError('Wiadomość nie może być pusta')
      return
    }

    if (mySales.length === 0) {
      setError('Brak przypisanych handlowców do powiadomienia')
      return
    }

    try {
      setSending(true)
      setError(null)
      
      // First ensure we have push notifications set up
      const { subscribeToPushNotifications } = await import('../lib/push-notifications')
      const subscribed = await subscribeToPushNotifications()
      
      if (!subscribed) {
        setError('Nie udało się skonfigurować powiadomień push. Sprawdź uprawnienia w przeglądarce.')
        return
      }
      
      const userIds = mySales.map(u => u.id)
      await api.post('/api/push-notifications/send', {
        message: message.trim(),
        userIds
      })

      setSuccess(true)
      setMessage('')
      setTimeout(() => {
        setOpen(false)
        setSuccess(false)
      }, 2000)
    } catch (e: any) {
      console.error('Push notification error:', e)
      // Pokaż dokładny komunikat z backendu (np. brak zespołu / nie Twoi odbiorcy)
      setError(e?.response?.data?.error || e?.message || 'Nie udało się wysłać powiadomienia')
    } finally {
      setSending(false)
    }
  }

  if (!open) {
    return (
      <button 
        className="secondary btn-sm" 
        onClick={() => setOpen(true)}
        disabled={mySales.length === 0}
        title={mySales.length === 0 ? 'Brak handlowców do powiadomienia' : 'Wyślij powiadomienie push do zespołu'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        Powiadomienie PUSH
      </button>
    )
  }

  return createPortal(
    <div className={`modal-overlay${isMobile ? ' sheet' : ''}`} role="dialog" aria-modal="true">
      <div className={`modal-content${isMobile ? ' sheet' : ''}`} style={isMobile ? undefined : { maxWidth: '500px' }}>
        <div className="modal-header">
          <h3 className="modal-title">Powiadomienie PUSH</h3>
          <button className="secondary" onClick={() => setOpen(false)} style={{ padding: 'var(--space-2)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <div className="form-group">
          <label className="form-label">
            Wiadomość dla {mySales.length} handlowca/handlowców
          </label>
          <textarea 
            className="form-input" 
            placeholder="Wprowadź wiadomość do wysłania..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={4}
            disabled={sending || success}
          />
          <div className="text-sm text-gray-500 mt-1">
            Odbiorcy: {mySales.map(u => `${u.firstName} ${u.lastName}`).join(', ')}
          </div>
        </div>
        
        {error && (
          <div className="text-error text-sm mt-4 p-3 bg-error-50 rounded border border-error-200">
            {error}
          </div>
        )}

        {success && (
          <div className="text-green-700 text-sm mt-4 p-3 bg-green-50 rounded border border-green-200">
            ✅ Powiadomienie zostało wysłane pomyślnie!
          </div>
        )}
        
        <div className="modal-footer">
          <button className="secondary" onClick={() => setOpen(false)} disabled={sending}>
            {success ? 'Zamknij' : 'Anuluj'}
          </button>
          <button 
            className="primary" 
            disabled={sending || success || !message.trim()} 
            onClick={sendNotification}
          >
            {sending ? 'Wysyłanie…' : success ? 'Wysłano!' : 'Wyślij'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

