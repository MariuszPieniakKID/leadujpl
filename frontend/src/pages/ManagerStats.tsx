import { useEffect, useMemo, useState } from 'react'
import api, { fetchPointsLeaderboard } from '../lib/api'
import { getUser } from '../lib/auth'

type Meeting = { id: string; scheduledAt: string; status?: string | null; clientId?: string | null }
type Range = 'week' | 'month' | 'quarter' | 'year'

export default function ManagerStatsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('month')
  const [pointsMin, setPointsMin] = useState<number | ''>('')
  const [pointsRanking, setPointsRanking] = useState<Array<{ id: string; firstName: string; lastName: string; total: number }>>([])

  const loadData = async () => {
    setLoading(true)
    try {
      const me = getUser()
      const usersRes = await api.get<Array<{ id: string; role: string; managerId?: string | null }>>('/api/users')
      const team = usersRes.data.filter(u => u.role === 'SALES_REP' && u.managerId === me?.id)
      let data: Meeting[] = []
      if (team.length > 0) {
        const arrays = await Promise.all(team.map(u => api.get<Meeting[]>('/api/meetings', { params: { userId: u.id } }).then(r => r.data).catch(() => [])))
        data = ([] as Meeting[]).concat(...arrays)
      }
      setMeetings(data)
      setError(null)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Nie udało się pobrać danych zespołu')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const me = getUser()
        if (!me) return
        // leaderboard for my team
        const rows = await fetchPointsLeaderboard({ managerId: me.id })
        setPointsRanking(rows)
      } catch {}
    })()
  }, [])

  const kpi = useMemo(() => {
    const nowTs = Date.now()
    const past = meetings.filter(m => new Date(m.scheduledAt).getTime() <= nowTs)
    const future = meetings.filter(m => new Date(m.scheduledAt).getTime() > nowTs)
    const contracts = meetings.filter(m => m.status === 'Sukces')
    const rescheduled = meetings.filter(m => m.status === 'Dogrywka')
    const leads = new Set(meetings.map(m => m.clientId).filter(Boolean)).size
    const eff = past.length > 0 ? Math.round((contracts.length / past.length) * 100) : 0
    return { past: past.length, future: future.length, contracts: contracts.length, rescheduled: rescheduled.length, leads, eff }
  }, [meetings])

  const effSeries = useMemo(() => buildEfficiencySeries(meetings, range), [meetings, range])
  const countSeries = useMemo(() => buildCountSeries(meetings, range), [meetings, range])

  if (loading) return <div className="container"><section className="card"><div>Ładowanie…</div></section></div>
  if (error) return <div className="container"><section className="card"><div className="text-error">{error}</div></section></div>

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Statystyki zespołu</h1>
          <p className="text-gray-600">Zbiorcze dane handlowców przypisanych do Ciebie</p>
        </div>
        <button className="primary" onClick={loadData} disabled={loading}>
          {loading ? 'Odświeżanie...' : 'Odśwież'}
        </button>
      </div>

      <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="stats-grid">
          <div className="stat-card"><span className="stat-value">{kpi.past}</span><span className="stat-label">Odbyte</span></div>
          <div className="stat-card"><span className="stat-value">{kpi.future}</span><span className="stat-label">Umówione</span></div>
          <div className="stat-card"><span className="stat-value text-success">{kpi.contracts}</span><span className="stat-label">Umowy</span></div>
          <div className="stat-card"><span className="stat-value text-warning">{kpi.rescheduled}</span><span className="stat-label">Dogrywki</span></div>
          <div className="stat-card"><span className="stat-value">{kpi.leads}</span><span className="stat-label">Leady</span></div>
          <div className="stat-card"><span className="stat-value">{kpi.eff}%</span><span className="stat-label">Skuteczność</span></div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Punkty zespołu</h3>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Minimalna liczba punktów</label>
            <input className="form-input" type="number" value={pointsMin === '' ? '' : String(pointsMin)} onChange={e => setPointsMin(e.target.value === '' ? '' : Number(e.target.value))} placeholder="np. 50" />
          </div>
        </div>
        {pointsRanking.length === 0 ? (
          <div className="text-sm text-gray-500">Brak danych punktowych</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            {pointsRanking
              .filter(r => pointsMin === '' ? true : r.total >= Number(pointsMin))
              .sort((a,b) => b.total - a.total)
              .map(r => (
              <li key={r.id} className="list-item">
                <div>
                  <div className="font-medium">{r.firstName} {r.lastName}</div>
                  <div className="text-sm text-gray-500">Punkty: <strong>{r.total}</strong></div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-4)' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Skuteczność w czasie (zespół)</h3>
          <div className="flex items-center" style={{ gap: '8px' }}>
            <RangeButton current={range} value="week" onSelect={setRange}>Tydzień</RangeButton>
            <RangeButton current={range} value="month" onSelect={setRange}>Miesiąc</RangeButton>
            <RangeButton current={range} value="quarter" onSelect={setRange}>Kwartał</RangeButton>
            <RangeButton current={range} value="year" onSelect={setRange}>Rok</RangeButton>
          </div>
        </div>
        <ChartLine labels={effSeries.labels} values={effSeries.values} suffix="%" />
      </section>

      <section className="card">
        <h3 className="card-title">Liczba spotkań w czasie (zespół)</h3>
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

function ChartLine({ labels, values, suffix: _suffix }: { labels: string[]; values: number[]; suffix?: string }) {
  const max = Math.max(100, ...values)
  const n = Math.max(1, values.length - 1)
  const pts = values.map((v, i) => {
    const x = (i / n) * 100
    const y = 100 - (v / max) * 100
    return `${x},${y}`
  }).join(' ')
  const tickCount = Math.min(8, Math.max(2, labels.length))
  const tickIdxs = Array.from({ length: tickCount }, (_, i) => Math.round((i * n) / (tickCount - 1)))
  return (
    <div className="chart" style={{ position: 'relative' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg">
        <g className="chart-grid">
          {[0,25,50,75,100].map(p => (
            <line key={p} x1="0" y1={p} x2="100" y2={p} stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
          ))}
        </g>
        <polygon fill="rgba(37,99,235,0.08)" points={`0,100 ${pts} 100,100`} />
        <polyline fill="none" stroke="var(--primary-600)" strokeWidth="1.5" points={pts} />
      </svg>
      <div className="chart-axis">
        {tickIdxs.map((idx) => (
          <span key={`x-${idx}`} style={{ left: `${(idx / n) * 100}%` }}>{labels[idx]}</span>
        ))}
      </div>
    </div>
  )
}

function ChartBars({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(1, ...values)
  const n = values.length
  const barW = 100 / Math.max(1, n)
  const gap = Math.min(1.5, barW * 0.15)
  const inner = Math.max(0, barW - gap)
  const tickCount = Math.min(8, Math.max(2, labels.length))
  const tickIdxs = Array.from({ length: tickCount }, (_, i) => Math.round((i * (n - 1)) / (tickCount - 1)))
  return (
    <div className="chart" style={{ position: 'relative' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg">
        <g className="chart-grid">
          {[0,25,50,75,100].map(p => (
            <line key={p} x1="0" y1={p} x2="100" y2={p} stroke="rgba(0,0,0,0.05)" strokeWidth="0.5" />
          ))}
        </g>
        {values.map((v, i) => {
          const x = i * barW + gap/2
          const h = (v / max) * 100
          const y = 100 - h
          return (
            <rect key={`b-${i}`} x={x} y={y} width={inner} height={h} fill={'var(--primary-500)'} rx="0.5" />
          )
        })}
      </svg>
      <div className="chart-axis">
        {tickIdxs.map((idx) => (
          <span key={`bx-${idx}`} style={{ left: `${(idx / Math.max(1, n - 1)) * 100}%` }}>{labels[idx]}</span>
        ))}
      </div>
    </div>
  )
}

// helpers reused from Stats.tsx logic
function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x }
function startOfWeek(d: Date): Date { const x = startOfDay(d); const day = x.getDay() || 7; if (day !== 1) x.setDate(x.getDate() - (day - 1)); return x }
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
    for (let i = 0; i < 7; i++) { const d = startOfDay(addDays(start, i)); buckets.push({ key: d.toISOString(), label: formatDay(d), start: d }) }
    return { buckets, granularity: 'day' }
  }
  if (range === 'month') {
    const start = startOfMonth(now)
    const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
    for (let i = 0; i < days; i++) { const d = startOfDay(addDays(start, i)); buckets.push({ key: d.toISOString(), label: formatDay(d), start: d }) }
    return { buckets, granularity: 'day' }
  }
  if (range === 'quarter') {
    const start = startOfQuarter(now)
    const end = addMonths(start, 3)
    let cur = startOfWeek(start)
    while (+cur < +end) { buckets.push({ key: cur.toISOString(), label: formatDay(cur), start: cur }); cur = addDays(cur, 7) }
    return { buckets, granularity: 'week' }
  }
  const start = startOfYear(now)
  for (let i = 0; i < 12; i++) { const d = startOfMonth(addMonths(start, i)); buckets.push({ key: d.toISOString(), label: formatMonth(d), start: d }) }
  return { buckets, granularity: 'month' }
}

function buildEfficiencySeries(meetings: Meeting[], range: Range): { labels: string[]; values: number[] } {
  const now = new Date()
  const { buckets, granularity } = getRangeBuckets(range, now)
  const counts = new Map<string, { past: number; success: number }>()
  for (const b of buckets) counts.set(b.key, { past: 0, success: 0 })
  const keyFor = (d: Date): string => (granularity === 'day' ? startOfDay(d).toISOString() : granularity === 'week' ? startOfWeek(d).toISOString() : startOfMonth(d).toISOString())
  for (const m of meetings) {
    const md = new Date(m.scheduledAt)
    if (+md > +now) continue
    const k = keyFor(md)
    if (!counts.has(k)) continue
    const c = counts.get(k)!
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

function buildCountSeries(meetings: Meeting[], range: Range): { labels: string[]; values: number[] } {
  const now = new Date()
  const { buckets, granularity } = getRangeBuckets(range, now)
  const counts = new Map<string, number>()
  for (const b of buckets) counts.set(b.key, 0)
  const keyFor = (d: Date): string => (granularity === 'day' ? startOfDay(d).toISOString() : granularity === 'week' ? startOfWeek(d).toISOString() : startOfMonth(d).toISOString())
  for (const m of meetings) {
    const k = keyFor(new Date(m.scheduledAt))
    if (counts.has(k)) counts.set(k, (counts.get(k) || 0) + 1)
  }
  const labels = buckets.map(b => b.label)
  const values = buckets.map(b => counts.get(b.key) || 0)
  return { labels, values }
}


