import { useState } from 'react'
import api from '../lib/api'
import { saveAuth } from '../lib/auth'
import Logo from '../components/Logo'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      const res = await api.post('/api/auth/login', { email, password })
      saveAuth(res.data.token, res.data.user)
      navigate('/')
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Błąd logowania')
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: 'var(--space-6)',
      position: 'relative'
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 30% 20%, rgba(59, 130, 246, 0.05) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(168, 85, 247, 0.05) 0%, transparent 50%)',
        pointerEvents: 'none'
      }} />
      
      <div className="card" style={{ 
        width: '100%', 
        maxWidth: '480px',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center',
            marginBottom: 'var(--space-6)' 
          }}>
            <Logo size={48} showText={true} />
          </div>
          <h1 style={{ 
            fontSize: 'var(--text-3xl)', 
            fontWeight: 900, 
            marginBottom: 'var(--space-2)',
            background: 'linear-gradient(135deg, var(--gray-900) 0%, var(--gray-700) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Witaj ponownie
          </h1>
          <p className="text-gray-600" style={{ fontSize: 'var(--text-lg)', fontWeight: 500 }}>
            Zaloguj się do swojego konta CRM
          </p>
        </div>
        
        <form onSubmit={onSubmit} style={{ marginBottom: 'var(--space-8)' }}>
          <div className="form-group">
            <label className="form-label" style={{ 
              fontSize: 'var(--text-sm)', 
              fontWeight: 600,
              color: 'var(--gray-700)',
              marginBottom: 'var(--space-2)'
            }}>
              Adres email
            </label>
            <input 
              className="form-input" 
              type="email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="twoj@email.com" 
              required 
              style={{
                fontSize: 'var(--text-base)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid rgba(226, 232, 240, 0.6)',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease'
              }}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label" style={{ 
              fontSize: 'var(--text-sm)', 
              fontWeight: 600,
              color: 'var(--gray-700)',
              marginBottom: 'var(--space-2)'
            }}>
              Hasło
            </label>
            <input 
              className="form-input" 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••" 
              required 
              style={{
                fontSize: 'var(--text-base)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid rgba(226, 232, 240, 0.6)',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease'
              }}
            />
          </div>
          
          {error && (
            <div style={{
              color: 'var(--error-600)',
              fontSize: 'var(--text-sm)',
              padding: 'var(--space-4)',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              marginBottom: 'var(--space-6)',
              fontWeight: 500
            }}>
              {error}
            </div>
          )}
          
          <button 
            className="primary" 
            type="submit" 
            style={{ 
              width: '100%', 
              padding: 'var(--space-4) var(--space-6)',
              fontSize: 'var(--text-base)',
              fontWeight: 700,
              borderRadius: 'var(--radius-xl)',
              background: 'var(--gradient-primary)',
              border: 'none',
              color: 'white',
              boxShadow: 'var(--shadow-glass-md)',
              transition: 'all 0.3s ease',
              minHeight: '52px'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--space-2)' }}>
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10,17 15,12 10,7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            Zaloguj się
          </button>
        </form>
        
        {/* Demo accounts info */}
        <div style={{
          textAlign: 'center',
          padding: 'var(--space-6)',
          background: 'rgba(59, 130, 246, 0.05)',
          borderRadius: 'var(--radius-2xl)',
          border: '1px solid rgba(59, 130, 246, 0.1)'
        }}>
          <h3 style={{ 
            fontSize: 'var(--text-sm)', 
            fontWeight: 700, 
            color: 'var(--gray-800)',
            marginBottom: 'var(--space-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Konta demonstracyjne
          </h3>
          <div style={{ 
            fontSize: 'var(--text-sm)', 
            color: 'var(--gray-600)',
            lineHeight: 1.6,
            fontWeight: 500
          }}>
            <p style={{ marginBottom: 'var(--space-2)' }}>
              <strong>Admin:</strong> admin@admin.pl
            </p>
            <p style={{ marginBottom: 'var(--space-2)' }}>
              <strong>Manager:</strong> menago@example.com
            </p>
            <p style={{ marginBottom: 'var(--space-2)' }}>
              <strong>Handlowiec:</strong> user@user.pl
            </p>
            <p style={{ 
              color: 'var(--primary-600)', 
              fontWeight: 700,
              marginTop: 'var(--space-3)'
            }}>
              Hasło: <code style={{ 
                background: 'rgba(59, 130, 246, 0.1)', 
                padding: '2px 6px', 
                borderRadius: '4px',
                fontSize: 'var(--text-xs)'
              }}>test123</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}


