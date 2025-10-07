import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

type ActivityLog = {
  id: string
  type: string
  userId: string
  userName: string
  clientId?: string | null
  clientName?: string | null
  meetingId?: string | null
  offerId?: string | null
  oldStatus?: string | null
  newStatus?: string | null
  metadata?: any
  createdAt: string
}

type FeedStats = {
  newMeetings: number
  success: number
  rezygnacja: number
  przelozone: number
}

export default function FeedPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [stats, setStats] = useState<FeedStats>({ newMeetings: 0, success: 0, rezygnacja: 0, przelozone: 0 })
  const [loading, setLoading] = useState(true)
  const [archivedDates, setArchivedDates] = useState<string[]>([])
  const [showArchive, setShowArchive] = useState(false)
  const [selectedArchiveDate, setSelectedArchiveDate] = useState<string>('')
  const [newActivityIds, setNewActivityIds] = useState<Set<string>>(new Set())

  async function loadFeed() {
    try {
      const [activitiesRes, statsRes] = await Promise.all([
        api.get('/api/feed/today'),
        api.get('/api/feed/stats/today'),
      ])
      
      // Track new activities for blink animation
      const oldIds = new Set(activities.map(a => a.id))
      const newIds = new Set<string>()
      activitiesRes.data.forEach((activity: ActivityLog) => {
        if (!oldIds.has(activity.id)) {
          newIds.add(activity.id)
        }
      })
      
      setActivities(activitiesRes.data)
      setStats(statsRes.data)
      setNewActivityIds(newIds)
      
      // Remove blink effect after animation
      setTimeout(() => {
        setNewActivityIds(new Set())
      }, 2000)
    } catch (error) {
      console.error('Failed to load feed:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadArchiveDates() {
    try {
      const res = await api.get('/api/feed/archive/dates')
      setArchivedDates(res.data)
    } catch (error) {
      console.error('Failed to load archive dates:', error)
    }
  }

  async function loadArchivedFeed(date: string) {
    try {
      setLoading(true)
      const res = await api.get('/api/feed/archive', { params: { date } })
      setActivities(res.data)
      setSelectedArchiveDate(date)
      setShowArchive(true)
    } catch (error) {
      console.error('Failed to load archived feed:', error)
    } finally {
      setLoading(false)
    }
  }

  function closeArchive() {
    setShowArchive(false)
    setSelectedArchiveDate('')
    loadFeed()
  }

  useEffect(() => {
    loadFeed()
    loadArchiveDates()
    
    // Poll for new activities every 5 seconds
    const interval = setInterval(loadFeed, 5000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Sukces':
      case 'Umowa':
        return '#10b981' // green
      case 'Rezygnacja':
        return '#ef4444' // red
      case 'Przełożone':
        return '#f59e0b' // orange
      case 'Umówione':
        return '#3b82f6' // blue
      case 'Odbyte':
        return '#8b5cf6' // purple
      default:
        return '#6b7280' // gray
    }
  }

  const formatActivityMessage = (activity: ActivityLog): React.ReactElement => {
    const meta = activity.metadata || {}
    
    switch (activity.type) {
      case 'meeting_created':
        return (
          <>
            Handlowiec <Link to={`/account`} className="feed-link">{activity.userName}</Link> dodał nowe spotkanie z klientem{' '}
            {activity.clientId ? (
              <Link to={`/klienci`} className="feed-link">{activity.clientName}</Link>
            ) : (
              <span className="feed-text-muted">{activity.clientName || '(brak)'}</span>
            )}{' '}
            na dzień {meta.meetingDate ? new Date(meta.meetingDate).toLocaleDateString('pl-PL') : '—'} o godzinie{' '}
            {meta.meetingTime || '—'}
          </>
        )
      
      case 'meeting_status_changed':
        return (
          <>
            Spotkanie dla handlowca <Link to={`/account`} className="feed-link">{activity.userName}</Link> zmieniło status z{' '}
            {activity.oldStatus && (
              <span className="status-badge" style={{ backgroundColor: getStatusColor(activity.oldStatus) }}>
                {activity.oldStatus}
              </span>
            )}{' '}
            na{' '}
            {activity.newStatus && (
              <span className="status-badge" style={{ backgroundColor: getStatusColor(activity.newStatus) }}>
                {activity.newStatus}
              </span>
            )}
          </>
        )
      
      case 'client_status_changed':
        return (
          <>
            Status klienta{' '}
            {activity.clientId ? (
              <Link to={`/klienci`} className="feed-link">{activity.clientName}</Link>
            ) : (
              <span>{activity.clientName}</span>
            )}{' '}
            dla handlowca <Link to={`/account`} className="feed-link">{activity.userName}</Link> zmienił się z{' '}
            {activity.oldStatus && (
              <span className="status-badge" style={{ backgroundColor: getStatusColor(activity.oldStatus) }}>
                {activity.oldStatus}
              </span>
            )}{' '}
            na{' '}
            {activity.newStatus && (
              <span className="status-badge" style={{ backgroundColor: getStatusColor(activity.newStatus) }}>
                {activity.newStatus}
              </span>
            )}
          </>
        )
      
      case 'offer_generated':
        return (
          <>
            Handlowiec <Link to={`/account`} className="feed-link">{activity.userName}</Link> wygenerował nową ofertę dla klienta{' '}
            {activity.clientId ? (
              <Link to={`/klienci`} className="feed-link">{activity.clientName}</Link>
            ) : (
              <span>{activity.clientName}</span>
            )}
          </>
        )
      
      default:
        return <>Nieznane zdarzenie</>
    }
  }

  const getActivityIcon = (type: string): string => {
    switch (type) {
      case 'meeting_created':
        return '📅'
      case 'meeting_status_changed':
        return '🔄'
      case 'client_status_changed':
        return '👤'
      case 'offer_generated':
        return '📄'
      default:
        return '•'
    }
  }

  const getStatusCircleColor = (activity: ActivityLog): string | null => {
    // Show status circle for status changes
    if (activity.type === 'meeting_status_changed' || activity.type === 'client_status_changed') {
      return activity.newStatus ? getStatusColor(activity.newStatus) : null
    }
    return null
  }

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Feed aktywności</h1>
          <p className="text-gray-600">
            {showArchive 
              ? `Archiwum z dnia ${new Date(selectedArchiveDate).toLocaleDateString('pl-PL')}`
              : 'Live stream aktywności użytkowników'}
          </p>
        </div>
        {!showArchive && archivedDates.length > 0 && (
          <div className="flex items-center gap-4">
            <select
              className="form-select"
              value={selectedArchiveDate}
              onChange={(e) => {
                if (e.target.value) {
                  loadArchivedFeed(e.target.value)
                }
              }}
              style={{ minWidth: 200 }}
            >
              <option value="">Wybierz archiwum</option>
              {archivedDates.map((date) => (
                <option key={date} value={date}>
                  {new Date(date).toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </option>
              ))}
            </select>
          </div>
        )}
        {showArchive && (
          <button className="secondary" onClick={closeArchive}>
            Powrót do dzisiejszego feeda
          </button>
        )}
      </div>

      {!showArchive && (
        <div className="feed-stats-grid">
          <div className="feed-stat-card">
            <div className="feed-stat-icon">📅</div>
            <div>
              <div className="feed-stat-value">{stats.newMeetings}</div>
              <div className="feed-stat-label">Dzisiejsze nowe spotkania</div>
            </div>
          </div>
          <div className="feed-stat-card">
            <div className="feed-stat-icon" style={{ color: getStatusColor('Sukces') }}>✓</div>
            <div>
              <div className="feed-stat-value">{stats.success}</div>
              <div className="feed-stat-label">Sukces</div>
            </div>
          </div>
          <div className="feed-stat-card">
            <div className="feed-stat-icon" style={{ color: getStatusColor('Rezygnacja') }}>✕</div>
            <div>
              <div className="feed-stat-value">{stats.rezygnacja}</div>
              <div className="feed-stat-label">Rezygnacja</div>
            </div>
          </div>
          <div className="feed-stat-card">
            <div className="feed-stat-icon" style={{ color: getStatusColor('Przełożone') }}>⟳</div>
            <div>
              <div className="feed-stat-value">{stats.przelozone}</div>
              <div className="feed-stat-label">Przełożone</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="text-center py-8 text-gray-500">Ładowanie...</div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Brak aktywności {showArchive ? 'w wybranym dniu' : 'dzisiaj'}</p>
          </div>
        ) : (
          <div className="feed-timeline">
            {activities.map((activity) => {
              const statusCircleColor = getStatusCircleColor(activity)
              const isNew = newActivityIds.has(activity.id)
              
              return (
                <div
                  key={activity.id}
                  className={`feed-item ${isNew ? 'feed-item-blink' : ''}`}
                >
                  {statusCircleColor && (
                    <div
                      className="feed-status-circle"
                      style={{ backgroundColor: statusCircleColor }}
                    />
                  )}
                  <div className="feed-item-icon">{getActivityIcon(activity.type)}</div>
                  <div className="feed-item-content">
                    <div className="feed-item-message">
                      {formatActivityMessage(activity)}
                    </div>
                    <div className="feed-item-time">
                      {new Date(activity.createdAt).toLocaleTimeString('pl-PL', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

