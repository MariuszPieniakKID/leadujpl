import { NavLink, useLocation } from 'react-router-dom'
import { getUser, clearAuth } from '../lib/auth'

export default function MobileNav() {
  const user = getUser()
  const location = useLocation()

  const isManager = user?.role === 'MANAGER'
  const isAdmin = user?.role === 'ADMIN'

  // Choose primary tabs based on role
  const tabs = (
    isManager || isAdmin
      ? [
          { to: '/', label: 'Home', icon: HomeIcon },
          { to: '/calendar', label: 'Kalendarz', icon: CalendarIcon },
          { to: '/clients', label: 'Klienci', icon: UsersIcon },
          { to: '/sales', label: 'Zespół', icon: TeamIcon },
          { to: '/account', label: 'Konto', icon: UserIcon },
        ]
      : [
          { to: '/', label: 'Home', icon: HomeIcon },
          { to: '/calendar', label: 'Kalendarz', icon: CalendarIcon },
          { to: '/my-clients', label: 'Klienci', icon: UsersIcon },
          { to: '/calculator', label: 'Oferta', icon: CalculatorIcon },
          { to: '/account', label: 'Konto', icon: UserIcon },
        ]
  )

  // Hide on login
  if (location.pathname === '/login') return null

  return (
    <nav className="mobile-tabbar" aria-label="Nawigacja dolna">
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'active' : ''} aria-label={label}>
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        onClick={() => { clearAuth(); window.location.href = '/login' }}
        aria-label="Wyloguj"
        className="logout-tab"
      >
        <LogoutIcon />
        <span>Wyloguj</span>
      </button>
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event('show-install-prompt'))}
        aria-label="Zainstaluj"
        className="install-tab"
      >
        <InstallIcon />
        <span>Instaluj</span>
      </button>
    </nav>
  )
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5"/>
      <path d="M5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9"/>
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function TeamIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Z"/>
      <path d="M20 21a8 8 0 0 0-16 0"/>
    </svg>
  )
}

function CalculatorIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2"/>
      <rect x="7" y="7" width="10" height="4" rx="1"/>
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 21a8 8 0 0 0-16 0"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <path d="M16 17l5-5-5-5"/>
      <path d="M21 12H9"/>
    </svg>
  )
}

function InstallIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3v12"/>
      <path d="M7 10l5 5 5-5"/>
      <path d="M5 21h14"/>
    </svg>
  )
}


