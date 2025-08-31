import { useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import './App.css'

import { fetchLeads } from './lib/api'
import api from './lib/api'
import type { Client } from './lib/api'
import Login from './pages/Login'
import CalendarPage from './pages/Calendar'
import ClientsPage from './pages/Clients'
import SalesPage from './pages/Sales'
import MyClientsPage from './pages/MyClients'
import { clearAuth, getToken, getUser } from './lib/auth'

function Protected({ children, roles }: { children: React.ReactNode, roles?: Array<'ADMIN' | 'MANAGER' | 'SALES_REP'> }) {
  const token = getToken()
  const user = getUser()
  if (!token || !user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

function Dashboard() {
  const user = getUser()
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [meetings, setMeetings] = useState<any[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    notes: '',
    location: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    clientFirstName: '',
    clientLastName: '',
    clientPhone: '',
    clientEmail: '',
    clientStreet: '',
    clientCity: '',
    clientCategory: '',
    pvInstalled: '',
    billRange: '',
    extraComments: '',
  })
  const [clientQuery, setClientQuery] = useState('')
  const [clientOptions, setClientOptions] = useState<Client[]>([])
  const [isSearchingClients, setIsSearchingClients] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const data = await fetchLeads()
        setLeads(data)
        // load meetings for current user
        const res = await api.get<any[]>('/api/meetings')
        setMeetings(res.data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const upcoming = useMemo(() => {
    const now = Date.now()
    return meetings
      .filter(m => new Date(m.scheduledAt).getTime() > now)
      .sort((a,b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 5)
      .map(m => ({
        id: m.id,
        date: new Date(m.scheduledAt).toLocaleDateString(),
        time: new Date(m.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        place: m.location || '—',
        topic: m.notes || 'Spotkanie',
      }))
  }, [meetings])

  const recent = useMemo(() => {
    const now = Date.now()
    return meetings
      .filter(m => new Date(m.scheduledAt).getTime() <= now)
      .sort((a,b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
      .slice(0, 5)
      .map(m => ({
        id: m.id,
        date: new Date(m.scheduledAt).toLocaleDateString(),
        time: new Date(m.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        place: m.location || '—',
        topic: m.notes || 'Spotkanie',
        status: m.status as string | undefined,
      }))
  }, [meetings])

  const points = 1280

  const stats = useMemo(() => {
    const now = Date.now()
    const total = meetings.length
    let pastCount = 0
    let closedPast = 0
    let successPast = 0
    let unfinishedPast = 0
    for (const m of meetings) {
      const isPast = new Date(m.scheduledAt).getTime() <= now
      if (isPast) {
        pastCount += 1
        const status = (m as any).status as string | undefined
        const hasStatus = !!status && status.trim() !== ''
        if (hasStatus) closedPast += 1
        if (status === 'Sukces') successPast += 1
        if (!hasStatus) unfinishedPast += 1
      }
    }
    const skutecznosc = pastCount > 0 ? Math.round((successPast / pastCount) * 100) : 0
    return { total, closedPast, successPast, skutecznosc, unfinishedPast }
  }, [meetings])

  function toLocalDateValue(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }
  function toLocalTimeValue(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  function toLocalInputValue(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0')
    const yyyy = date.getFullYear()
    const mm = pad(date.getMonth() + 1)
    const dd = pad(date.getDate())
    const hh = pad(date.getHours())
    const mi = pad(date.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  }
  function composeIsoFromLocal(dateStr: string, timeStr: string) {
    if (!dateStr || !timeStr) return null as unknown as string
    const [y, m, d] = dateStr.split('-').map(Number)
    const [hh, mm] = timeStr.split(':').map(Number)
    const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0)
    return dt.toISOString()
  }

  function openCreate() {
    setCreateError(null)
    const start = new Date()
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    setCreateForm(f => ({
      ...f,
      notes: '',
      location: '',
      startDate: toLocalDateValue(start),
      startTime: toLocalTimeValue(start),
      endDate: toLocalDateValue(end),
      endTime: toLocalTimeValue(end),
      clientFirstName: '',
      clientLastName: '',
      clientPhone: '',
      clientEmail: '',
      clientStreet: '',
      clientCity: '',
      clientCategory: '',
      pvInstalled: '',
      billRange: '',
      extraComments: '',
    }))
    setClientQuery('')
    setClientOptions([])
    setSelectedClientId(null)
    setIsCreateOpen(true)
  }

  useEffect(() => {
    const q = clientQuery.trim()
    if (!isCreateOpen) return
    if (selectedClientId) return
    if (q.length < 2) { setClientOptions([]); return }
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        setIsSearchingClients(true)
        const res = await api.get<Client[]>(`/api/clients/search`, { params: { q } })
        if (!cancelled) setClientOptions(res.data)
      } catch {
        if (!cancelled) setClientOptions([])
      } finally {
        if (!cancelled) setIsSearchingClients(false)
      }
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [clientQuery, isCreateOpen, selectedClientId])

  function onPickClient(c: Client) {
    setSelectedClientId(c.id)
    setClientQuery(`${c.firstName} ${c.lastName}${c.phone ? ' • ' + c.phone : ''}`.trim())
    setClientOptions([])
    setCreateForm(f => ({
      ...f,
      clientFirstName: c.firstName || '',
      clientLastName: c.lastName || '',
      clientPhone: c.phone || '',
      clientEmail: c.email || '',
      clientStreet: c.street || '',
      clientCity: c.city || '',
      clientCategory: c.category || '',
      pvInstalled: c.pvInstalled === true ? 'TAK' : (c.pvInstalled === false ? 'NIE' : ''),
      billRange: c.billRange || '',
      extraComments: c.extraComments || '',
    }))
  }

  async function submitCreate() {
    try {
      setCreateError(null)
      const attendeeId = user!.id
      const scheduledAt = composeIsoFromLocal(createForm.startDate, createForm.startTime)
      const endsAt = (createForm.endDate && createForm.endTime)
        ? composeIsoFromLocal(createForm.endDate, createForm.endTime)
        : undefined
      const client = {
        firstName: createForm.clientFirstName || undefined,
        lastName: createForm.clientLastName || undefined,
        phone: createForm.clientPhone || undefined,
        email: createForm.clientEmail || undefined,
        street: createForm.clientStreet || undefined,
        city: createForm.clientCity || undefined,
        category: createForm.clientCategory || undefined,
      }
      const hasClient = Object.values(client).some(v => v && `${v}`.trim() !== '')
      const pvInstalled = createForm.pvInstalled ? (createForm.pvInstalled === 'TAK') : undefined
      const billRange = createForm.billRange || undefined
      const extraComments = createForm.extraComments || undefined
      await api.post('/api/meetings', {
        scheduledAt,
        endsAt,
        notes: createForm.notes || undefined,
        location: createForm.location || undefined,
        attendeeId,
        ...(selectedClientId ? { clientId: selectedClientId } : (hasClient ? { client } : {})),
        ...(pvInstalled !== undefined ? { pvInstalled } : {}),
        ...(billRange ? { billRange } : {}),
        ...(extraComments ? { extraComments } : {}),
      })
      setIsCreateOpen(false)
      const res = await api.get<any[]>('/api/meetings')
      setMeetings(res.data)
    } catch (e: any) {
      setCreateError(e?.response?.data?.error || e?.message || 'Nie udało się utworzyć spotkania')
    }
  }

  // Edit modal state and handlers (dashboard)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editMeetingId, setEditMeetingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    notes: '',
    location: '',
    startLocal: '',
    endLocal: '',
    clientFirstName: '',
    clientLastName: '',
    clientPhone: '',
    clientEmail: '',
    clientStreet: '',
    clientCity: '',
    clientCategory: '',
    pvInstalled: '',
    billRange: '',
    extraComments: '',
    status: '',
  })

  async function openEdit(meetingId: string) {
    setEditError(null)
    setEditLoading(true)
    setIsEditOpen(true)
    setEditMeetingId(meetingId)
    try {
      const res = await api.get(`/api/meetings/${meetingId}`)
      const m: any = res.data
      const start = new Date(m.scheduledAt)
      const end = m.endsAt ? new Date(m.endsAt) : new Date(start.getTime() + 60 * 60 * 1000)
      setEditForm({
        notes: m.notes || '',
        location: m.location || '',
        startLocal: toLocalInputValue(start),
        endLocal: toLocalInputValue(end),
        clientFirstName: m.client?.firstName || '',
        clientLastName: m.client?.lastName || '',
        clientPhone: m.client?.phone || '',
        clientEmail: m.client?.email || '',
        clientStreet: m.client?.street || '',
        clientCity: m.client?.city || '',
        clientCategory: m.client?.category || '',
        pvInstalled: m.pvInstalled === true ? 'TAK' : (m.pvInstalled === false ? 'NIE' : ''),
        billRange: m.billRange || '',
        extraComments: m.extraComments || '',
        status: m.status || '',
      })
    } catch (e: any) {
      setEditError(e?.response?.data?.error || e?.message || 'Nie udało się pobrać szczegółów')
    } finally {
      setEditLoading(false)
    }
  }

  async function submitEdit() {
    if (!editMeetingId) return
    try {
      setEditError(null)
      const payload: any = {
        scheduledAt: new Date(editForm.startLocal).toISOString(),
        endsAt: editForm.endLocal ? new Date(editForm.endLocal).toISOString() : undefined,
        notes: editForm.notes || undefined,
        location: editForm.location || undefined,
        status: editForm.status || undefined,
      }
      const client = {
        firstName: editForm.clientFirstName || undefined,
        lastName: editForm.clientLastName || undefined,
        phone: editForm.clientPhone || undefined,
        email: editForm.clientEmail || undefined,
        street: editForm.clientStreet || undefined,
        city: editForm.clientCity || undefined,
        category: editForm.clientCategory || undefined,
      }
      const hasClient = Object.values(client).some(v => v && `${v}`.trim() !== '')
      if (hasClient) payload.client = client
      await api.patch(`/api/meetings/${editMeetingId}`, payload)
      setIsEditOpen(false)
      setEditMeetingId(null)
      const res = await api.get<any[]>('/api/meetings')
      setMeetings(res.data)
    } catch (e: any) {
      setEditError(e?.response?.data?.error || e?.message || 'Nie udało się zapisać zmian')
    }
  }

  async function deleteMeeting() {
    if (!editMeetingId) return
    try {
      await api.delete(`/api/meetings/${editMeetingId}`)
      setIsEditOpen(false)
      setEditMeetingId(null)
      const res = await api.get<any[]>('/api/meetings')
      setMeetings(res.data)
    } catch (e: any) {
      setEditError(e?.response?.data?.error || e?.message || 'Nie udało się usunąć spotkania')
    }
  }

  return (
    <div className="container">

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 16px' }}>
        <div className="muted">Twoje punkty: <strong>{points}</strong></div>
        <button className="primary" onClick={openCreate}>Dodaj spotkanie</button>
      </div>

      <div className="grid">
        <section className="card">
          <h3>Najbliższe spotkania</h3>
          <ul className="list">
            {upcoming.map(m => (
              <li key={m.id} onClick={() => openEdit(m.id)} style={{ cursor: 'pointer' }}>
                <div>
                  <strong>{m.date} • {m.time}</strong>
                  <div className="muted">{m.place}</div>
                </div>
                <div className="topic">{m.topic}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h3>Statystyki</h3>
          <ul className="list small">
            <li style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Odbyte spotkania</span>
              <strong>{stats.closedPast}</strong>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Umówione spotkania</span>
              <strong>{stats.total}</strong>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Skuteczność</span>
              <strong>{stats.skutecznosc}%</strong>
            </li>
            <li style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Nie zamknięte spotkania</span>
              <strong>{stats.unfinishedPast}</strong>
            </li>
          </ul>
        </section>

        <section className="card" style={{ gridColumn: '1 / -1' }}>
          <h3>Twoje ostatnie spotkania</h3>
          <ul className="list">
            {recent.map(m => (
              <li key={m.id} onClick={() => openEdit(m.id)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(() => {
                    const color = m.status === 'Sukces' ? '#16a34a' : m.status === 'Porażka' ? '#dc2626' : m.status === 'Dogrywka' ? '#f59e0b' : '#94a3b8'
                    return <span title={m.status || 'brak statusu'} style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color }} />
                  })()}
                  <strong>{m.date} • {m.time}</strong>
                  <div className="muted">{m.place}</div>
                </div>
                <div className="topic">{m.topic}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {loading && <div className="muted small" style={{ marginTop: 12 }}>Ładowanie danych…</div>}
      {!loading && <div className="muted small" style={{ marginTop: 12 }}>Leady w systemie: {leads.length}</div>}

      {isCreateOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 720, maxWidth: '95%', background: '#fff', padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Nowe spotkanie</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label>Temat/Notatka</label>
                <input value={createForm.notes} onChange={e => setCreateForm({ ...createForm, notes: e.target.value })} placeholder="Np. Spotkanie z klientem" />
              </div>
              <div>
                <label>Lokalizacja</label>
                <select value={createForm.location} onChange={e => setCreateForm({ ...createForm, location: e.target.value })}>
                  <option value="">— wybierz —</option>
                  <option value="U klienta">U klienta</option>
                  <option value="Biuro">Biuro</option>
                  <option value="Zdalne">Zdalne</option>
                  <option value="Inne">Inne</option>
                </select>
              </div>
              <div>
                <label>Początek - Data</label>
                <input type="date" value={createForm.startDate} onChange={e => setCreateForm({ ...createForm, startDate: e.target.value, endDate: e.target.value })} />
              </div>
              <div>
                <label>Początek - Godzina</label>
                <input type="time" value={createForm.startTime} onChange={e => setCreateForm({ ...createForm, startTime: e.target.value })} />
              </div>
              <div>
                <label>Koniec - Data</label>
                <input type="date" value={createForm.endDate} onChange={e => setCreateForm({ ...createForm, endDate: e.target.value })} />
              </div>
              <div>
                <label>Koniec - Godzina</label>
                <input type="time" value={createForm.endTime} onChange={e => setCreateForm({ ...createForm, endTime: e.target.value })} />
              </div>
            </div>

            <h4 style={{ marginTop: 16 }}>Dane klienta (opcjonalnie)</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Wybierz klienta z bazy</label>
                <input
                  placeholder="Szukaj po imieniu, nazwisku, telefonie, e-mailu, adresie..."
                  value={clientQuery}
                  onChange={e => { setClientQuery(e.target.value); setSelectedClientId(null) }}
                />
                {isSearchingClients && <div className="muted" style={{ fontSize: 12 }}>Szukam…</div>}
                {!isSearchingClients && clientOptions.length > 0 && (
                  <div className="card" style={{ marginTop: 6, maxHeight: 180, overflowY: 'auto' }}>
                    {clientOptions.map(c => (
                      <div key={c.id} style={{ padding: 8, cursor: 'pointer' }} onClick={() => onPickClient(c)}>
                        <div style={{ fontWeight: 600 }}>{c.firstName} {c.lastName}</div>
                        <div className="muted" style={{ fontSize: 12 }}>{[c.phone, c.email, c.city, c.street].filter(Boolean).join(' • ')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label>Imię</label>
                <input value={createForm.clientFirstName} onChange={e => setCreateForm({ ...createForm, clientFirstName: e.target.value })} />
              </div>
              <div>
                <label>Nazwisko</label>
                <input value={createForm.clientLastName} onChange={e => setCreateForm({ ...createForm, clientLastName: e.target.value })} />
              </div>
              <div>
                <label>Telefon</label>
                <input value={createForm.clientPhone} onChange={e => setCreateForm({ ...createForm, clientPhone: e.target.value })} />
              </div>
              <div>
                <label>E-mail</label>
                <input value={createForm.clientEmail} onChange={e => setCreateForm({ ...createForm, clientEmail: e.target.value })} />
              </div>
              <div>
                <label>Ulica</label>
                <input value={createForm.clientStreet} onChange={e => setCreateForm({ ...createForm, clientStreet: e.target.value })} />
              </div>
              <div>
                <label>Miasto</label>
                <input value={createForm.clientCity} onChange={e => setCreateForm({ ...createForm, clientCity: e.target.value })} />
              </div>
              <div>
                <label>Kategoria</label>
                <input value={createForm.clientCategory} onChange={e => setCreateForm({ ...createForm, clientCategory: e.target.value })} />
              </div>
            </div>

            <h4 style={{ marginTop: 16 }}>Dodatkowe informacje</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>Czy posiada instalację PV?</label>
                <div>
                  <label style={{ marginRight: 12 }}>
                    <input type="radio" name="pvInstalledCreateDash" checked={createForm.pvInstalled === 'TAK'} onChange={() => setCreateForm({ ...createForm, pvInstalled: 'TAK' })} /> TAK
                  </label>
                  <label>
                    <input type="radio" name="pvInstalledCreateDash" checked={createForm.pvInstalled === 'NIE'} onChange={() => setCreateForm({ ...createForm, pvInstalled: 'NIE' })} /> NIE
                  </label>
                </div>
              </div>
              <div>
                <label>Wysokość rachunków (zł)</label>
                <select value={createForm.billRange} onChange={e => setCreateForm({ ...createForm, billRange: e.target.value })}>
                  <option value="">— wybierz —</option>
                  <option value="50 - 150">50 - 150</option>
                  <option value="150 - 250">150 - 250</option>
                  <option value="250 - 350">250 - 350</option>
                  <option value="350 - 500">350 - 500</option>
                  <option value="500 - 800">500 - 800</option>
                  <option value="800 - 1000">800 - 1000</option>
                  <option value="> 1000">powyżej 1000</option>
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Komentarz/uwagi</label>
                <textarea rows={3} value={createForm.extraComments} onChange={e => setCreateForm({ ...createForm, extraComments: e.target.value })} />
              </div>
            </div>

            {createError && <div style={{ color: 'red', marginTop: 8 }}>{createError}</div>}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="secondary" onClick={() => setIsCreateOpen(false)}>Anuluj</button>
              <button onClick={submitCreate}>Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {isEditOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: 720, maxWidth: '95%', background: '#fff', padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Edycja spotkania</h3>
            {editLoading ? (
              <div>Wczytywanie…</div>
            ) : (
            <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label>Temat/Notatka</label>
                <input value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>
              <div>
                <label>Lokalizacja</label>
                <input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} />
              </div>
              <div>
                <label>Początek</label>
                <input type="datetime-local" value={editForm.startLocal} onChange={e => {
                  const v = e.target.value
                  let newEnd = editForm.endLocal
                  if (v) {
                    const d = v.split('T')[0]
                    if (newEnd) {
                      const parts = newEnd.split('T')
                      newEnd = `${d}T${parts[1] || '00:00'}`
                    } else {
                      newEnd = v
                    }
                  }
                  setEditForm({ ...editForm, startLocal: v, endLocal: newEnd })
                }} />
              </div>
              <div>
                <label>Koniec</label>
                <input type="datetime-local" value={editForm.endLocal} onChange={e => setEditForm({ ...editForm, endLocal: e.target.value })} />
              </div>
            </div>

            <h4 style={{ marginTop: 16 }}>Dane klienta</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label>Imię</label>
                <input value={editForm.clientFirstName} onChange={e => setEditForm({ ...editForm, clientFirstName: e.target.value })} />
              </div>
              <div>
                <label>Nazwisko</label>
                <input value={editForm.clientLastName} onChange={e => setEditForm({ ...editForm, clientLastName: e.target.value })} />
              </div>
              <div>
                <label>Telefon</label>
                <input value={editForm.clientPhone} onChange={e => setEditForm({ ...editForm, clientPhone: e.target.value })} />
              </div>
              <div>
                <label>E-mail</label>
                <input value={editForm.clientEmail} onChange={e => setEditForm({ ...editForm, clientEmail: e.target.value })} />
              </div>
              <div>
                <label>Ulica</label>
                <input value={editForm.clientStreet} onChange={e => setEditForm({ ...editForm, clientStreet: e.target.value })} />
              </div>
              <div>
                <label>Miasto</label>
                <input value={editForm.clientCity} onChange={e => setEditForm({ ...editForm, clientCity: e.target.value })} />
              </div>
              <div>
                <label>Kategoria</label>
                <input value={editForm.clientCategory} onChange={e => setEditForm({ ...editForm, clientCategory: e.target.value })} />
              </div>
            </div>

            {(() => {
              const now = new Date()
              const start = new Date(editForm.startLocal || now.toISOString())
              const isPast = start.getTime() < now.getTime()
              if (!isPast) return null
              return (
                <div style={{ marginTop: 8 }}>
                  <strong>Status spotkania</strong>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 6 }}>
                    <label>
                      <input type="radio" name="meetingStatusDash" checked={editForm.status === 'Sukces'} onChange={() => setEditForm({ ...editForm, status: 'Sukces' })} /> Sukces !
                    </label>
                    <label>
                      <input type="radio" name="meetingStatusDash" checked={editForm.status === 'Porażka'} onChange={() => setEditForm({ ...editForm, status: 'Porażka' })} /> Porażka
                    </label>
                    <label>
                      <input type="radio" name="meetingStatusDash" checked={editForm.status === 'Dogrywka'} onChange={() => setEditForm({ ...editForm, status: 'Dogrywka' })} /> Dogrywka
                    </label>
                  </div>
                </div>
              )
            })()}

            {editError && <div style={{ color: 'red', marginTop: 8 }}>{editError}</div>}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
              <button className="secondary" onClick={deleteMeeting}>Usuń</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="secondary" onClick={() => { setIsEditOpen(false); setEditMeetingId(null) }}>Anuluj</button>
                <button onClick={submitEdit}>Zapisz</button>
              </div>
            </div>
            </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AdminPage() {
  const user = getUser()
  if (!user) return null
  return <div style={{ padding: 16 }}>
    <h3>Panel administratora</h3>
    <p>Zalogowano jako: {user.firstName} {user.lastName} ({user.role})</p>
  </div>
}

function App() {
  function NavBar() {
    const user = getUser()
    return (
      <nav className="navbar">
        <div className="brand">leaduj</div>
        <div className="nav">
          <Link to="/">Home</Link>
          <Link to="/calendar">Kalendarz</Link>
          {user && (user.role === 'ADMIN' || user.role === 'MANAGER') && (
            <Link to="/clients">Klienci</Link>
          )}
          <Link to="/my-clients">Moi klienci</Link>
          {user && user.role === 'MANAGER' && (
            <Link to="/sales">Handlowcy</Link>
          )}
          <Link to="/stats">Statystyki i Analityka</Link>
          <Link to="/account">Moje Konto</Link>
          <button className="logout" onClick={() => { clearAuth(); location.href = '/login' }}>Wyloguj</button>
        </div>
      </nav>
    )
  }
  function Shell() {
    const location = useLocation()
    const showNav = location.pathname !== '/login'
    return (
      <>
        {showNav && <NavBar />}
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/calendar" element={<Protected><CalendarPage /></Protected>} />
          <Route path="/clients" element={<Protected roles={['ADMIN','MANAGER']}><ClientsPage /></Protected>} />
          <Route path="/sales" element={<Protected roles={['MANAGER']}><SalesPage /></Protected>} />
          <Route path="/my-clients" element={<Protected><MyClientsPage /></Protected>} />
          <Route path="/stats" element={<Protected><div className="container" style={{ paddingTop: 16 }}><h2>Statystyki i Analityka</h2><p className="muted">Wersja demonstracyjna. Wykresy i KPI pojawią się w kolejnej iteracji.</p></div></Protected>} />
          <Route path="/account" element={<Protected><div className="container" style={{ paddingTop: 16 }}><h2>Moje Konto</h2></div></Protected>} />
          <Route path="/admin" element={<Protected roles={['ADMIN']}><AdminPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </>
    )
  }
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  )
}

export default App
