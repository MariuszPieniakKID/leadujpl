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
import api, { listMeetingAttachments, type AttachmentItem, viewAttachmentUrl, downloadAttachmentUrl, uploadAttachments } from '../lib/api'
import { offlineStore, pendingQueue, newLocalId } from '../lib/offline'
import EmbeddedCalculator from '../components/EmbeddedCalculator'
import { listClientOffers, downloadOffer, fetchOffer } from '../lib/api'
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
      // Preload and cache next 30 days when online; fallback to IndexedDB when offline
      if (navigator.onLine) {
        await refreshMeetings()
        try {
          // Cache fetched meetings
          const latest = await api.get<Meeting[]>('/api/meetings', { params: selectedUserId ? { userId: selectedUserId } : undefined })
          for (const m of latest.data) { try { await offlineStore.put('meetings', m as any) } catch {} }
        } catch {}
      } else {
        try { const local = await offlineStore.getAll<any>('meetings'); setMeetings(local || []) } catch {}
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId])

  async function refreshMeetings() {
    const res = await api.get<Meeting[]>('/api/meetings', { params: selectedUserId ? { userId: selectedUserId } : undefined })
    setMeetings(res.data)
    try { for (const m of res.data) { await offlineStore.put('meetings', m as any) } } catch {}
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
    postalCode: '',
    clientCategory: 'PV',
    pvInstalled: '', // '' | 'TAK' | 'NIE'
    pvPower: '',
    billRange: '',
    extraComments: '',
    contactConsent: false,
    newRules: '',
    buildingType: '',
  })
  const [geoLoading, setGeoLoading] = useState(false)
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

  function roundToNextFullHour(d: Date): Date {
    const x = new Date(d)
    if (x.getMinutes() > 0 || x.getSeconds() > 0 || x.getMilliseconds() > 0) {
      x.setHours(x.getHours() + 1)
    }
    x.setMinutes(0, 0, 0)
    return x
  }

  function computeEndForStart(dateStr: string, timeStr: string): { endDate: string; endTime: string } {
    if (!dateStr || !timeStr) return { endDate: dateStr, endTime: timeStr }
    const [y, m, d] = dateStr.split('-').map(Number)
    const [hh] = timeStr.split(':').map(Number)
    const start = new Date(y, (m || 1) - 1, d || 1, hh || 0, 0, 0, 0)
    const end = new Date(start)
    end.setHours(end.getHours() + 1)
    // Keep same day; clamp if crosses midnight
    const sameDay = end.getFullYear() === start.getFullYear() && end.getMonth() === start.getMonth() && end.getDate() === start.getDate()
    const endDate = toLocalDateValue(start)
    const endTime = sameDay ? toLocalTimeValue(end) : '23:00'
    return { endDate, endTime }
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
    const start = roundToNextFullHour(new Date())
    const end = addHours(start, 1)
    setCreateForm(f => ({
      ...f,
      notes: '',
      location: 'U klienta',
      startDate: toLocalDateValue(start),
      startTime: toLocalTimeValue(start),
      endDate: toLocalDateValue(start),
      endTime: toLocalTimeValue(end),
      clientFirstName: '',
      clientLastName: '',
      clientPhone: '',
      clientEmail: '',
      clientStreet: '',
      clientCity: '',
      postalCode: '',
      clientCategory: 'PV',
      pvInstalled: '',
      billRange: '',
      extraComments: '',
      newRules: '',
      buildingType: '',
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
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [attachmentsError, setAttachmentsError] = useState<string | null>(null)
  const [showCalc, setShowCalc] = useState(false)
  const [offers, setOffers] = useState<Array<{ id: string; fileName: string; createdAt: string }>>([])
  const [calcInitialSnapshot, setCalcInitialSnapshot] = useState<any | null>(null)
  const [calcKey, setCalcKey] = useState<string>('')
  const [editClientId, setEditClientId] = useState<string | null>(null)

  async function loadAttachments(meetingId: string) {
    try {
      setAttachmentsLoading(true)
      setAttachmentsError(null)
      const list = await listMeetingAttachments(meetingId)
      setAttachments(list)
    } catch (e: any) {
      setAttachmentsError(e?.response?.data?.error || 'Nie udało się pobrać załączników')
    } finally {
      setAttachmentsLoading(false)
    }
  }

  async function onSelect(slot: SlotInfo) {
    setCreateError(null)
    const start = roundToNextFullHour(slot.start as Date)
    const end = addHours(start, 1)
    setCreateForm(f => ({
      ...f,
      notes: '',
      location: '',
      startDate: toLocalDateValue(start),
      startTime: toLocalTimeValue(start),
      endDate: toLocalDateValue(start),
      endTime: toLocalTimeValue(end),
      clientFirstName: '',
      clientLastName: '',
      clientPhone: '',
      clientEmail: '',
      clientStreet: '',
      clientCity: '',
      postalCode: '',
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
      notes: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
      clientFirstName: c.firstName || '',
      clientLastName: c.lastName || '',
      clientPhone: c.phone || '',
      clientEmail: c.email || '',
      clientStreet: c.street || '',
      clientCity: c.city || '',
      postalCode: c.postalCode || '',
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

  async function fillCreateAddressFromGeolocation() {
    try {
      if (!('geolocation' in navigator)) { alert('Geolokalizacja nie jest dostępna'); return }
      setGeoLoading(true)
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 })
      })
      const { latitude, longitude } = position.coords
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&zoom=18&addressdetails=1&accept-language=pl`
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error('Reverse geocoding failed')
      const data: any = await res.json()
      const addr = data?.address || {}
      const road = addr.road || addr.footway || addr.pedestrian || ''
      const house = addr.house_number || ''
      const city = addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || ''
      const postal = addr.postcode || ''
      const street = [road, house].filter(Boolean).join(' ')
      setCreateForm(f => ({ ...f, clientStreet: street || f.clientStreet, clientCity: city || f.clientCity, postalCode: postal || f.postalCode }))
    } catch (e: any) {
      alert('Nie udało się pobrać lokalizacji. Upewnij się, że zezwoliłeś na dostęp do lokalizacji.')
    } finally {
      setGeoLoading(false)
    }
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
        postalCode: createForm.postalCode || undefined,
        category: createForm.clientCategory || undefined,
        newRules: createForm.newRules === 'TAK' ? true : (createForm.newRules === 'NIE' ? false : undefined),
        buildingType: createForm.buildingType || undefined,
        billRange: createForm.billRange || undefined,
        pvInstalled: createForm.pvInstalled ? (createForm.pvInstalled === 'TAK') : undefined,
        pvPower: createForm.pvPower ? Number(String(createForm.pvPower).replace(',','.')) : undefined,
        extraComments: createForm.extraComments || undefined,
      }
      // Only send client if any field provided
      const hasClient = Object.values(client).some(v => v && `${v}`.trim() !== '')
      const pvInstalled = createForm.pvInstalled ? (createForm.pvInstalled === 'TAK') : undefined
      const billRange = createForm.billRange || undefined
      const extraComments = createForm.extraComments || undefined
      const payload = {
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
      }
      if (navigator.onLine) {
        await api.post('/api/meetings', payload)
      } else {
        const localId = newLocalId('meeting')
        const optimistic = { id: localId, scheduledAt, endsAt, notes: payload.notes, location: payload.location, attendeeId }
        await offlineStore.put('meetings', optimistic)
        setMeetings(prev => [...prev, optimistic as any])
        await pendingQueue.enqueue({ id: newLocalId('att'), method: 'POST', url: (import.meta.env.VITE_API_BASE || '') + '/api/meetings', body: payload, headers: {}, createdAt: Date.now(), entityStore: 'meetings', localId })
      }
      setIsCreateOpen(false)
      if (navigator.onLine) await refreshMeetings()
    } catch (e: any) {
      setCreateError(e?.response?.data?.error || e?.message || 'Nie udało się utworzyć spotkania')
    }
  }

  async function onEventDrop(eventId: string, start: Date, end: Date) {
    try {
      const payload: any = { scheduledAt: start.toISOString(), endsAt: end?.toISOString?.() || undefined, status: 'Przełożone' }
      if (navigator.onLine) {
        await api.patch(`/api/meetings/${eventId}`, payload)
      } else {
        await pendingQueue.enqueue({ id: newLocalId('att'), method: 'PATCH', url: (import.meta.env.VITE_API_BASE || '') + `/api/meetings/${eventId}`, body: payload, headers: {}, createdAt: Date.now(), entityStore: 'meetings' })
      }
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
      await loadAttachments(eventId)
      setEditClientId(m.clientId || null)
      if (m.clientId) {
        try { const offs = await listClientOffers(m.clientId); setOffers(offs) } catch {}
      } else {
        setOffers([])
      }
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
      if (navigator.onLine) {
        await api.patch(`/api/meetings/${editMeetingId}`, payload)
      } else {
        await pendingQueue.enqueue({ id: newLocalId('att'), method: 'PATCH', url: (import.meta.env.VITE_API_BASE || '') + `/api/meetings/${editMeetingId}`, body: payload, headers: {}, createdAt: Date.now(), entityStore: 'meetings' })
      }
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
      if (navigator.onLine) {
        await api.delete(`/api/meetings/${editMeetingId}`)
      } else {
        await pendingQueue.enqueue({ id: newLocalId('att'), method: 'DELETE', url: (import.meta.env.VITE_API_BASE || '') + `/api/meetings/${editMeetingId}`, headers: {}, createdAt: Date.now(), entityStore: 'meetings' })
      }
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
          {!navigator.onLine && (
            <span className="text-warning" style={{ fontSize: 12 }}>Jesteś offline – zmiany zsynchronizują się po odzyskaniu internetu</span>
          )}
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
        <div className="modal-overlay sheet">
          <div className="modal-content sheet" style={{ maxWidth: '560px' }}>
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
                  <label className="form-label">Data</label>
                  <input className="form-input" type="date" value={createForm.startDate} onChange={e => {
                    const startDate = e.target.value
                    const next = { ...createForm, startDate, endDate: startDate }
                    setCreateForm(next)
                  }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Godzina</label>
                  <input className="form-input" type="time" step={3600} value={createForm.startTime} onChange={e => {
                    const startTime = e.target.value.replace(/:\d{2}$/,'') + ':00'
                    const { endDate, endTime } = computeEndForStart(createForm.startDate, startTime)
                    setCreateForm({ ...createForm, startTime, endDate, endTime })
                  }} />
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
            <div className="form-grid-2">
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
              {/* Pola klienta */}
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
                <label>Ulica</label>
                <input value={createForm.clientStreet} onChange={e => setCreateForm({ ...createForm, clientStreet: e.target.value })} />
              </div>
              <div>
                <label>Miasto</label>
                <input value={createForm.clientCity} onChange={e => setCreateForm({ ...createForm, clientCity: e.target.value })} />
              </div>
              <div>
                <label>Kod pocztowy</label>
                <input value={createForm.postalCode} onChange={e => setCreateForm({ ...createForm, postalCode: e.target.value })} />
              </div>
              <div>
                <label>E-mail</label>
                <input value={createForm.clientEmail} onChange={e => setCreateForm({ ...createForm, clientEmail: e.target.value })} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <button className="secondary" onClick={fillCreateAddressFromGeolocation} disabled={geoLoading}>{geoLoading ? 'Pobieram położenie…' : 'Dodaj położenie'}</button>
              </div>
              <div>
                <label>Kategoria</label>
                <select value={createForm.clientCategory} onChange={e => setCreateForm({ ...createForm, clientCategory: e.target.value })}>
                  <option value="PV">PV</option>
                  <option value="ME">ME</option>
                </select>
              </div>
              {/* Sekcja Oferta przeniesiona pod wszystkie pola klienta */}
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>Oferta</strong>
                  <button className="secondary" disabled={!selectedClientId} onClick={() => setShowCalc(s => !s)}>{showCalc ? 'Ukryj kalkulator' : 'Dodaj ofertę'}</button>
                </div>
                {!selectedClientId && <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Aby dodać ofertę, wybierz najpierw klienta.</div>}
                {showCalc && (
                  <div style={{ marginTop: 8 }}>
                    <EmbeddedCalculator
                      key={calcKey}
                      clientId={(selectedClientId || '')}
                      initialSnapshot={calcInitialSnapshot || undefined}
                      onSaved={async () => {
                        setShowCalc(false)
                        setCalcInitialSnapshot(null)
                        if (selectedClientId) { try { const offs = await listClientOffers(selectedClientId); setOffers(offs) } catch {} }
                      }}
                    />
                  </div>
                )}
                <div className="card" style={{ marginTop: 8 }}>
                  <div className="flex justify-between items-center mb-2">
                    <strong>Oferty klienta</strong>
                  </div>
                  {offers.length === 0 ? <div className="text-sm text-gray-500">Brak ofert</div> : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                      {offers.map(o => (
                        <li key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <span>{o.fileName}</span>
                          <span style={{ display: 'flex', gap: 6 }}>
                            <a className="btn btn-sm" href={downloadOffer(o.id)} target="_blank" rel="noreferrer">Pobierz</a>
                            <button className="btn btn-sm secondary" onClick={async () => {
                              try {
                                const meta = await fetchOffer(o.id)
                                setCalcInitialSnapshot(meta.snapshot)
                                setCalcKey(o.id)
                                setShowCalc(true)
                              } catch {}
                            }}>Edytuj</button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
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
            <div className="form-grid-2">
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
                {createForm.pvInstalled === 'TAK' && (
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                    <div>
                      <label>Nowe zasady (net-billing)</label>
                      <div>
                        <label style={{ marginRight: 12 }}>
                          <input type="radio" name="newRulesCreateCal" checked={createForm.newRules === 'TAK'} onChange={() => setCreateForm({ ...createForm, newRules: 'TAK' })} /> TAK (nowe)
                        </label>
                        <label>
                          <input type="radio" name="newRulesCreateCal" checked={createForm.newRules === 'NIE'} onChange={() => setCreateForm({ ...createForm, newRules: 'NIE' })} /> NIE (stare)
                        </label>
                      </div>
                    </div>
                    <div>
                      <label>Jaka moc (kW)</label>
                      <input type="number" step="0.1" min="0" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" value={(createForm as any).pvPower || ''} onChange={e => setCreateForm({ ...createForm, pvPower: e.target.value } as any)} />
                    </div>
                  </div>
                )}
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
              <div>
                <label>Rodzaj zabudowy</label>
                <div>
                  <label style={{ marginRight: 12 }}>
                    <input type="radio" name="buildingTypeCreateCal" checked={createForm.buildingType === 'Dom'} onChange={() => setCreateForm({ ...createForm, buildingType: 'Dom' })} /> Dom
                  </label>
                  <label>
                    <input type="radio" name="buildingTypeCreateCal" checked={createForm.buildingType === 'Gospodarstwo'} onChange={() => setCreateForm({ ...createForm, buildingType: 'Gospodarstwo' })} /> Gospodarstwo
                  </label>
                </div>
              </div>
              {/* przeniesione wyżej pod pytaniem o PV */}
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
        <div className="modal-overlay sheet">
          <div className="modal-content sheet" style={{ maxWidth: '560px' }}>
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
            <div className="form-grid-2">
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
            <div className="form-grid-2">
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

            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--gray-200)' }}>
              <strong>Załączniki</strong>
              {editForm.status === 'Sukces' && (
                <div style={{ marginTop: 8 }}>
                  <label className="form-label">Dodaj pliki</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={async (e) => {
                      const files = Array.from(e.currentTarget.files || [])
                      if (files.length === 0 || !editMeetingId) return
                      try {
                        const meeting = await api.get<any>(`/api/meetings/${editMeetingId}`)
                        const cid = meeting.data?.clientId
                        if (!cid) return
                        if (navigator.onLine) {
                          await uploadAttachments(editMeetingId, cid, files as File[])
                          e.currentTarget.value = ''
                          await loadAttachments(editMeetingId)
                        } else {
                          for (const f of files as File[]) {
                            const id = newLocalId('att')
                            await offlineStore.put('attachments', { id, meetingId: editMeetingId, clientId: cid, fileName: f.name, data: f, uploaded: false })
                          }
                          e.currentTarget.value = ''
                        }
                      } catch {}
                    }}
                  />
                </div>
              )}
              {attachmentsLoading ? (
                <div className="muted" style={{ fontSize: 12 }}>Ładowanie…</div>
              ) : attachmentsError ? (
                <div className="text-error text-sm">{attachmentsError}</div>
              ) : attachments.length === 0 ? (
                <div className="muted" style={{ fontSize: 12 }}>Brak załączników</div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0 0 0', display: 'grid', gap: 6 }}>
                  {attachments.map(a => (
                    <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.fileName}</span>
                      <span style={{ display: 'flex', gap: 6 }}>
                        <a className="btn btn-sm secondary" href={viewAttachmentUrl(a.id)} target="_blank" rel="noreferrer">Podgląd</a>
                        <a className="btn btn-sm" href={downloadAttachmentUrl(a.id)} target="_blank" rel="noreferrer">Pobierz</a>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--gray-200)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>Oferta</strong>
                <button className="secondary" onClick={() => setShowCalc(s => !s)}>{showCalc ? 'Ukryj kalkulator' : 'Dodaj ofertę'}</button>
              </div>
              {showCalc && (
                <EmbeddedCalculator key={calcKey} clientId={(editClientId || '')} meetingId={editMeetingId || undefined} offerId={(() => { const m = offers.find(x => x.id === calcKey); return m ? calcKey : undefined })()} initialSnapshot={calcInitialSnapshot || undefined} onSaved={async () => {
                  setShowCalc(false)
                  try {
                    if (editClientId) { const offs = await listClientOffers(editClientId); setOffers(offs) }
                  } catch {}
                }} />
              )}
              <div className="card" style={{ marginTop: 8 }}>
                <div className="flex justify-between items-center mb-2">
                  <strong>Oferty klienta</strong>
                </div>
                {offers.length === 0 ? <div className="text-sm text-gray-500">Brak ofert</div> : (
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
                    {offers.map(o => (
                      <li key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span>{o.fileName}</span>
                        <span style={{ display: 'flex', gap: 6 }}>
                          <a className="btn btn-sm" href={downloadOffer(o.id)} target="_blank" rel="noreferrer">Pobierz</a>
                          <button className="btn btn-sm secondary" onClick={async () => {
                            try {
                              const meta = await fetchOffer(o.id)
                              setCalcInitialSnapshot(meta.snapshot)
                              setCalcKey(o.id)
                              setShowCalc(true)
                            } catch {}
                          }}>Edytuj</button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '6px 0', marginTop: 8 }} onClick={() => setEditSectionsOpen(s => ({ ...s, extra: !s.extra }))}>
              <strong>Dodatkowe informacje</strong>
              <button className="secondary" onClick={(e) => { e.stopPropagation(); setEditSectionsOpen(s => ({ ...s, extra: !s.extra })) }} aria-label="toggle">
                {editSectionsOpen.extra ? '▲' : '▼'}
              </button>
            </div>
            {editSectionsOpen.extra && (
            <div className="form-grid-2">
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


