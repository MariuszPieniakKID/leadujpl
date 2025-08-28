import { useEffect, useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/interaction'
import api from '../lib/api'
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

  const canManageAll = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGER'

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
  }

  const events = useMemo(() => meetings.map(m => ({ id: m.id, title: m.notes || 'Spotkanie', start: m.scheduledAt })), [meetings])

  async function onSelect(arg: DateSelectArg) {
    const title = window.prompt('Temat spotkania?')
    if (!title) return
    const attendeeId = canManageAll && selectedUserId ? selectedUserId : currentUser.id
    await api.post('/api/meetings', { scheduledAt: arg.startStr, notes: title, attendeeId })
    await refreshMeetings()
  }

  async function onEventClick(clickInfo: EventClickArg) {
    const choice = window.confirm('Usunąć to spotkanie?')
    if (!choice) return
    await api.delete(`/api/meetings/${clickInfo.event.id}`)
    await refreshMeetings()
  }

  async function onEventDrop(dropInfo: EventDropArg) {
    await api.patch(`/api/meetings/${dropInfo.event.id}`, { scheduledAt: dropInfo.event.start?.toISOString() })
    await refreshMeetings()
  }

  return (
    <div className="container" style={{ paddingTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2>Kalendarz</h2>
        {canManageAll && (
          <div>
            <label className="muted" style={{ marginRight: 8 }}>Użytkownik:</label>
            <select value={selectedUserId || ''} onChange={e => setSelectedUserId(e.target.value || undefined)}>
              <option value="">Ja ({currentUser.firstName} {currentUser.lastName})</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          initialView="dayGridMonth"
          selectable={true}
          selectMirror={true}
          editable={true}
          events={events}
          select={onSelect}
          eventClick={onEventClick}
          eventDrop={onEventDrop}
          height="auto"
        />
      </div>
    </div>
  )
}


