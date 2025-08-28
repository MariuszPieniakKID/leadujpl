import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import './App.css'

import { fetchLeads, createLead } from './lib/api'
import Login from './pages/Login'
import { clearAuth, getToken, getUser } from './lib/auth'

function Protected({ children, roles }: { children: React.ReactNode, roles?: Array<'ADMIN' | 'MANAGER' | 'SALES_REP'> }) {
  const token = getToken()
  const user = getUser()
  if (!token || !user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <>{children}</>
}

function Dashboard() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      try {
        const data = await fetchLeads()
        setLeads(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [])

  const upcoming = [
    { id: 1, date: '2025-09-01', time: '10:00', place: 'Warszawa, Złota 44', topic: 'Oferta PV – wstępna' },
    { id: 2, date: '2025-09-01', time: '13:30', place: 'Kraków, Lubicz 1', topic: 'Audyt dachu' },
    { id: 3, date: '2025-09-02', time: '09:00', place: 'Gdańsk, Grunwaldzka 5', topic: 'Analiza finansowa' },
    { id: 4, date: '2025-09-02', time: '15:15', place: 'Łódź, Piotrkowska 100', topic: 'Follow-up handlowy' },
    { id: 5, date: '2025-09-03', time: '11:45', place: 'Poznań, Półwiejska 2', topic: 'Podpisanie umowy' },
  ]

  const recent = [
    { id: 11, date: '2025-08-27', time: '14:00', place: 'Warszawa', topic: 'Konsultacja techniczna' },
    { id: 12, date: '2025-08-27', time: '16:30', place: 'Lublin', topic: 'Prezentacja oferty' },
    { id: 13, date: '2025-08-26', time: '10:15', place: 'Wrocław', topic: 'Spotkanie statusowe' },
  ]

  const points = 1280

  return (
    <div className="container">
      <nav className="navbar">
        <div className="brand">leaduj</div>
        <div className="nav">
          <Link to="/">Home</Link>
          <Link to="/calendar">Kalendarz</Link>
          <Link to="/stats">Statystyki i Analityka</Link>
          <Link to="/account">Moje Konto</Link>
          <button className="logout" onClick={() => { clearAuth(); location.href = '/login' }}>Wyloguj</button>
        </div>
      </nav>

      <div className="grid">
        <section className="card">
          <h3>Najbliższe spotkania</h3>
          <ul className="list">
            {upcoming.map(m => (
              <li key={m.id}>
                <div>
                  <strong>{m.date} • {m.time}</strong>
                  <div className="muted">{m.place}</div>
                </div>
                <div className="topic">{m.topic}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card emphasize">
          <h3>Twoje punkty</h3>
          <div className="points">{points}</div>
          <div className="muted small">Punkty sprzedażowe (przykładowe)</div>
        </section>

        <section className="card cta-card">
          <h3>Dodaj spotkanie</h3>
          <p className="muted">Najważniejsza akcja — zacznij nowe spotkanie w 2 kliknięcia.</p>
          <button className="primary" onClick={() => alert('Formularz dodawania spotkania (w przygotowaniu)')}>Nowe spotkanie</button>
        </section>

        <section className="card span-2">
          <h3>Twoje ostatnie spotkania</h3>
          <ul className="list">
            {recent.map(m => (
              <li key={m.id}>
                <div>
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
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Protected><Dashboard /></Protected>} />
        <Route path="/calendar" element={<Protected><div className="container" style={{ paddingTop: 16 }}><h2>Kalendarz</h2><p className="muted">Wersja demonstracyjna. Widok kalendarza będzie tutaj.</p></div></Protected>} />
        <Route path="/stats" element={<Protected><div className="container" style={{ paddingTop: 16 }}><h2>Statystyki i Analityka</h2><p className="muted">Wersja demonstracyjna. Wykresy i KPI pojawią się w kolejnej iteracji.</p></div></Protected>} />
        <Route path="/account" element={<Protected><div className="container" style={{ paddingTop: 16 }}><h2>Moje Konto</h2></div></Protected>} />
        <Route path="/admin" element={<Protected roles={['ADMIN']}><AdminPage /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
