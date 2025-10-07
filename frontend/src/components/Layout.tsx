import { NavLink, useLocation } from 'react-router-dom'
import { getUser, clearAuth } from '../lib/auth'
import Logo from './Logo'

export default function Layout({ children }: { children: React.ReactNode }) {
  const user = getUser()
  const location = useLocation()
  
  // Don't show layout on login page
  if (location.pathname === '/login') {
    return <>{children}</>
  }

  return (
    <div className="app-wrapper">
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Logo size={28} />
          <span>Leaduj</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>Dashboard</span>
          </NavLink>
          
          <NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            <span>Kalendarz</span>
          </NavLink>
          
          {user && (user.role === 'ADMIN' || user.role === 'MANAGER') && (
            <NavLink to="/clients" className={({ isActive }) => isActive ? 'active' : ''}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>Klienci</span>
            </NavLink>
          )}
          
          {user && (user.role === 'SALES_REP' || user.role === 'MANAGER') && (
            <NavLink to="/my-clients" className={({ isActive }) => isActive ? 'active' : ''}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
              </svg>
              <span>Moi klienci</span>
            </NavLink>
          )}
          
          <NavLink to="/calculator" className={({ isActive }) => isActive ? 'active' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
              <path d="M8 6h8M8 10h8M8 14h4M8 18h4"/>
            </svg>
            <span>Kalkulator</span>
          </NavLink>
          
          {user && (user.role === 'MANAGER' || user.role === 'ADMIN') && (
            <NavLink to="/sales" className={({ isActive }) => isActive ? 'active' : ''}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>Zespół</span>
            </NavLink>
          )}
          
          <NavLink to="/stats" className={({ isActive }) => isActive ? 'active' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18"/>
              <path d="m19 9-5 5-4-4-3 3"/>
            </svg>
            <span>Statystyki</span>
          </NavLink>
          
          {user && user.role === 'ADMIN' && (
            <NavLink to="/feed" className={({ isActive }) => isActive ? 'active' : ''}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19c7 0 7-5 7-5v-5a7 7 0 1 0-14 0v5s0 5 7 5z"/>
                <path d="M14 13h-4M12 11v4"/>
              </svg>
              <span>Feed</span>
            </NavLink>
          )}
          
          <NavLink to="/account" className={({ isActive }) => isActive ? 'active' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Moje konto</span>
          </NavLink>
        </nav>
        
        <div style={{ marginTop: 'auto', paddingTop: 'var(--space-6)' }}>
          <button 
            className="secondary" 
            onClick={() => { clearAuth(); window.location.href = '/login' }}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Wyloguj
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-nav">
        <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          <span>Home</span>
        </NavLink>
        
        <NavLink to="/calendar" className={({ isActive }) => isActive ? 'active' : ''}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          <span>Kalendarz</span>
        </NavLink>
        
        {user && (user.role === 'ADMIN' || user.role === 'MANAGER') ? (
          <NavLink to="/clients" className={({ isActive }) => isActive ? 'active' : ''}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
            <span>Klienci</span>
          </NavLink>
        ) : user && (user.role === 'SALES_REP' || user.role === 'MANAGER') && (
          <NavLink to="/my-clients" className={({ isActive }) => isActive ? 'active' : ''}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="8.5" cy="7" r="4"/>
            </svg>
            <span>Moi</span>
          </NavLink>
        )}
        
        <NavLink to="/calculator" className={({ isActive }) => isActive ? 'active' : ''}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
            <path d="M8 6h8M8 10h8M8 14h4"/>
          </svg>
          <span>Kalkulator</span>
        </NavLink>
        
        <NavLink to="/account" className={({ isActive }) => isActive ? 'active' : ''}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>Konto</span>
        </NavLink>
      </nav>

      {/* Main Content */}
      {children}
    </div>
  )
}

