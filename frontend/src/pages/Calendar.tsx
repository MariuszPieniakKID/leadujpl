import { useEffect, useMemo, useState } from 'react'
import { Calendar as BigCalendar, Views, dateFnsLocalizer } from 'react-big-calendar'
import withDragAndDrop from 'react-big-calendar/lib/addons/dragAndDrop'
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css'
import 'react-big-calendar/lib/css/react-big-calendar.css'
// use named exports to satisfy bundler
import { format, parse, startOfWeek, getDay, addHours, setHours, setMinutes } from 'date-fns'
import { pl } from 'date-fns/locale'
import type { Locale } from 'date-fns'
type SlotInfo = any
type View = any
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import api from '../lib/api'
import type { Client } from '../lib/api'
import { getUser } from '../lib/auth'

type Meeting = {
  id: string
  scheduledAt: string
  location?: string | null
  notes?: string | null
  attendeeId: string
}

type User = { id: string; firstName: string; lastName: string; email: string; role: 'ADMIN' | 'MANAGER' | 'SALES_REP' }

export default function CalendarPage() {
  const currentUser = getUser()!
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined)
  const allowedViews: any[] = [Views.MONTH, Views.WEEK, Views.DAY]
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('calendar_date') : null
    const d = raw ? new Date(raw) : new Date()
    return isNaN(d.getTime()) ? new Date() : d
  })
  const [currentView, setCurrentView] = useState<any>(() => {
    const raw = typeof window !== 'undefined' ? (localStorage.getItem('calendar_view') as View | null) : null
    return raw && allowedViews.includes(raw) ? raw : Views.WEEK
  })

  const canManageAll = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER'

  const locales: Record<string, Locale> = { 'pl': pl }
  const localizer = useMemo(() => dateFnsLocalizer({
    format,
    parse: (str: string, fmt: string, refDate: Date) => parse(str, fmt, refDate, { locale: pl }),
    startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
    getDay,
    locales,
  }), [])

  useEffect(() => {
    try { localStorage.setItem('calendar_view', currentView) } catch {}
  }, [currentView])

  useEffect(() => {
    try { localStorage.setItem('calendar_date', currentDate.toISOString()) } catch {}
  }, [currentDate])

  useEffect(() => {
    const load = async () => {
      if (canManageAll) {
        try { const res = await api.get<User[]>('/api/users'); setUsers(res.data) } catch {}
      }
      await refreshMeetings()
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId])

  async function refreshMeetings() {
    const res = await api.get<Meeting[]>('/api/meetings', { params: selectedUserId ? { userId: selectedUserId } : undefined })
    setMeetings(res.data)
    console.log('meetings loaded', res.data)
  }

  const events = useMemo(() => meetings.map(m => {
    const start = new Date(m.scheduledAt)
    const end = (m as any).endsAt ? new Date((m as any).endsAt) : addHours(start, 1)
    return { id: m.id, title: m.notes || 'Spotkanie', start, end, status: (m as any).status || null, raw: m }
  }), [meetings])

  // New meeting modal state
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
    pvInstalled: '', // '' | 'TAK' | 'NIE'
    billRange: '',
    extraComments: '',
    contactConsent: false,
  })
  const [createSectionsOpen, setCreateSectionsOpen] = useState({ meeting: true, client: true, extra: true })

  // Client autocomplete state (create modal)
  const [clientQuery, setClientQuery] = useState('')
  const [clientOptions, setClientOptions] = useState<Client[]>([])
  const [isSearchingClients, setIsSearchingClients] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)

  function toLocalInputValue(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0')
    const yyyy = date.getFullYear()
    const mm = pad(date.getMonth() + 1)
    const dd = pad(date.getDate())
    const hh = pad(date.getHours())
    const mi = pad(date.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  }

  function toLocalDateValue(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  function toLocalTimeValue(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  function composeIsoFromLocal(dateStr: string, timeStr: string) {
    if (!dateStr || !timeStr) return null as unknown as string
    const [y, m, d] = dateStr.split('-').map(Number)
    const [hh, mm] = timeStr.split(':').map(Number)
    const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0)
    return dt.toISOString()
  }

  function openCreateNow() {
    setCreateError(null)
    const start = new Date()
    const end = addHours(start, 1)
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
      contactConsent: false,
    }))
    setSelectedClientId(null)
    setClientQuery('')
    setClientOptions([])
    setCreateSectionsOpen({ meeting: true, client: true, extra: true })
    setIsCreateOpen(true)
  }

  // Edit meeting modal state
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
    pvInstalled: '', // '' | 'TAK' | 'NIE'
    billRange: '',
    extraComments: '',
    status: '', // 'Sukces' | 'Porażka' | 'Dogrywka' | ''
  })
  const [, setShowFollowUpCreate] = useState(false)
  const [editSectionsOpen, setEditSectionsOpen] = useState({ meeting: false, client: false, extra: false })

  async function onSelect(slot: SlotInfo) {
    setCreateError(null)
    const start = slot.start as Date
    const end = (slot.end as Date) || addHours(start, 1)
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
    setCreateSectionsOpen({ meeting: true, client: true, extra: true })
    setIsCreateOpen(true)
  }

  // Debounced search for clients
  useEffect(() => {
    const q = clientQuery.trim()
    if (!isCreateOpen) return
    if (selectedClientId) return // skip searching when a client is already chosen
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

  function applyClientToForm(c: Client) {
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

  function onPickClient(c: Client) {
    setSelectedClientId(c.id)
    setClientQuery(`${c.firstName} ${c.lastName}${c.phone ? ' • ' + c.phone : ''}`.trim())
    setClientOptions([])
    applyClientToForm(c)
  }

  async function submitCreate() {
    try {
      setCreateError(null)
      if (!createForm.contactConsent) {
        setCreateError('Aby zapisać wydarzenie, zaznacz wymagany checkbox zgody.')
        return
      }
      const attendeeId = canManageAll && selectedUserId ? selectedUserId : currentUser.id
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
      // Only send client if any field provided
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
        contactConsent: true,
      })
      setIsCreateOpen(false)
      await refreshMeetings()
    } catch (e: any) {
      setCreateError(e?.response?.data?.error || e?.message || 'Nie udało się utworzyć spotkania')
    }
  }

  async function onEventDrop(eventId: string, start: Date, end: Date) {
    try {
      await api.patch(`/api/meetings/${eventId}`, {
        scheduledAt: start.toISOString(),
        endsAt: end?.toISOString?.() || undefined,
        status: 'Przełożone',
      })
      await refreshMeetings()
    } catch {}
  }

  async function openEditModal(eventId: string) {
    setEditError(null)
    setEditLoading(true)
    setIsEditOpen(true)
    setEditMeetingId(eventId)
    setEditSectionsOpen({ meeting: false, client: false, extra: false })
    try {
      const res = await api.get(`/api/meetings/${eventId}`)
      const m = res.data as any
      const start = new Date(m.scheduledAt)
      const end = m.endsAt ? new Date(m.endsAt) : addHours(start, 1)
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
      }
      if (editForm.status) payload.status = editForm.status
      if (editForm.pvInstalled) payload.pvInstalled = editForm.pvInstalled === 'TAK'
      if (editForm.billRange) payload.billRange = editForm.billRange
      if (editForm.extraComments) payload.extraComments = editForm.extraComments
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
      await refreshMeetings()
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
      await refreshMeetings()
    } catch (e: any) {
      setEditError(e?.response?.data?.error || e?.message || 'Nie udało się usunąć spotkania')
    }
  }

  const DnDCalendar = useMemo(() => withDragAndDrop(BigCalendar as any) as any, [])

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kalendarz</h1>
          <p className="text-gray-600">Zarządzaj swoimi spotkaniami</p>
        </div>
        <div className="flex items-center gap-4">
          {canManageAll && (
            <div className="form-group" style={{ minWidth: '200px', margin: 0 }}>
              <label className="form-label">Kalendarz użytkownika</label>
              <select className="form-select" value={selectedUserId || ''} onChange={e => setSelectedUserId(e.target.value || undefined)}>
                <option value="">Ja ({currentUser.firstName} {currentUser.lastName})</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                ))}
              </select>
            </div>
          )}
          <button className="primary" onClick={openCreateNow}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Dodaj spotkanie
          </button>
        </div>
      </div>

      <div className="calendar-container">
        <div className="calendar-shell">
        <DndProvider backend={HTML5Backend}>
        <DnDCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={currentView}
          onView={(v: any) => setCurrentView(v)}
          date={currentDate}
          onNavigate={(date: any) => setCurrentDate(date)}
          defaultView={Views.WEEK}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          step={30}
          timeslots={2}
          min={setHours(setMinutes(new Date(), 0), 8)}
          max={setHours(setMinutes(new Date(), 0), 18)}
          scrollToTime={setHours(setMinutes(new Date(), 0), 8)}
          selectable
          popup
          style={{ height: '100%' }}
          onSelectSlot={onSelect}
          onSelectEvent={(e: any) => openEditModal((e as any).id)}
          onEventDrop={({ event, start, end }: any) => onEventDrop((event as any).id, start as Date, end as Date)}
          onEventResize={({ event, start, end }: any) => onEventDrop((event as any).id, start as Date, end as Date)}
          resizable
          culture="pl"
          eventPropGetter={(event: any) => {
            const now = Date.now()
            const isPast = (event.start as Date).getTime() < now
            const s = (event.status || '').trim()
            let bg = ''
            if (s === 'Umowa') bg = '#10b981' // green
            else if (s === 'Spadek') bg = '#ef4444' // red
            else if (s === 'Przełożone') bg = '#3b82f6' // blue
            else if (!isPast) bg = '#f97316' // orange = Umówione
            else bg = '#facc15' // yellow = Odbyte
            return { style: { backgroundColor: bg, color: 'white', border: 'none' } }
          }}
          messages={{
            today: 'Dziś', previous: 'Poprzedni', next: 'Następny', month: 'Miesiąc', week: 'Tydzień', day: 'Dzień',
            showMore: (total: any) => `+${total} więcej`
          }}
        />
        </DndProvider>
        </div>
      </div>

      {isCreateOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Nowe spotkanie</h3>
              <button className="secondary" onClick={() => setIsCreateOpen(false)} style={{ padding: 'var(--space-2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="section-header" onClick={() => setCreateSectionsOpen(s => ({ ...s, meeting: !s.meeting }))}>
              <span className="section-title">Szczegóły spotkania</span>
              <button className="section-toggle" onClick={(e) => { e.stopPropagation(); setCreateSectionsOpen(s => ({ ...s, meeting: !s.meeting })) }} aria-label="toggle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: createSectionsOpen.meeting ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
            </div>
            {createSectionsOpen.meeting && (
            <div className="section-content">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Temat/Notatka</label>
                  <input className="form-input" value={createForm.notes} onChange={e => setCreateForm({ ...createForm, notes: e.target.value })} placeholder="Np. Spotkanie z klientem" />
                </div>
                <div className="form-group">
                  <label className="form-label">Lokalizacja</label>
                  <select className="form-select" value={createForm.location} onChange={e => setCreateForm({ ...createForm, location: e.target.value })}>
                    <option value="">— wybierz —</option>
                    <option value="U klienta">U klienta</option>
                    <option value="Biuro">Biuro</option>
                    <option value="Zdalne">Zdalne</option>
                    <option value="Inne">Inne</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Początek</label>
                  <div className="datetime-grid">
                    <input className="form-input" type="date" value={createForm.startDate} onChange={e => setCreateForm({ ...createForm, startDate: e.target.value, endDate: e.target.value })} />
                    <input className="form-input" type="time" value={createForm.startTime} onChange={e => setCreateForm({ ...createForm, startTime: e.target.value })} />
                  </div>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Koniec</label>
                  <div className="datetime-grid">
                    <input className="form-input" type="date" value={createForm.endDate} onChange={e => setCreateForm({ ...createForm, endDate: e.target.value })} />
                    <input className="form-input" type="time" value={createForm.endTime} onChange={e => setCreateForm({ ...createForm, endTime: e.target.value })} />
                  </div>
                </div>
              </div>
            </div>
            )}

            <div className="section-header" onClick={() => setCreateSectionsOpen(s => ({ ...s, client: !s.client }))}>
              <span className="section-title">Dane klienta (opcjonalnie)</span>
              <button className="section-toggle" onClick={(e) => { e.stopPropagation(); setCreateSectionsOpen(s => ({ ...s, client: !s.client })) }} aria-label="toggle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: createSectionsOpen.client ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
            </div>
            {createSectionsOpen.client && (
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
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '6px 0', marginTop: 8 }} onClick={() => setCreateSectionsOpen(s => ({ ...s, extra: !s.extra }))}>
              <strong>Dodatkowe informacje</strong>
              <button className="secondary" onClick={(e) => { e.stopPropagation(); setCreateSectionsOpen(s => ({ ...s, extra: !s.extra })) }} aria-label="toggle">
                {createSectionsOpen.extra ? '▲' : '▼'}
              </button>
            </div>
            {createSectionsOpen.extra && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>Czy posiada instalację PV?</label>
                <div>
                  <label style={{ marginRight: 12 }}>
                    <input type="radio" name="pvInstalledCreate" checked={createForm.pvInstalled === 'TAK'} onChange={() => setCreateForm({ ...createForm, pvInstalled: 'TAK' })} /> TAK
                  </label>
                  <label>
                    <input type="radio" name="pvInstalledCreate" checked={createForm.pvInstalled === 'NIE'} onChange={() => setCreateForm({ ...createForm, pvInstalled: 'NIE' })} /> NIE
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
            )}

            {createError && <div style={{ color: 'red', marginTop: 8 }}>{createError}</div>}

            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'start', gap: 8, width: '100%' }}>
                <input type="checkbox" checked={createForm.contactConsent} onChange={e => setCreateForm({ ...createForm, contactConsent: e.target.checked })} style={{ marginTop: 2 }} />
                <span style={{ color: 'var(--gray-800)' }}>Potwierdzam, że klient wyraził zgodę na przetwarzanie danych w celu kontaktu handlowego i przygotowania oferty.</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button className="secondary" onClick={() => setIsCreateOpen(false)}>Anuluj</button>
              <button onClick={submitCreate}>Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {isEditOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Szczegóły spotkania</h3>
              <button className="secondary" onClick={() => { setIsEditOpen(false); setEditMeetingId(null) }} style={{ padding: 'var(--space-2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            {editLoading ? (
              <div>Wczytywanie…</div>
            ) : (
            <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '6px 0' }} onClick={() => setEditSectionsOpen(s => ({ ...s, meeting: !s.meeting }))}>
              <strong>Temat spotkania</strong>
              <button className="secondary" onClick={(e) => { e.stopPropagation(); setEditSectionsOpen(s => ({ ...s, meeting: !s.meeting })) }} aria-label="toggle">
                {editSectionsOpen.meeting ? '▲' : '▼'}
              </button>
            </div>
            {editSectionsOpen.meeting && (
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
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '6px 0', marginTop: 8 }} onClick={() => setEditSectionsOpen(s => ({ ...s, client: !s.client }))}>
              <strong>Dane klienta</strong>
              <button className="secondary" onClick={(e) => { e.stopPropagation(); setEditSectionsOpen(s => ({ ...s, client: !s.client })) }} aria-label="toggle">
                {editSectionsOpen.client ? '▲' : '▼'}
              </button>
            </div>
            {editSectionsOpen.client && (
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
            )}

            {/* Status spotkania - pokaż jeśli spotkanie w przeszłości (sekcja na górze) */}
            {(() => {
              const now = new Date()
              const start = new Date(editForm.startLocal || now.toISOString())
              const isPast = start.getTime() < now.getTime()
              if (!isPast) return null
              return (
                <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'default', padding: '6px 0', marginTop: 0 }}>
                  <strong>Status spotkania</strong>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                  <label>
                    <input type="radio" name="meetingStatus" checked={editForm.status === 'Sukces'} onChange={() => setEditForm({ ...editForm, status: 'Sukces' })} /> Sukces !
                  </label>
                  <label>
                    <input type="radio" name="meetingStatus" checked={editForm.status === 'Porażka'} onChange={() => setEditForm({ ...editForm, status: 'Porażka' })} /> Porażka
                  </label>
                  <label>
                    <input type="radio" name="meetingStatus" checked={editForm.status === 'Dogrywka'} onChange={() => setEditForm({ ...editForm, status: 'Dogrywka' })} /> Dogrywka
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={async () => {
                      if (!editMeetingId) return
                      try {
                        await api.patch(`/api/meetings/${editMeetingId}`, { status: editForm.status || 'Sukces' })
                        if (editForm.status === 'Dogrywka') {
                          // Prefill create form with same client and mark notes as Dogrywka
                          setIsEditOpen(false)
                          setShowFollowUpCreate(true)
                          setCreateForm(f => ({
                            ...f,
                            notes: 'Dogrywka',
                            clientFirstName: editForm.clientFirstName,
                            clientLastName: editForm.clientLastName,
                            clientPhone: editForm.clientPhone,
                            clientEmail: editForm.clientEmail,
                            clientStreet: editForm.clientStreet,
                            clientCity: editForm.clientCity,
                            clientCategory: editForm.clientCategory,
                            pvInstalled: editForm.pvInstalled,
                            billRange: editForm.billRange,
                            extraComments: editForm.extraComments,
                          }))
                          setCreateSectionsOpen({ meeting: true, client: true, extra: true })
                          setIsCreateOpen(true)
                        } else {
                          await refreshMeetings()
                          setIsEditOpen(false)
                          setEditMeetingId(null)
                        }
                      } catch (e: any) {
                        setEditError(e?.response?.data?.error || e?.message || 'Nie udało się zapisać statusu')
                      }
                    }}>Zapisz status</button>
                  </div>
                </div>
                </>
              )
            })()}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '6px 0', marginTop: 8 }} onClick={() => setEditSectionsOpen(s => ({ ...s, extra: !s.extra }))}>
              <strong>Dodatkowe informacje</strong>
              <button className="secondary" onClick={(e) => { e.stopPropagation(); setEditSectionsOpen(s => ({ ...s, extra: !s.extra })) }} aria-label="toggle">
                {editSectionsOpen.extra ? '▲' : '▼'}
              </button>
            </div>
            {editSectionsOpen.extra && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>Czy posiada instalację PV?</label>
                <div>
                  <label style={{ marginRight: 12 }}>
                    <input type="radio" name="pvInstalledEdit" checked={editForm.pvInstalled === 'TAK'} onChange={() => setEditForm({ ...editForm, pvInstalled: 'TAK' })} /> TAK
                  </label>
                  <label>
                    <input type="radio" name="pvInstalledEdit" checked={editForm.pvInstalled === 'NIE'} onChange={() => setEditForm({ ...editForm, pvInstalled: 'NIE' })} /> NIE
                  </label>
                </div>
              </div>
              <div>
                <label>Wysokość rachunków (zł)</label>
                <select value={editForm.billRange} onChange={e => setEditForm({ ...editForm, billRange: e.target.value })}>
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
                <textarea rows={3} value={editForm.extraComments} onChange={e => setEditForm({ ...editForm, extraComments: e.target.value })} />
              </div>
            </div>
            )}

            {editError && <div style={{ color: 'red', marginTop: 8 }}>{editError}</div>}

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16 }}>
              <button className="secondary" onClick={() => { setIsEditOpen(false); setEditMeetingId(null) }}>Zamknij</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="secondary" onClick={deleteMeeting}>Usuń</button>
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


