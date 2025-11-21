import { useState } from 'react'
import api from '../lib/api'
import Logo from '../components/Logo'
import { Link } from 'react-router-dom'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setLoading(true)
    
    try {
      await api.post('/api/auth/forgot-password', { email })
      setSuccess(true)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Nie udało się wysłać emaila z resetem hasła')
    } finally {
      setLoading(false)
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
            <Logo size={55} showText={true} />
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
            Zapomniałeś hasła?
          </h1>
          <p className="text-gray-600" style={{ fontSize: 'var(--text-lg)', fontWeight: 500 }}>
            Nie martw się! Wyślemy Ci link do resetu
          </p>
        </div>
        
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-6)',
              boxShadow: 'var(--shadow-glass-lg)'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            
            <h2 style={{ 
              fontSize: 'var(--text-2xl)', 
              fontWeight: 700, 
              marginBottom: 'var(--space-4)',
              color: 'var(--gray-900)'
            }}>
              Email wysłany! 📧
            </h2>
            
            <p style={{
              fontSize: 'var(--text-base)',
              color: 'var(--gray-600)',
              marginBottom: 'var(--space-6)',
              lineHeight: 1.6
            }}>
              Jeśli podany adres email istnieje w naszym systemie, wysłaliśmy na niego link do resetu hasła.
            </p>
            
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-6)',
              textAlign: 'left'
            }}>
              <p style={{ 
                fontSize: 'var(--text-sm)', 
                color: 'var(--gray-700)',
                margin: 0,
                lineHeight: 1.6
              }}>
                <strong>💡 Wskazówka:</strong><br/>
                • Sprawdź folder spam/wiadomości niechciane<br/>
                • Link jest ważny przez 1 godzinę<br/>
                • Jeśli nie otrzymasz emaila, spróbuj ponownie
              </p>
            </div>
            
            <Link 
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-4) var(--space-6)',
                fontSize: 'var(--text-base)',
                fontWeight: 700,
                borderRadius: 'var(--radius-xl)',
                background: 'var(--gradient-primary)',
                border: 'none',
                color: 'white',
                textDecoration: 'none',
                boxShadow: 'var(--shadow-glass-md)',
                transition: 'all 0.3s ease',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Powrót do logowania
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={onSubmit} style={{ marginBottom: 'var(--space-6)' }}>
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
                  disabled={loading}
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
                disabled={loading}
                style={{ 
                  width: '100%', 
                  padding: 'var(--space-4) var(--space-6)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-xl)',
                  background: loading ? 'var(--gray-400)' : 'var(--gradient-primary)',
                  border: 'none',
                  color: 'white',
                  boxShadow: 'var(--shadow-glass-md)',
                  transition: 'all 0.3s ease',
                  minHeight: '52px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--space-2)', animation: 'spin 1s linear infinite' }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    Wysyłanie...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--space-2)' }}>
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    Wyślij link resetujący
                  </>
                )}
              </button>
            </form>
            
            <div style={{ textAlign: 'center' }}>
              <Link 
                to="/login"
                style={{
                  color: 'var(--primary-600)',
                  textDecoration: 'none',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  transition: 'color 0.2s ease'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Powrót do logowania
              </Link>
            </div>
          </>
        )}
      </div>
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

