import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import { getUser } from '../lib/auth'

type Meeting = { id: string; scheduledAt: string; status?: string | null }
type Range = 'week' | 'month' | 'quarter' | 'year'

export default function StatsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('month')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const me = getUser()
        // Dla MANAGER – agreguj spotkania zespołu jak na stronie głównej
        if (me?.role === 'MANAGER') {
          const usersRes = await api.get<Array<{ id: string; role: string; managerId?: string | null }>>('/api/users')
          const team = usersRes.data.filter(u => u.role === 'SALES_REP' && u.managerId === me.id)
          if (team.length > 0) {
            const arrays = await Promise.all(team.map(u => api.get<Meeting[]>('/api/meetings', { params: { userId: u.id } }).then(r => r.data).catch(() => [])))
            const data = ([] as Meeting[]).concat(...arrays)
            setMeetings(data)
          } else {
            setMeetings([])
          }
        } else {
          // Pozostałe role – własne spotkania
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
  }, [])

  const kpi = useMemo(() => {
    const now = Date.now()
    let past = 0, future = 0, success = 0, rescheduled = 0
    const uniqueClients = new Set<string>()
    for (const m of meetings) {
      const isPast = new Date(m.scheduledAt).getTime() <= now
      if (isPast) past++
      else future++
      if (m.status === 'Sukces') success++
      if (m.status === 'Dogrywka') rescheduled++
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

  if (loading) return <div className="container"><section className="card"><div>Ładowanie…</div></section></div>
  if (error) return <div className="container"><section className="card"><div className="text-error">{error}</div></section></div>

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Statystyki i Analityka</h1>
          <p className="text-gray-600">Przegląd kluczowych wskaźników i trendów</p>
        </div>
      </div>

      {/* KPI row */}
      <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stats-grid">
          <div className="stat-card"><span className="stat-value">{kpi.past}</span><span className="stat-label">Odbyte</span></div>
          <div className="stat-card"><span className="stat-value">{kpi.future}</span><span className="stat-label">Umówione</span></div>
          <div className="stat-card"><span className="stat-value text-success">{kpi.success}</span><span className="stat-label">Sukcesy</span></div>
          <div className="stat-card"><span className="stat-value text-warning">{kpi.rescheduled}</span><span className="stat-label">Dogrywki</span></div>
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
    </div>
  )
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
    const c: Record<string, number> = { Sukces: 0, Porażka: 0, Dogrywka: 0, Brak: 0 }
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


