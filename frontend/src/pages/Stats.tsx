import { useEffect, useMemo, useState } from 'react'
import api, { fetchUsers, type AppUserSummary, fetchPointsLeaderboard } from '../lib/api'
import { getUser } from '../lib/auth'

type Meeting = { id: string; scheduledAt: string; status?: string | null }
type Range = 'week' | 'month' | 'quarter' | 'year'

export default function StatsPage() {
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
  const isMobile = useIsMobile()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('month')
  const [managers, setManagers] = useState<AppUserSummary[]>([])
  const [managerId, setManagerId] = useState('')
  const [view, setView] = useState<'stats' | 'ranking'>('stats')
  const [showPoints, setShowPoints] = useState(false)

  // Ranking state (ADMIN only)
  const [repLoading, setRepLoading] = useState(false)
  const [repError, setRepError] = useState<string | null>(null)
  const [metric, setMetric] = useState<'Spotkania' | 'Umowa' | 'Przełożone' | 'Odbyte' | 'Umówione' | 'Rezygnacja'>('Spotkania')
  const [ranking, setRanking] = useState<Array<{ id: string; firstName: string; lastName: string; total: number; byStatus: Record<string, number> }>>([])
  const [statusFilter, setStatusFilter] = useState<'' | 'Umowa' | 'Rezygnacja' | 'Przełożone' | 'Umówione' | 'Odbyte'>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Report modal state
  const [reportOpen, setReportOpen] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportConfig, setReportConfig] = useState({
    includeClients: true,
    includeMeetings: true,
    includeOffers: false,
    includeAttachments: false,
    includeUsers: false,
    includePoints: false,
    startDate: '',
    endDate: '',
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const me = getUser()
        if (me?.role === 'ADMIN') {
          // Admin: all meetings or filter by manager
          const res = await api.get<Meeting[]>('/api/meetings', { params: { managerId: managerId || undefined } })
          setMeetings(res.data)
        } else if (me?.role === 'MANAGER') {
          // Manager: aggregate team meetings
          const users = await fetchUsers()
          const team = users.filter(u => u.role === 'SALES_REP' && u.managerId === me.id)
          if (team.length > 0) {
            const arrays = await Promise.all(team.map(u => api.get<Meeting[]>('/api/meetings', { params: { userId: u.id } }).then(r => r.data).catch(() => [])))
            const data = ([] as Meeting[]).concat(...arrays)
            setMeetings(data)
          } else {
            setMeetings([])
          }
        } else {
          // Sales rep: own meetings
          const res = await api.get<Meeting[]>('/api/meetings')
          setMeetings(res.data)
        }
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Nie udało się pobrać danych')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [managerId])

  // Load managers for admin filter
  useEffect(() => {
    const me = getUser()
    if (me?.role !== 'ADMIN') return
    ;(async () => {
      try {
        const users = await fetchUsers()
        setManagers(users.filter(u => u.role === 'MANAGER'))
      } catch {}
    })()
  }, [])

  // Load ranking data for ADMIN when view is 'ranking'
  useEffect(() => {
    const me = getUser()
    if (me?.role !== 'ADMIN' || view !== 'ranking') return
    ;(async () => {
      try {
        setRepError(null)
        setRepLoading(true)
        if (showPoints) {
          const rows = await fetchPointsLeaderboard({ managerId: managerId || undefined })
          const items = rows.map(r => ({ id: r.id, firstName: r.firstName, lastName: r.lastName, total: r.total, byStatus: {} as Record<string, number> }))
          setRanking(items)
        } else {
          const users = await fetchUsers()
          const reps = users.filter(u => u.role === 'SALES_REP' && (!managerId || u.managerId === managerId))
          const arrays = await Promise.all(reps.map(u => api.get<Meeting[]>('/api/meetings', { params: { userId: u.id } }).then(r => r.data).catch(() => [])))
          const items: Array<{ id: string; firstName: string; lastName: string; total: number; byStatus: Record<string, number> }> = reps.map((u, i) => {
            let list = arrays[i] || []
            if (startDate) {
              const from = new Date(startDate + 'T00:00:00')
              list = list.filter(m => new Date(m.scheduledAt) >= from)
            }
            if (endDate) {
              const to = new Date(endDate + 'T23:59:59.999')
              list = list.filter(m => new Date(m.scheduledAt) <= to)
            }
            if (statusFilter) {
              list = list.filter(m => (m.status || '').trim() === statusFilter)
            }
            const by: Record<string, number> = {}
            let total = 0
            for (const m of list) {
              total += 1
              const s = (m.status || '').trim()
              if (!s) continue
              by[s] = (by[s] || 0) + 1
            }
            return { id: u.id, firstName: u.firstName, lastName: u.lastName, total, byStatus: by }
          })
          setRanking(items)
        }
      } catch (e: any) {
        setRepError(e?.response?.data?.error || 'Nie udało się pobrać rankingu')
      } finally {
        setRepLoading(false)
      }
    })()
  }, [view, managerId, startDate, endDate, statusFilter, showPoints])

  const kpi = useMemo(() => {
    const now = Date.now()
    let past = 0, future = 0, success = 0, rescheduled = 0
    const uniqueClients = new Set<string>()
    for (const m of meetings) {
      const isPast = new Date(m.scheduledAt).getTime() <= now
      if (isPast) past++
      else future++
      // Sukces = Umowa
      if ((m.status || '').trim() === 'Umowa') success++
      if ((m.status || '').trim() === 'Przełożone') rescheduled++
      // @ts-ignore
      const cid = m.clientId as string | undefined
      if (cid) uniqueClients.add(cid)
    }
    const skutecznosc = past > 0 ? Math.round((success / past) * 100) : 0
    return { past, future, success, rescheduled, skutecznosc, leads: uniqueClients.size }
  }, [meetings])

  const series = useMemo(() => buildEfficiencySeries(meetings, range), [meetings, range])
  const countSeries = useMemo(() => buildCountSeries(meetings, range), [meetings, range])
  const comparison = useMemo(() => buildComparison(meetings, range), [meetings, range])

  async function generateReport() {
    try {
      setReportLoading(true)
      setReportError(null)
      const me = getUser()
      if (!me || me.role !== 'ADMIN') {
        setReportError('Tylko administrator może generować raporty')
        setReportLoading(false)
        return
      }
      const payload = {
        ...reportConfig,
        managerId: managerId || undefined
      }
      const res = await api.post('/api/reports/data', payload)
      const data = res.data

      // Convert to CSV
      const csvParts: string[] = []
      
      // Clients
      if (reportConfig.includeClients && data.clients?.length > 0) {
        csvParts.push('=== KLIENCI ===')
        const headers = ['Imię', 'Nazwisko', 'Telefon', 'Email', 'Ulica', 'Miasto', 'Kod pocztowy', 'Kategoria', 'PV zainstalowane', 'Moc PV (kW)', 'Zakres rachunku', 'Nowe zasady', 'Typ budynku', 'Uwagi', 'Przypisani handlowcy', 'Data dodania']
        csvParts.push(headers.join(';'))
        data.clients.forEach((c: any) => {
          const row = [c.firstName, c.lastName, c.phone, c.email, c.street, c.city, c.postalCode, c.category, c.pvInstalled, c.pvPower, c.billRange, c.newRules, c.buildingType, c.extraComments, c.assignedSalesReps, formatDateOnly(c.createdAt)]
          csvParts.push(row.map(escapeCell).join(';'))
        })
        csvParts.push('')
      }

      // Meetings
      if (reportConfig.includeMeetings && data.meetings?.length > 0) {
        csvParts.push('=== SPOTKANIA ===')
        const headers = ['Data i godzina', 'Status', 'Handlowiec', 'Manager', 'Klient', 'Telefon klienta', 'Lokalizacja', 'Adres spotkania', 'Miasto', 'Kod pocztowy', 'PV zainstalowane', 'Zakres rachunku', 'Notatki', 'Uwagi']
        csvParts.push(headers.join(';'))
        data.meetings.forEach((m: any) => {
          const row = [formatDate(m.scheduledAt), m.status, m.salesRep, m.manager, m.clientName, m.clientPhone, m.location, m.salesLocationAddress, m.salesLocationCity, m.salesLocationPostalCode, m.pvInstalled, m.billRange, m.notes, m.extraComments]
          csvParts.push(row.map(escapeCell).join(';'))
        })
        csvParts.push('')
      }

      // Offers
      if (reportConfig.includeOffers && data.offers?.length > 0) {
        csvParts.push('=== OFERTY ===')
        const headers = ['Nazwa pliku', 'Handlowiec', 'Manager', 'Klient', 'Telefon klienta', 'Email klienta', 'Data spotkania', 'Status spotkania', 'Data utworzenia']
        csvParts.push(headers.join(';'))
        data.offers.forEach((o: any) => {
          const row = [o.fileName, o.salesRep, o.manager, o.clientName, o.clientPhone, o.clientEmail, formatDate(o.meetingDate), o.meetingStatus, formatDateOnly(o.createdAt)]
          csvParts.push(row.map(escapeCell).join(';'))
        })
        csvParts.push('')
      }

      // Attachments
      if (reportConfig.includeAttachments && data.attachments?.length > 0) {
        csvParts.push('=== ZAŁĄCZNIKI ===')
        const headers = ['Nazwa pliku', 'Kategoria', 'Handlowiec', 'Manager', 'Klient', 'Telefon klienta', 'Data spotkania', 'Status spotkania', 'Data dodania']
        csvParts.push(headers.join(';'))
        data.attachments.forEach((a: any) => {
          const row = [a.fileName, a.category, a.salesRep, a.manager, a.clientName, a.clientPhone, formatDate(a.meetingDate), a.meetingStatus, formatDateOnly(a.createdAt)]
          csvParts.push(row.map(escapeCell).join(';'))
        })
        csvParts.push('')
      }

      // Users
      if (reportConfig.includeUsers && data.users?.length > 0) {
        csvParts.push('=== UŻYTKOWNICY ===')
        const headers = ['Imię', 'Nazwisko', 'Email', 'Telefon', 'Miasto', 'Rola', 'Manager', 'Liczba spotkań', 'Liczba ofert', 'Liczba załączników', 'Data dodania']
        csvParts.push(headers.join(';'))
        data.users.forEach((u: any) => {
          const row = [u.firstName, u.lastName, u.email, u.phone, u.city, u.role, u.manager, u.meetingsCount, u.offersCount, u.attachmentsCount, formatDateOnly(u.createdAt)]
          csvParts.push(row.map(escapeCell).join(';'))
        })
        csvParts.push('')
      }

      // Points
      if (reportConfig.includePoints && data.points?.length > 0) {
        csvParts.push('=== PUNKTY ===')
        const headers = ['Punkty', 'Powód', 'Handlowiec', 'Manager', 'Data']
        csvParts.push(headers.join(';'))
        data.points.forEach((p: any) => {
          const row = [p.points, p.reason, p.salesRep, p.manager, formatDate(p.createdAt)]
          csvParts.push(row.map(escapeCell).join(';'))
        })
        csvParts.push('')
      }

      const csv = '\ufeff' + csvParts.join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const a = document.createElement('a')
      const url = URL.createObjectURL(blob)
      a.href = url
      const datePart = (reportConfig.startDate || reportConfig.endDate) ? `${reportConfig.startDate || 'poczatek'}_${reportConfig.endDate || 'koniec'}` : 'wszystko'
      a.download = `raport_${datePart}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setReportOpen(false)
    } catch (e: any) {
      setReportError(e?.response?.data?.error || 'Nie udało się wygenerować raportu')
    } finally {
      setReportLoading(false)
    }
  }

  function escapeCell(v: any): string {
    return '"' + String(v || '').replace(/"/g, '""') + '"'
  }

  function formatDate(isoString: string): string {
    if (!isoString) return ''
    try {
      const d = new Date(isoString)
      const date = d.toLocaleDateString('pl-PL')
      const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
      return `${date} ${time}`
    } catch {
      return isoString
    }
  }

  function formatDateOnly(isoString: string): string {
    if (!isoString) return ''
    try {
      return new Date(isoString).toLocaleDateString('pl-PL')
    } catch {
      return isoString
    }
  }

  if (loading) return <div className="container"><section className="card"><div>Ładowanie…</div></section></div>
  if (error) return <div className="container"><section className="card"><div className="text-error">{error}</div></section></div>

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Statystyki i Analityka</h1>
          <p className="text-gray-600">Przegląd kluczowych wskaźników i trendów</p>
        </div>
        {/* Admin manager filter */}
        {getUser()?.role === 'ADMIN' && (
          <div className="flex items-center" style={{ gap: '12px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Manager</label>
              <select className="form-select" value={managerId} onChange={e => setManagerId(e.target.value)}>
                <option value="">Wszyscy</option>
                {managers.map(m => (
                  <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Widok</label>
              <select className="form-select" value={view} onChange={e => setView(e.target.value as any)}>
                <option value="stats">Statystyki</option>
                <option value="ranking">Ranking handlowców</option>
              </select>
            </div>
            <button className="primary" type="button" onClick={() => setReportOpen(true)} style={{ marginTop: '24px' }}>
              Raport
            </button>
          </div>
        )}
      </div>

      {view === 'stats' && (
      <>
      {/* KPI row */}
      <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stats-grid">
          <div className="stat-card"><span className="stat-value">{kpi.past}</span><span className="stat-label">Odbyte</span></div>
          <div className="stat-card"><span className="stat-value">{kpi.future}</span><span className="stat-label">Umówione</span></div>
          <div className="stat-card"><span className="stat-value text-success">{kpi.success}</span><span className="stat-label">Umowy</span></div>
          <div className="stat-card"><span className="stat-value text-warning">{kpi.rescheduled}</span><span className="stat-label">Przełożone</span></div>
          <div className="stat-card"><span className="stat-value">{kpi.leads}</span><span className="stat-label">Leady</span></div>
          <div className="stat-card"><span className="stat-value">{kpi.skutecznosc}%</span><span className="stat-label">Skuteczność</span></div>
        </div>
      </section>

      {/* Charts */}
      <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Skuteczność w czasie</h3>
          <div className="flex items-center" style={{ gap: '8px' }}>
            <RangeButton current={range} value="week" onSelect={setRange}>Tydzień</RangeButton>
            <RangeButton current={range} value="month" onSelect={setRange}>Miesiąc</RangeButton>
            <RangeButton current={range} value="quarter" onSelect={setRange}>Kwartał</RangeButton>
            <RangeButton current={range} value="year" onSelect={setRange}>Rok</RangeButton>
          </div>
        </div>
        <ChartLine labels={series.labels} values={series.values} suffix="%" />
      </section>

      {/* More analytics (examples) */}
      <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h3 className="card-title">Struktura statusów</h3>
        <StatusBreakdown meetings={meetings} />
      </section>

      {/* Counts over time */}
      <section className="card">
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Liczba spotkań w czasie</h3>
          <div className="flex items-center" style={{ gap: '10px', fontSize: '0.85rem', color: 'var(--gray-700)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Obecny okres:</span>
              <strong>{comparison.current.count}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Poprzedni:</span>
              <strong>{comparison.prev.count}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Zmiana:</span>
              <strong className={comparison.delta.count > 0 ? 'text-success' : (comparison.delta.count < 0 ? 'text-error' : '')}>
                {comparison.delta.count > 0 ? '▲' : (comparison.delta.count < 0 ? '▼' : '–')} {Math.abs(comparison.delta.count)}
              </strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Skuteczność:</span>
              <strong>{comparison.current.eff}%</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>vs:</span>
              <strong>{comparison.prev.eff}%</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Δ</span>
              <strong className={comparison.delta.eff > 0 ? 'text-success' : (comparison.delta.eff < 0 ? 'text-error' : '')}>
                {comparison.delta.eff > 0 ? '▲' : (comparison.delta.eff < 0 ? '▼' : '–')} {Math.abs(comparison.delta.eff)}%
              </strong>
            </div>
          </div>
        </div>
        <ChartBars labels={countSeries.labels} values={countSeries.values} />
      </section>
      </>
      )}

      {view === 'ranking' && getUser()?.role === 'ADMIN' && (
        <section className="card">
          <div className="flex items-center justify-between" style={isMobile ? { display: 'grid', gap: 8, alignItems: 'start', marginBottom: 'var(--space-4)' } : { marginBottom: 'var(--space-4)' }}>
            <h3 className="card-title" style={{ margin: 0 }}>Ranking handlowców</h3>
            <div className="flex items-center" style={isMobile ? { display: 'grid', gap: 8, gridTemplateColumns: '1fr', width: '100%' } : { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ margin: 0, ...(isMobile ? { width: '100%' } : {}) }}>
                <label className="form-label">Metryka</label>
                <select className="form-select" value={metric} onChange={e => setMetric(e.target.value as any)} style={isMobile ? { width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0 } : undefined}>
                  <option value="Spotkania">Ilość spotkań</option>
                  <option value="Umowa">Umowa</option>
                  <option value="Przełożone">Przełożone</option>
                  <option value="Umówione">Umówione</option>
                  <option value="Odbyte">Odbyte</option>
                  <option value="Rezygnacja">Rezygnacja</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0, ...(isMobile ? { width: '100%' } : {}) }}>
                <label className="form-label">Punkty</label>
                <select className="form-select" value={showPoints ? 'on' : 'off'} onChange={e => setShowPoints(e.target.value === 'on')} style={isMobile ? { width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0 } : undefined}>
                  <option value="off">Wyłączone</option>
                  <option value="on">Pokaż ranking punktów</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0, ...(isMobile ? { width: '100%' } : {}) }}>
                <label className="form-label">Status</label>
                <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={isMobile ? { width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0 } : undefined}>
                  <option value="">Wszystkie</option>
                  <option value="Umowa">Umowa</option>
                  <option value="Przełożone">Przełożone</option>
                  <option value="Umówione">Umówione</option>
                  <option value="Odbyte">Odbyte</option>
                  <option value="Rezygnacja">Rezygnacja</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0, ...(isMobile ? { width: '100%' } : {}) }}>
                <label className="form-label">Od</label>
                <input className="form-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={isMobile ? { width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0 } : undefined} />
              </div>
              <div className="form-group" style={{ margin: 0, ...(isMobile ? { width: '100%' } : {}) }}>
                <label className="form-label">Do</label>
                <input className="form-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={isMobile ? { width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0 } : undefined} />
              </div>
              <div style={isMobile ? { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, width: '100%' } : { display: 'flex', gap: 8 }}>
                <button className="secondary" type="button" onClick={() => { setStartDate(''); setEndDate(''); setStatusFilter('') }} style={isMobile ? { width: '100%', maxWidth: '100%' } : undefined}>Wyczyść</button>
                <button className="primary" type="button" onClick={() => exportRankingCsv(ranking, metric, statusFilter, startDate, endDate)} style={isMobile ? { width: '100%', maxWidth: '100%' } : undefined}>Eksport CSV</button>
              </div>
            </div>
          </div>
          {repLoading ? (
            <div>Ładowanie…</div>
          ) : repError ? (
            <div className="text-error">{repError}</div>
          ) : (
            isMobile ? (
              <div style={{ display: 'grid', gap: 8 }}>
                {ranking
                  .slice()
                  .sort((a, b) => {
                    const av = metric === 'Spotkania' ? a.total : (a.byStatus[metric] || 0)
                    const bv = metric === 'Spotkania' ? b.total : (b.byStatus[metric] || 0)
                    return bv - av
                  })
                  .map((r) => (
                    <div key={r.id} className="list-item" style={{ alignItems: 'stretch' }}>
                      <div className="font-medium">{r.firstName} {r.lastName}</div>
                      <div className="list" style={{ marginTop: 6 }}>
                        <div className="list-row"><span>Spotkania</span><span>{r.total}</span></div>
                        <div className="list-row"><span>Umowa</span><span>{r.byStatus['Umowa'] || 0}</span></div>
                        {showPoints && (
                          <div className="list-row"><span>Punkty</span><span>{(r as any).total || 0}</span></div>
                        )}
                        <div className="list-row"><span>Przełożone</span><span>{r.byStatus['Przełożone'] || 0}</span></div>
                        <div className="list-row"><span>Umówione</span><span>{r.byStatus['Umówione'] || 0}</span></div>
                        <div className="list-row"><span>Odbyte</span><span>{r.byStatus['Odbyte'] || 0}</span></div>
                        <div className="list-row"><span>Rezygnacja</span><span>{r.byStatus['Rezygnacja'] || 0}</span></div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="table" style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Handlowiec</th>
                      <th>Spotkania</th>
                      <th>Umowa</th>
                      <th>Punkty</th>
                      <th>Przełożone</th>
                      <th>Umówione</th>
                      <th>Odbyte</th>
                      <th>Rezygnacja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking
                      .slice()
                      .sort((a, b) => {
                        const av = metric === 'Spotkania' ? a.total : (a.byStatus[metric] || 0)
                        const bv = metric === 'Spotkania' ? b.total : (b.byStatus[metric] || 0)
                        return bv - av
                      })
                      .map((r) => (
                        <tr key={r.id}>
                          <td>{r.firstName} {r.lastName}</td>
                          <td>{r.total}</td>
                          <td>{r.byStatus['Umowa'] || 0}</td>
                          <td>{/* points */}{(() => { try { return (r as any).total } catch { return 0 } })()}</td>
                          <td>{r.byStatus['Przełożone'] || 0}</td>
                          <td>{r.byStatus['Umówione'] || 0}</td>
                          <td>{r.byStatus['Odbyte'] || 0}</td>
                          <td>{r.byStatus['Rezygnacja'] || 0}</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>
      )}

      {/* Report modal */}
      {reportOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 className="modal-title">Generuj raport do CSV</h3>
              <button className="secondary" onClick={() => setReportOpen(false)} style={{ padding: 'var(--space-2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8, fontSize: '0.95rem', fontWeight: 600 }}>Wybierz dane do eksportu</h4>
                <div style={{ display: 'grid', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={reportConfig.includeClients} 
                      onChange={e => setReportConfig({ ...reportConfig, includeClients: e.target.checked })}
                    />
                    <span>Klienci (z przypisanymi handlowcami)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={reportConfig.includeMeetings} 
                      onChange={e => setReportConfig({ ...reportConfig, includeMeetings: e.target.checked })}
                    />
                    <span>Spotkania (z klientem i handlowcem)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={reportConfig.includeOffers} 
                      onChange={e => setReportConfig({ ...reportConfig, includeOffers: e.target.checked })}
                    />
                    <span>Oferty</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={reportConfig.includeAttachments} 
                      onChange={e => setReportConfig({ ...reportConfig, includeAttachments: e.target.checked })}
                    />
                    <span>Załączniki</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={reportConfig.includeUsers} 
                      onChange={e => setReportConfig({ ...reportConfig, includeUsers: e.target.checked })}
                    />
                    <span>Użytkownicy (handlowcy i managerowie)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={reportConfig.includePoints} 
                      onChange={e => setReportConfig({ ...reportConfig, includePoints: e.target.checked })}
                    />
                    <span>Punkty</span>
                  </label>
                </div>
              </div>
              <div className="form-grid-2" style={{ marginTop: 16 }}>
                <div className="form-group">
                  <label className="form-label">Data od</label>
                  <input 
                    className="form-input" 
                    type="date" 
                    value={reportConfig.startDate} 
                    onChange={e => setReportConfig({ ...reportConfig, startDate: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Data do</label>
                  <input 
                    className="form-input" 
                    type="date" 
                    value={reportConfig.endDate} 
                    onChange={e => setReportConfig({ ...reportConfig, endDate: e.target.value })}
                  />
                </div>
              </div>
              {reportError && (
                <div className="text-error text-sm mt-4 p-3 bg-error-50 rounded border border-error-200">
                  {reportError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="secondary" onClick={() => setReportOpen(false)} disabled={reportLoading}>
                Anuluj
              </button>
              <button className="primary" onClick={generateReport} disabled={reportLoading}>
                {reportLoading ? 'Generowanie…' : 'Pobierz CSV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function exportRankingCsv(rows: Array<{ id: string; firstName: string; lastName: string; total: number; byStatus: Record<string, number> }>, metric: string, statusFilter: string, startDate: string, endDate: string) {
  if (!rows || rows.length === 0) {
    alert('Brak danych do eksportu')
    return
  }
  const headers = ['Handlowiec','Spotkania','Umowa','Punkty','Przełożone','Umówione','Odbyte','Rezygnacja']
  const data = rows
    .slice()
    .sort((a, b) => {
      const av = metric === 'Spotkania' ? a.total : (a.byStatus[metric] || 0)
      const bv = metric === 'Spotkania' ? b.total : (b.byStatus[metric] || 0)
      return bv - av
    })
    .map(r => [
      `${r.firstName} ${r.lastName}`.trim(),
      r.total,
      r.byStatus['Umowa'] || 0,
      (r as any).total || 0,
      r.byStatus['Przełożone'] || 0,
      r.byStatus['Umówione'] || 0,
      r.byStatus['Odbyte'] || 0,
      r.byStatus['Rezygnacja'] || 0,
    ])
  const sep = ';'
  const escapeCell = (v: string | number) => '"' + String(v).replace(/"/g, '""') + '"'
  const lines = [headers.map(escapeCell).join(sep), ...data.map(r => r.map(escapeCell).join(sep))]
  const csv = '\ufeff' + lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  const url = URL.createObjectURL(blob)
  a.href = url
  const datePart = (startDate || endDate) ? `${startDate || 'poczatek'}_${endDate || 'koniec'}` : 'wszystko'
  const statusPart = statusFilter || 'all'
  a.download = `ranking_${metric}_${statusPart}_${datePart}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function RangeButton({ current, value, onSelect, children }: { current: Range; value: Range; onSelect: (r: Range) => void; children: React.ReactNode }) {
  const isActive = current === value
  return (
    <button type="button" className={isActive ? 'primary btn-sm' : 'secondary btn-sm'} onClick={() => onSelect(value)}>
      {children}
    </button>
  )
}

function ChartLine({ labels, values, suffix }: { labels: string[]; values: number[]; suffix?: string }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  // moving average (3)
  const ma = useMemo(() => values.map((_, i) => {
    const start = Math.max(0, i - 2)
    const slice = values.slice(start, i + 1)
    const avg = slice.reduce((a, b) => a + b, 0) / (slice.length || 1)
    return Math.round(avg)
  }), [values])

  const max = Math.max(100, ...values, ...ma)
  const n = Math.max(1, values.length - 1)
  const toPoint = (v: number, i: number) => {
    const x = (i / n) * 100
    const y = 100 - (v / max) * 100
    return `${x},${y}`
  }
  const pts = values.map((v, i) => toPoint(v, i)).join(' ')
  const ptsMa = ma.map((v, i) => toPoint(v, i)).join(' ')

  const handleMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.min(1, Math.max(0, x / rect.width))
    const idx = Math.round(ratio * n)
    setHoverIdx(idx)
  }
  const handleLeave = () => setHoverIdx(null)

  const hoverXPct = hoverIdx == null ? null : (hoverIdx / n) * 100
  const _hoverYPct = hoverIdx == null ? null : 100 - ((values[hoverIdx] || 0) / max) * 100
  void _hoverYPct

  // compute axis ticks aligned to points
  const tickCount = Math.min(8, Math.max(2, labels.length))
  const tickIdxs = Array.from({ length: tickCount }, (_, i) => Math.round((i * n) / (tickCount - 1)))

  return (
    <div className="chart" style={{ position: 'relative' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg" onMouseMove={handleMove} onMouseLeave={handleLeave}>
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(37,99,235,0.6)"/>
            <stop offset="100%" stopColor="rgba(37,99,235,0.05)"/>
          </linearGradient>
        </defs>
        {/* grid */}
        <g className="chart-grid">
          {[0,25,50,75,100].map(p => (
            <line key={p} x1="0" y1={p} x2="100" y2={p} stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
          ))}
        </g>
        {/* area + main line */}
        <polygon fill="url(#grad)" points={`0,100 ${pts} 100,100`} />
        <polyline fill="none" stroke="var(--primary-600)" strokeWidth="1.5" points={pts} />
        {/* MA(3) line */}
        <polyline fill="none" stroke="var(--accent-600)" strokeWidth="1.2" strokeDasharray="3,3" points={ptsMa} />
        {/* points */}
        {values.map((v, i) => (
          <circle key={`pt-${i}`} cx={(i / n) * 100} cy={100 - (v / max) * 100} r={hoverIdx === i ? 1.8 : 0.8} fill={hoverIdx === i ? 'var(--primary-600)' : 'var(--primary-400)'} />
        ))}
        {/* crosshair */}
        {hoverXPct != null && (
          <line x1={hoverXPct} y1={0} x2={hoverXPct} y2={100} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
        )}
      </svg>
      {/* tooltip */}
      {hoverIdx != null && (
        <div style={{ position: 'absolute', left: `calc(${hoverXPct}% - 60px)`, top: 8, background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(226,232,240,0.8)', borderRadius: 12, padding: '6px 10px', boxShadow: 'var(--shadow-glass-sm)', fontSize: '0.75rem', color: 'var(--gray-700)', pointerEvents: 'none', minWidth: 120 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{labels[hoverIdx]}</div>
          <div>Skuteczność: <strong>{values[hoverIdx]}{suffix}</strong></div>
          <div>MA(3): <strong>{ma[hoverIdx]}{suffix}</strong></div>
        </div>
      )}
      {/* x-axis labels aligned to points */}
      <div className="chart-axis">
        {tickIdxs.map((idx) => (
          <span key={`x-${idx}`} style={{ left: `${(idx / n) * 100}%` }}>{labels[idx]}</span>
        ))}
      </div>
    </div>
  )
}

function StatusBreakdown({ meetings }: { meetings: Meeting[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { Umowa: 0, Spadek: 0, 'Przełożone': 0, Umówione: 0, Odbyte: 0, Brak: 0 }
    for (const m of meetings) {
      const s = m.status && m.status.trim() ? m.status : 'Brak'
      c[s] = (c[s] || 0) + 1
    }
    return c
  }, [meetings])

  const items = Object.entries(counts)
  const total = items.reduce((a, [,v]) => a + v, 0) || 1
  return (
    <div className="list" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
      {items.map(([k,v]) => (
        <div key={k} className="list-item" style={{ alignItems: 'stretch' }}>
          <div style={{ fontWeight: 600 }}>{k}</div>
          <div style={{ width: '60%', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--gray-200)', overflow: 'hidden' }}>
              <div style={{ width: `${Math.round((v/total)*100)}%`, height: '100%', background: 'var(--primary-600)' }} />
            </div>
            <span className="text-sm" style={{ minWidth: 28, textAlign: 'right' }}>{v}</span>
          </div>
        </div>
      ))}
    </div>
  )
}


function buildEfficiencySeries(meetings: Meeting[], range: Range): { labels: string[]; values: number[] } {
  const now = new Date()
  const { buckets, granularity } = getRangeBuckets(range, now)
  const counts = new Map<string, { past: number; success: number }>()
  for (const b of buckets) counts.set(b.key, { past: 0, success: 0 })

  const bucketKeyFor = (d: Date): string => (
    granularity === 'day' ? startOfDay(d).toISOString() : granularity === 'week' ? startOfWeek(d).toISOString() : startOfMonth(d).toISOString()
  )

  const nowTs = +now
  for (const m of meetings) {
    const md = new Date(m.scheduledAt)
    if (+md > nowTs) continue // tylko przeszłe do skuteczności
    const key = bucketKeyFor(md)
    if (!counts.has(key)) continue
    const c = counts.get(key)!
    c.past += 1
    if (m.status === 'Sukces') c.success += 1
  }

  const labels = buckets.map(b => b.label)
  const values = buckets.map(b => {
    const c = counts.get(b.key)!
    return c.past > 0 ? Math.round((c.success / c.past) * 100) : 0
  })
  return { labels, values }
}

// date helpers
function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x }
function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  const day = x.getDay() || 7 // Monday=1..Sunday=7
  if (day !== 1) x.setDate(x.getDate() - (day - 1))
  return x
}
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function addMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth() + n, 1) }
function formatDay(d: Date): string { return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}` }
function formatMonth(d: Date): string { return `${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getFullYear()).slice(-2)}` }

function startOfYear(d: Date): Date { return new Date(d.getFullYear(), 0, 1) }
function startOfQuarter(d: Date): Date { const q = Math.floor(d.getMonth() / 3) * 3; return new Date(d.getFullYear(), q, 1) }

function getRangeBuckets(range: Range, now: Date): { buckets: { key: string; label: string; start: Date }[]; granularity: 'day' | 'week' | 'month' } {
  const buckets: { key: string; label: string; start: Date }[] = []
  if (range === 'week') {
    const start = startOfWeek(now)
    for (let i = 0; i < 7; i++) {
      const d = startOfDay(addDays(start, i))
      buckets.push({ key: d.toISOString(), label: formatDay(d), start: d })
    }
    return { buckets, granularity: 'day' }
  }
  if (range === 'month') {
    const start = startOfMonth(now)
    const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
    for (let i = 0; i < days; i++) {
      const d = startOfDay(addDays(start, i))
      buckets.push({ key: d.toISOString(), label: formatDay(d), start: d })
    }
    return { buckets, granularity: 'day' }
  }
  if (range === 'quarter') {
    const start = startOfQuarter(now)
    const end = addMonths(start, 3)
    let cur = startOfWeek(start)
    while (+cur < +end) {
      buckets.push({ key: cur.toISOString(), label: formatDay(cur), start: cur })
      cur = addDays(cur, 7)
    }
    return { buckets, granularity: 'week' }
  }
  // year
  const start = startOfYear(now)
  for (let i = 0; i < 12; i++) {
    const d = startOfMonth(addMonths(start, i))
    buckets.push({ key: d.toISOString(), label: formatMonth(d), start: d })
  }
  return { buckets, granularity: 'month' }
}


function buildCountSeries(meetings: Meeting[], range: Range): { labels: string[]; values: number[] } {
  const now = new Date()
  const { buckets, granularity } = getRangeBuckets(range, now)
  const counts = new Map<string, number>()
  for (const b of buckets) counts.set(b.key, 0)
  const keyFor = (d: Date): string => (
    granularity === 'day' ? startOfDay(d).toISOString() : granularity === 'week' ? startOfWeek(d).toISOString() : startOfMonth(d).toISOString()
  )
  for (const m of meetings) {
    const k = keyFor(new Date(m.scheduledAt))
    if (counts.has(k)) counts.set(k, (counts.get(k) || 0) + 1)
  }
  const labels = buckets.map(b => b.label)
  const values = buckets.map(b => counts.get(b.key) || 0)
  return { labels, values }
}

function buildComparison(meetings: Meeting[], range: Range) {
  const now = new Date()
  let start: Date, end: Date
  if (range === 'week') {
    start = startOfWeek(now); end = addDays(start, 7)
  } else if (range === 'month') {
    start = startOfMonth(now); end = addMonths(start, 1)
  } else if (range === 'quarter') {
    start = startOfQuarter(now); end = addMonths(start, 3)
  } else {
    start = startOfYear(now); end = addMonths(start, 12)
  }
  const spanMs = +end - +start
  const prevStart = new Date(+start - spanMs)
  const prevEnd = new Date(+start)

  const inRange = (d: Date, a: Date, b: Date) => +d >= +a && +d < +b

  const aggregate = (a: Date, b: Date) => {
    let count = 0, past = 0, success = 0
    for (const m of meetings) {
      const md = new Date(m.scheduledAt)
      if (!inRange(md, a, b)) continue
      count++
      if (+md <= +now) {
        past++
        if (m.status === 'Sukces') success++
      }
    }
    const eff = past > 0 ? Math.round((success / past) * 100) : 0
    return { count, eff }
  }

  const current = aggregate(start, end)
  const prev = aggregate(prevStart, prevEnd)
  return { current, prev, delta: { count: current.count - prev.count, eff: current.eff - prev.eff } }
}

function ChartBars({ labels, values }: { labels: string[]; values: number[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const max = Math.max(1, ...values)
  const n = values.length
  const barW = 100 / Math.max(1, n)
  const gap = Math.min(1.5, barW * 0.15)
  const inner = Math.max(0, barW - gap)
  const handleMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const ratio = Math.min(0.999, Math.max(0, x / rect.width))
    const idx = Math.floor(ratio * n)
    setHoverIdx(idx)
  }
  const handleLeave = () => setHoverIdx(null)
  const tickCount = Math.min(8, Math.max(2, labels.length))
  const tickIdxs = Array.from({ length: tickCount }, (_, i) => Math.round((i * (n - 1)) / (tickCount - 1)))

  return (
    <div className="chart" style={{ position: 'relative' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg" onMouseMove={handleMove} onMouseLeave={handleLeave}>
        <g className="chart-grid">
          {[0,25,50,75,100].map(p => (
            <line key={p} x1="0" y1={p} x2="100" y2={p} stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
          ))}
        </g>
        {values.map((v, i) => {
          const x = i * barW + gap/2
          const h = (v / max) * 100
          const y = 100 - h
          const active = hoverIdx === i
          return (
            <rect key={`b-${i}`} x={x} y={y} width={inner} height={h} fill={active ? 'var(--primary-600)' : 'var(--primary-400)'} rx="0.5" />
          )
        })}
      </svg>
      {hoverIdx != null && (
        <div style={{ position: 'absolute', left: `calc(${hoverIdx * barW + barW/2}% - 50px)`, top: 8, background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(226,232,240,0.8)', borderRadius: 12, padding: '6px 10px', boxShadow: 'var(--shadow-glass-sm)', fontSize: '0.75rem', color: 'var(--gray-700)', pointerEvents: 'none', minWidth: 100 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>{labels[hoverIdx]}</div>
          <div>Spotkań: <strong>{values[hoverIdx]}</strong></div>
        </div>
      )}
      <div className="chart-axis">
        {tickIdxs.map((idx) => (
          <span key={`bx-${idx}`} style={{ left: `${(idx / Math.max(1, n - 1)) * 100}%` }}>{labels[idx]}</span>
        ))}
      </div>
    </div>
  )
}


