import { useEffect, useMemo, useState } from 'react'
import InstallPrompt from './components/InstallPrompt'
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation, Link } from 'react-router-dom'
import './App.css'

import { fetchLeads } from './lib/api'
import api from './lib/api'
import type { Client } from './lib/api'
import Login from './pages/Login'
import CalendarPage from './pages/Calendar'
import ClientsPage from './pages/Clients'
import SalesPage from './pages/Sales'
import MyClientsPage from './pages/MyClients'
import CalculatorPage from './pages/Calculator'
import CalculatorSettingsPage from './pages/CalculatorSettings'
import AccountPage from './pages/Account'
import StatsPage from './pages/Stats'
import ManagerStatsPage from './pages/ManagerStats'
import { clearAuth, getToken, getUser } from './lib/auth'
import MobileNav from './components/MobileNav'
import Logo from './components/Logo'

function QuickTile({ label, to, icon }: { label: string; to: string; icon: React.ReactNode }) {
  return (
    <Link to={to} className="quick-tile" aria-label={label}>
      <div className="quick-tile-icon">{icon}</div>
      <div className="quick-tile-label">{label}</div>
    </Link>
  )
}

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
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [managerStats, setManagerStats] = useState({ leads: 0, past: 0, future: 0, rescheduled: 0, contracts: 0, effectiveness: 0 })
  const [managerLoading, setManagerLoading] = useState(false)
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
    contactConsent: false,
  })
  const [clientQuery, setClientQuery] = useState('')
  const [clientOptions, setClientOptions] = useState<Client[]>([])
  const [isSearchingClients, setIsSearchingClients] = useState(false)
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [teamUsers, setTeamUsers] = useState<Array<{ id: string; firstName: string; lastName: string }>>([])
  const [selectedTeamUserId, setSelectedTeamUserId] = useState<string | null>(null)
  const [managerUpcoming, setManagerUpcoming] = useState<Array<{ id: string; date: string; time: string; place: string; topic: string }>>([])
  const [managerRecent, setManagerRecent] = useState<Array<{ id: string; date: string; time: string; place: string; topic: string }>>([])

  async function refreshManagerAggregates() {
    if (!user || user.role !== 'MANAGER') return
    setManagerLoading(true)
    try {
      const usersRes = await api.get<Array<{ id: string; firstName: string; lastName: string; role: string; managerId?: string | null }>>('/api/users')
      const team = usersRes.data.filter(u => u.role === 'SALES_REP' && u.managerId === user.id)
      setTeamUsers(team.map(t => ({ id: t.id, firstName: t.firstName, lastName: t.lastName })))
      if (team.length > 0) {
        const allMeetingsArrays = await Promise.all(team.map(u => api.get<any[]>(`/api/meetings`, { params: { userId: u.id } }).then(r => r.data).catch(() => [])))
        const allMeetings = ([] as any[]).concat(...allMeetingsArrays)
        const nowTs = Date.now()
        const past = allMeetings.filter(m => new Date(m.scheduledAt).getTime() <= nowTs)
        const future = allMeetings.filter(m => new Date(m.scheduledAt).getTime() > nowTs)
        const rescheduled = allMeetings.filter(m => (m as any).status === 'Dogrywka')
        const contracts = allMeetings.filter(m => (m as any).status === 'Sukces')
        const clientIds = new Set<string>()
        for (const m of allMeetings) {
          const cid = (m as any).clientId as string | undefined
          if (cid) clientIds.add(cid)
        }
        const effectiveness = past.length > 0 ? Math.round((contracts.length / past.length) * 100) : 0
        setManagerStats({ leads: clientIds.size, past: past.length, future: future.length, rescheduled: rescheduled.length, contracts: contracts.length, effectiveness })

        const upcoming = future
          .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
          .slice(0, 5)
          .map(m => ({
            id: m.id as string,
            date: new Date(m.scheduledAt).toLocaleDateString(),
            time: new Date(m.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            place: (m as any).location || '—',
            topic: (m as any).notes || 'Spotkanie',
          }))
        setManagerUpcoming(upcoming)

        const recent = past
          .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
          .slice(0, 5)
          .map(m => ({
            id: m.id as string,
            date: new Date(m.scheduledAt).toLocaleDateString(),
            time: new Date(m.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            place: (m as any).location || '—',
            topic: (m as any).notes || 'Spotkanie',
          }))
        setManagerRecent(recent)
      } else {
        setManagerStats({ leads: 0, past: 0, future: 0, rescheduled: 0, contracts: 0, effectiveness: 0 })
        setManagerUpcoming([])
        setManagerRecent([])
      }
    } finally {
      setManagerLoading(false)
    }
  }

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const data = await fetchLeads()
        setLeads(data)
        // load meetings for current user
        const res = await api.get<any[]>('/api/meetings')
        setMeetings(res.data)
        // If manager, also load team-wide stats and upcoming
        if (user && user.role === 'MANAGER') await refreshManagerAggregates()
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

  useEffect(() => {
    try { setHeaderCollapsed(localStorage.getItem('headerCollapsed') === '1') } catch {}
  }, [])
  function collapseHeader() {
    setHeaderCollapsed(true)
    try { localStorage.setItem('headerCollapsed', '1') } catch {}
  }
  function expandHeader() {
    setHeaderCollapsed(false)
    try { localStorage.setItem('headerCollapsed', '0') } catch {}
  }

  const stats = useMemo(() => {
    const now = Date.now()
    let pastCount = 0
    let futureCount = 0
    let successPast = 0
    let unfinishedPast = 0
    for (const m of meetings) {
      const isPast = new Date(m.scheduledAt).getTime() <= now
      if (isPast) {
        pastCount += 1
        const status = (m as any).status as string | undefined
        const hasStatus = !!status && status.trim() !== ''
        if (status === 'Sukces') successPast += 1
        if (!hasStatus) unfinishedPast += 1
      } else {
        futureCount += 1
      }
    }
    const skutecznosc = pastCount > 0 ? Math.round((successPast / pastCount) * 100) : 0
    return { pastCount, futureCount, successPast, skutecznosc, unfinishedPast }
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
      contactConsent: false,
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
      if (!createForm.contactConsent) {
        setCreateError('Aby zapisać wydarzenie, zaznacz wymagany checkbox zgody.')
        return
      }
      const attendeeId = (user && user.role === 'MANAGER' && selectedTeamUserId) ? selectedTeamUserId : user!.id
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
        contactConsent: true,
      })
      setIsCreateOpen(false)
      const res = await api.get<any[]>('/api/meetings')
      setMeetings(res.data)
      await refreshManagerAggregates()
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
      // include extra fields
      if (editForm.pvInstalled) payload.pvInstalled = editForm.pvInstalled === 'TAK'
      if (editForm.billRange) payload.billRange = editForm.billRange
      if (editForm.extraComments) payload.extraComments = editForm.extraComments
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

      {headerCollapsed ? (
      <div className="dashboard-compact">
        <div className="dashboard-compact-left">
          <span className="muted">Witaj{user ? `, ${user.firstName}` : ''}!</span>
        </div>
        <div className="dashboard-compact-right">
          <div className="points-chip">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            {points} pkt
          </div>
          <button className="primary btn-sm" onClick={openCreate}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nowe spotkanie
          </button>
          <button aria-label="Pokaż panel" className="icon-button" onClick={expandHeader}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 12h16"/>
            </svg>
          </button>
        </div>
      </div>
      ) : (
      <div className="dashboard-header">
        <button aria-label="Zamknij panel" className="icon-button close" onClick={collapseHeader}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{
            fontSize: 'var(--text-5xl)',
            fontWeight: 900,
            marginBottom: 'var(--space-3)',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.8) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
            lineHeight: 1.1
          }}>
            Witaj{user ? `, ${user.firstName}` : ''}! 
            <span style={{ 
              display: 'inline-block',
              marginLeft: 'var(--space-3)',
              transform: 'rotate(10deg)',
              fontSize: 'var(--text-4xl)'
            }}>👋</span>
          </h1>
          <p style={{
            fontSize: 'var(--text-xl)',
            fontWeight: 500,
            color: 'rgba(255, 255, 255, 0.9)',
            lineHeight: 1.6,
            maxWidth: '600px'
          }}>
            Zarządzaj swoimi leadami, planuj spotkania i śledź wyniki sprzedaży w nowoczesnym środowisku CRM.
          </p>
        </div>
        <div style={{ 
          display: 'flex', 
          gap: 'var(--space-4)', 
          flexWrap: 'wrap', 
          alignItems: 'center',
          marginTop: 'var(--space-6)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 'var(--space-3)', 
            padding: 'var(--space-4) var(--space-6)', 
            background: 'rgba(255, 255, 255, 0.15)', 
            backdropFilter: 'blur(10px)',
            borderRadius: 'var(--radius-2xl)', 
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: 'white',
            fontSize: 'var(--text-base)',
            fontWeight: 700,
            boxShadow: 'var(--shadow-glass-sm)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: 'var(--radius-lg)'
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <span>{points} punktów</span>
          </div>
          <button 
            className="primary" 
            onClick={openCreate}
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              color: 'var(--primary-600)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              backdropFilter: 'blur(10px)',
              padding: 'var(--space-4) var(--space-6)',
              borderRadius: 'var(--radius-2xl)',
              fontSize: 'var(--text-base)',
              fontWeight: 700,
              boxShadow: 'var(--shadow-glass-md)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nowe spotkanie
          </button>
        </div>
      </div>
      )}

      <div className="grid">
        {/* Quick Action Tiles */}
        <section className="actions-bar" style={{ gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <h3 className="card-title" style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, margin: 0, background: 'linear-gradient(135deg, var(--gray-900) 0%, var(--gray-700) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Szybkie akcje</h3>
          </div>
          <div className="quick-grid">
            <QuickTile label="Kalendarz" to="/calendar" icon={(
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            )} />
            <QuickTile label="Klienci" to={user?.role === 'MANAGER' || user?.role === 'ADMIN' ? '/clients' : '/my-clients'} icon={(
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            )} />
            <QuickTile label="Kalkulator" to="/calculator" icon={(
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="4" y="3" width="16" height="18" rx="2"/>
                <rect x="7" y="7" width="10" height="4" rx="1"/>
                <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>
              </svg>
            )} />
            {user?.role === 'MANAGER' && (
              <QuickTile label="Zespół" to="/sales" icon={(
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Z"/>
                  <path d="M20 21a8 8 0 0 0-16 0"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                </svg>
              )} />
            )}
          </div>
        </section>
        {user?.role === 'MANAGER' ? (
          <>
          <section className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="card-title">Najbliższe spotkania zespołu</h3>
              <span className="text-sm text-gray-400">{managerUpcoming.length} z 5</span>
            </div>
            {managerUpcoming.length === 0 ? (
              <div className="text-center text-gray-500" style={{ padding: '2rem 0' }}>
                <p>Brak nadchodzących spotkań</p>
              </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {managerUpcoming.map(m => (
                <div key={m.id} className="meeting-item" onClick={() => openEdit(m.id)}>
                  <div className="flex items-center gap-3">
                    <div style={{ flexShrink: 0 }}>
                      <div className="meeting-time">{m.date}</div>
                      <div className="meeting-time text-primary">{m.time}</div>
                    </div>
                    <div>
                      <div className="meeting-topic font-medium">{m.topic}</div>
                      <div className="meeting-location">{m.place}</div>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--gray-400)' }}>
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              ))}
            </div>
            )}
          </section>
          <section className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="card-title">Ostatnie spotkania zespołu</h3>
              <span className="text-sm text-gray-400">{managerRecent.length} z 5</span>
            </div>
            {managerRecent.length === 0 ? (
              <div className="text-center text-gray-500" style={{ padding: '2rem 0' }}>
                <p>Brak ostatnich spotkań</p>
              </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {managerRecent.map(m => (
                <div key={m.id} className="meeting-item" onClick={() => openEdit(m.id)}>
                  <div className="flex items-center gap-3">
                    <div style={{ flexShrink: 0 }}>
                      <div className="meeting-time">{m.date}</div>
                      <div className="meeting-time text-primary">{m.time}</div>
                    </div>
                    <div>
                      <div className="meeting-topic font-medium">{m.topic}</div>
                      <div className="meeting-location">{m.place}</div>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--gray-400)' }}>
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              ))}
            </div>
            )}
          </section>
          <section className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="card-title">Statystyki zespołu</h3>
              {managerLoading && <span className="text-sm text-gray-400">Ładuję…</span>}
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value" style={{ color: 'var(--primary-600)' }}>{managerStats.leads}</span>
                <span className="stat-label">Leady</span>
              </div>
              <div className="stat-card">
                <span className="stat-value text-success">{managerStats.past}</span>
                <span className="stat-label">Odbyte</span>
              </div>
              <div className="stat-card">
                <span className="stat-value" style={{ color: 'var(--primary-600)' }}>{managerStats.future}</span>
                <span className="stat-label">Umówione</span>
              </div>
              <div className="stat-card">
                <span className="stat-value" style={{ color: 'var(--warning-600)' }}>{managerStats.rescheduled}</span>
                <span className="stat-label">Przełożone</span>
              </div>
              <div className="stat-card">
                <span className="stat-value" style={{ color: 'var(--success-600)' }}>{managerStats.contracts}</span>
                <span className="stat-label">Umowy</span>
              </div>
              <div className="stat-card">
                <span className="stat-value" style={{ color: 'var(--warning-600)' }}>{managerStats.effectiveness}%</span>
                <span className="stat-label">Skuteczność</span>
              </div>
            </div>
          </section>
          </>
        ) : (
          <>
          <section className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="card-title">Twoje nadchodzące spotkania</h3>
              <span className="text-sm text-gray-400">{upcoming.length} spotkań</span>
            </div>
            {upcoming.length === 0 ? (
              <div className="text-center text-gray-500" style={{ padding: '2rem 0' }}>
                <svg style={{ margin: '0 auto 1rem', display: 'block' }} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <p>Brak nadchodzących spotkań</p>
              </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {upcoming.map(m => (
                <div key={m.id} className="meeting-item" onClick={() => openEdit(m.id)}>
                  <div className="flex items-center gap-3">
                    <div style={{ flexShrink: 0 }}>
                      <div className="meeting-time">{m.date}</div>
                      <div className="meeting-time text-primary">{m.time}</div>
                    </div>
                    <div>
                      <div className="meeting-topic font-medium">{m.topic}</div>
                      <div className="meeting-location">{m.place}</div>
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--gray-400)' }}>
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </div>
              ))}
            </div>
            )}
          </section>
          <section className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="card-title">Twoje statystyki</h3>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value text-success">{stats.pastCount}</span>
                <span className="stat-label">Odbyte</span>
              </div>
              <div className="stat-card">
                <span className="stat-value" style={{ color: 'var(--primary-600)' }}>{stats.futureCount}</span>
                <span className="stat-label">Umówione</span>
              </div>
              <div className="stat-card">
                <span className="stat-value" style={{ color: 'var(--warning-600)' }}>{stats.skutecznosc}%</span>
                <span className="stat-label">Skuteczność</span>
              </div>
              <div className="stat-card">
                <span className="stat-value" style={{ color: 'var(--error-600)' }}>{stats.unfinishedPast}</span>
                <span className="stat-label">Nie zamknięte</span>
              </div>
            </div>
          </section>
          <section className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="card-title">Twoje ostatnie spotkania</h3>
              <span className="text-sm text-gray-400">{recent.length} spotkań</span>
            </div>
            {recent.length === 0 ? (
              <div className="text-center text-gray-500" style={{ padding: '2rem 0' }}>
                <p>Brak ostatnich spotkań</p>
              </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {recent.map(m => (
                  <div key={m.id} className="meeting-item" onClick={() => openEdit(m.id)}>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                      {(() => {
                        const color = m.status === 'Sukces' ? '#16a34a' : m.status === 'Porażka' ? '#dc2626' : m.status === 'Dogrywka' ? '#f59e0b' : '#94a3b8'
                        return <span title={m.status || 'brak statusu'} className="status-dot" style={{ background: color }} />
                      })()}
                      </div>
                      <div style={{ flexShrink: 0 }}>
                        <div className="meeting-time">{m.date}</div>
                        <div className="meeting-time text-primary">{m.time}</div>
                      </div>
                      <div>
                        <div className="meeting-topic font-medium">{m.topic}</div>
                        <div className="meeting-location">{m.place}</div>
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--gray-400)' }}>
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                ))}
            </div>
            )}
          </section>
          </>
        )}
      </div>


      {user?.role !== 'MANAGER' && loading && <div className="text-center text-gray-500 mt-6">Ładowanie danych…</div>}
      {user?.role !== 'MANAGER' && !loading && <div className="text-center text-gray-500 mt-6 text-sm">Leady w systemie: {leads.length}</div>}

      {isCreateOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Nowe spotkanie</h3>
              <button className="secondary" onClick={() => setIsCreateOpen(false)} style={{ padding: 'var(--space-2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="form-grid-2">
              {user?.role === 'MANAGER' && teamUsers.length > 0 && (
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Przypisz do handlowca</label>
                  <select className="form-select" value={selectedTeamUserId || ''} onChange={e => setSelectedTeamUserId(e.target.value || null)}>
                    <option value="">— wybierz handlowca —</option>
                    {teamUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                    ))}
                  </select>
                </div>
              )}
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
              <div className="form-group">
                <label className="form-label">Początek - Data</label>
                <input className="form-input" type="date" value={createForm.startDate} onChange={e => setCreateForm({ ...createForm, startDate: e.target.value, endDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Początek - Godzina</label>
                <input className="form-input" type="time" value={createForm.startTime} onChange={e => setCreateForm({ ...createForm, startTime: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Koniec - Data</label>
                <input className="form-input" type="date" value={createForm.endDate} onChange={e => setCreateForm({ ...createForm, endDate: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Koniec - Godzina</label>
                <input className="form-input" type="time" value={createForm.endTime} onChange={e => setCreateForm({ ...createForm, endTime: e.target.value })} />
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--gray-200)' }}>
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Dane klienta (opcjonalnie)</h4>
              <div className="form-grid-2">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Wybierz klienta z bazy</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-input"
                      placeholder="Szukaj po imieniu, nazwisku, telefonie, e-mailu, adresie..."
                      value={clientQuery}
                      onChange={e => { setClientQuery(e.target.value); setSelectedClientId(null) }}
                    />
                    {isSearchingClients && <div className="text-xs text-gray-500 mt-1">Szukam…</div>}
                    {!isSearchingClients && clientOptions.length > 0 && (
                      <div className="autocomplete-dropdown">
                        {clientOptions.map(c => (
                          <div key={c.id} className="autocomplete-item" onClick={() => onPickClient(c)}>
                            <div className="font-medium">{c.firstName} {c.lastName}</div>
                            <div className="text-xs text-gray-500">{[c.phone, c.email, c.city, c.street].filter(Boolean).join(' • ')}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Imię</label>
                  <input className="form-input" value={createForm.clientFirstName} onChange={e => setCreateForm({ ...createForm, clientFirstName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nazwisko</label>
                  <input className="form-input" value={createForm.clientLastName} onChange={e => setCreateForm({ ...createForm, clientLastName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input className="form-input" value={createForm.clientPhone} onChange={e => setCreateForm({ ...createForm, clientPhone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail</label>
                  <input className="form-input" value={createForm.clientEmail} onChange={e => setCreateForm({ ...createForm, clientEmail: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ulica</label>
                  <input className="form-input" value={createForm.clientStreet} onChange={e => setCreateForm({ ...createForm, clientStreet: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Miasto</label>
                  <input className="form-input" value={createForm.clientCity} onChange={e => setCreateForm({ ...createForm, clientCity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Kategoria</label>
                  <input className="form-input" value={createForm.clientCategory} onChange={e => setCreateForm({ ...createForm, clientCategory: e.target.value })} />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--gray-200)' }}>
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Dodatkowe informacje</h4>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Czy posiada instalację PV?</label>
                  <div className="radio-group">
                    <label className="radio-item">
                      <input type="radio" name="pvInstalledCreateDash" checked={createForm.pvInstalled === 'TAK'} onChange={() => setCreateForm({ ...createForm, pvInstalled: 'TAK' })} />
                      <span>TAK</span>
                    </label>
                    <label className="radio-item">
                      <input type="radio" name="pvInstalledCreateDash" checked={createForm.pvInstalled === 'NIE'} onChange={() => setCreateForm({ ...createForm, pvInstalled: 'NIE' })} />
                      <span>NIE</span>
                    </label>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Wysokość rachunków (zł)</label>
                  <select className="form-select" value={createForm.billRange} onChange={e => setCreateForm({ ...createForm, billRange: e.target.value })}>
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
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Komentarz/uwagi</label>
                  <textarea className="form-textarea" rows={3} value={createForm.extraComments} onChange={e => setCreateForm({ ...createForm, extraComments: e.target.value })} />
                </div>
              </div>
            </div>

            {createError && <div className="text-error text-sm mt-4 p-3 bg-error-50 rounded border border-error-200">{createError}</div>}

            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'start', gap: 8, width: '100%' }}>
                <input type="checkbox" checked={createForm.contactConsent} onChange={e => setCreateForm({ ...createForm, contactConsent: e.target.checked })} style={{ marginTop: 2 }} />
                <span style={{ color: 'var(--gray-800)' }}>Potwierdzam, że klient wyraził zgodę na przetwarzanie danych w celu kontaktu handlowego i przygotowania oferty.</span>
              </label>
            </div>

            <div className="modal-footer">
              <button className="secondary" onClick={() => setIsCreateOpen(false)}>Anuluj</button>
              <button className="primary" onClick={submitCreate}>Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {isEditOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Edycja spotkania</h3>
              <button className="secondary" onClick={() => { setIsEditOpen(false); setEditMeetingId(null) }} style={{ padding: 'var(--space-2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            {editLoading ? (
              <div className="text-center py-8">
                <div className="text-gray-500">Wczytywanie…</div>
              </div>
            ) : (
            <>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Temat/Notatka</label>
                <input className="form-input" value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Lokalizacja</label>
                <input className="form-input" value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Początek</label>
                <input className="form-input" type="datetime-local" value={editForm.startLocal} onChange={e => {
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
              <div className="form-group">
                <label className="form-label">Koniec</label>
                <input className="form-input" type="datetime-local" value={editForm.endLocal} onChange={e => setEditForm({ ...editForm, endLocal: e.target.value })} />
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--gray-200)' }}>
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Dane klienta</h4>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Imię</label>
                  <input className="form-input" value={editForm.clientFirstName} onChange={e => setEditForm({ ...editForm, clientFirstName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Nazwisko</label>
                  <input className="form-input" value={editForm.clientLastName} onChange={e => setEditForm({ ...editForm, clientLastName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input className="form-input" value={editForm.clientPhone} onChange={e => setEditForm({ ...editForm, clientPhone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">E-mail</label>
                  <input className="form-input" value={editForm.clientEmail} onChange={e => setEditForm({ ...editForm, clientEmail: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ulica</label>
                  <input className="form-input" value={editForm.clientStreet} onChange={e => setEditForm({ ...editForm, clientStreet: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Miasto</label>
                  <input className="form-input" value={editForm.clientCity} onChange={e => setEditForm({ ...editForm, clientCity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Kategoria</label>
                  <input className="form-input" value={editForm.clientCategory} onChange={e => setEditForm({ ...editForm, clientCategory: e.target.value })} />
                </div>
              </div>
            </div>

            {(() => {
              const now = new Date()
              const start = new Date(editForm.startLocal || now.toISOString())
              const isPast = start.getTime() < now.getTime()
              if (!isPast) return null
              return (
                <div style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--gray-200)' }}>
                  <h4 className="text-lg font-semibold text-gray-800 mb-4">Status spotkania</h4>
                  <div className="radio-group">
                    <label className="radio-item">
                      <input type="radio" name="meetingStatusDash" checked={editForm.status === 'Sukces'} onChange={() => setEditForm({ ...editForm, status: 'Sukces' })} />
                      <span>Sukces !</span>
                    </label>
                    <label className="radio-item">
                      <input type="radio" name="meetingStatusDash" checked={editForm.status === 'Porażka'} onChange={() => setEditForm({ ...editForm, status: 'Porażka' })} />
                      <span>Porażka</span>
                    </label>
                    <label className="radio-item">
                      <input type="radio" name="meetingStatusDash" checked={editForm.status === 'Dogrywka'} onChange={() => setEditForm({ ...editForm, status: 'Dogrywka' })} />
                      <span>Dogrywka</span>
                    </label>
                  </div>
                </div>
              )
            })()}

            {editError && <div className="text-error text-sm mt-4 p-3 bg-error-50 rounded border border-error-200">{editError}</div>}

            <div className="modal-footer">
              <button className="danger" onClick={deleteMeeting}>Usuń</button>
              <div className="flex gap-3">
                <button className="secondary" onClick={() => { setIsEditOpen(false); setEditMeetingId(null) }}>Anuluj</button>
                <button className="primary" onClick={submitEdit}>Zapisz</button>
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
  function useIsMobile() {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
      const mq = window.matchMedia('(max-width: 768px)')
      const update = () => setIsMobile(mq.matches)
      update()
      mq.addEventListener('change', update)
      return () => mq.removeEventListener('change', update)
    }, [])
    return isMobile
  }
  function NavBar() {
    const user = getUser()
    const [menuOpen, setMenuOpen] = useState(false)
    // function toggleTheme() {
    //   const isDark = document.documentElement.classList.toggle('dark')
    //   try { localStorage.setItem('theme', isDark ? 'dark' : 'light') } catch {}
    // }
    return (
      <nav className="navbar">
        <div className="brand"><Logo size={22} /></div>
        <button className="menu-toggle" aria-label="Otwórz menu" onClick={() => setMenuOpen(o => !o)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18"/>
          </svg>
        </button>
        <div className={`nav ${menuOpen ? 'open' : ''}`}>
          <NavLink to="/" className={({ isActive }) => isActive ? 'active' : undefined}>Home</NavLink>
          <NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : undefined}>Kalendarz</NavLink>
          {user && (user.role === 'ADMIN' || user.role === 'MANAGER') && (
            <NavLink to="/clients" className={({ isActive }) => isActive ? 'active' : undefined}>Klienci</NavLink>
          )}
          <NavLink to="/my-clients" className={({ isActive }) => isActive ? 'active' : undefined}>Moi klienci</NavLink>
          <NavLink to="/calculator" className={({ isActive }) => isActive ? 'active' : undefined}>Kalkulator ofertowy</NavLink>
          {user && user.role === 'MANAGER' && (
            <NavLink to="/sales" className={({ isActive }) => isActive ? 'active' : undefined}>Handlowcy</NavLink>
          )}
          <NavLink to="/stats" className={({ isActive }) => isActive ? 'active' : undefined}>Statystyki i Analityka</NavLink>
          <NavLink to="/account" className={({ isActive }) => isActive ? 'active' : undefined}>Moje Konto</NavLink>
          <button className="logout" onClick={() => { clearAuth(); location.href = '/login' }}>Wyloguj</button>
        </div>
      </nav>
    )
  }
  function Shell() {
    const location = useLocation()
    const isMobile = useIsMobile()
    const showNav = location.pathname !== '/login'
    return (
      <>
        {showNav && !isMobile && <NavBar />}
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/calendar" element={<Protected><CalendarPage /></Protected>} />
          <Route path="/clients" element={<Protected roles={['ADMIN','MANAGER']}><ClientsPage /></Protected>} />
          <Route path="/sales" element={<Protected roles={['MANAGER']}><SalesPage /></Protected>} />
          <Route path="/my-clients" element={<Protected><MyClientsPage /></Protected>} />
          <Route path="/calculator" element={<Protected><CalculatorPage /></Protected>} />
          <Route path="/calculator/settings" element={<Protected roles={['MANAGER']}><CalculatorSettingsPage /></Protected>} />
          <Route path="/stats" element={<Protected><StatsPage /></Protected>} />
          <Route path="/manager/stats" element={<Protected roles={['MANAGER']}><ManagerStatsPage /></Protected>} />
          <Route path="/account" element={<Protected><AccountPage /></Protected>} />
          <Route path="/admin" element={<Protected roles={['ADMIN']}><div className="container"><div className="page-header"><div><h1 className="page-title">Panel administratora</h1><p className="text-gray-600">Zarządzanie aplikacją</p></div></div><section className="card"><AdminPage /></section></div></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </>
    )
  }
  return (
    <BrowserRouter>
      <Shell />
      <MobileNav />
      <InstallPrompt />
    </BrowserRouter>
  )
}

export default App
