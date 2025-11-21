import { useState, useEffect } from 'react'
import api from '../lib/api'
import Logo from '../components/Logo'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')
  
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [tokenValid, setTokenValid] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!token) {
      setError('Brak tokenu resetowania. Sprawdź link z emaila.')
      setVerifying(false)
      return
    }

    // Verify token on mount
    const verifyToken = async () => {
      try {
        const res = await api.get(`/api/auth/verify-reset-token/${token}`)
        if (res.data.valid) {
          setTokenValid(true)
        } else {
          setError(res.data.error || 'Link resetowania jest nieprawidłowy')
        }
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Link resetowania jest nieprawidłowy lub wygasł')
      } finally {
        setVerifying(false)
      }
    }

    verifyToken()
  }, [token])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (password.length < 6) {
      setError('Hasło musi mieć minimum 6 znaków')
      return
    }
    
    if (password !== confirmPassword) {
      setError('Hasła nie są identyczne')
      return
    }
    
    setLoading(true)
    
    try {
      await api.post('/api/auth/reset-password', { token, newPassword: password })
      setSuccess(true)
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Nie udało się zresetować hasła')
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: 'var(--space-6)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '4px solid rgba(59, 130, 246, 0.2)',
            borderTopColor: 'var(--primary-600)',
            borderRadius: '50%',
            margin: '0 auto var(--space-4)',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: 'var(--gray-600)', fontSize: 'var(--text-lg)' }}>
            Weryfikacja linku...
          </p>
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
            {success ? 'Hasło zmienione!' : 'Nowe hasło'}
          </h1>
          <p className="text-gray-600" style={{ fontSize: 'var(--text-lg)', fontWeight: 500 }}>
            {success ? 'Możesz się teraz zalogować' : 'Ustaw nowe hasło do konta'}
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
              Sukces! 🎉
            </h2>
            
            <p style={{
              fontSize: 'var(--text-base)',
              color: 'var(--gray-600)',
              marginBottom: 'var(--space-6)',
              lineHeight: 1.6
            }}>
              Twoje hasło zostało zmienione.<br/>
              Za chwilę zostaniesz przekierowany do logowania...
            </p>
            
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
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10,17 15,12 10,7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              Przejdź do logowania
            </Link>
          </div>
        ) : !tokenValid ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto var(--space-6)',
              boxShadow: 'var(--shadow-glass-lg)'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            
            <h2 style={{ 
              fontSize: 'var(--text-2xl)', 
              fontWeight: 700, 
              marginBottom: 'var(--space-4)',
              color: 'var(--gray-900)'
            }}>
              Nieprawidłowy link
            </h2>
            
            <p style={{
              fontSize: 'var(--text-base)',
              color: 'var(--gray-600)',
              marginBottom: 'var(--space-6)',
              lineHeight: 1.6
            }}>
              {error || 'Link resetowania jest nieprawidłowy, wygasł lub został już wykorzystany.'}
            </p>
            
            <Link 
              to="/forgot-password"
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
                marginRight: 'var(--space-3)'
              }}
            >
              Poproś o nowy link
            </Link>
            
            <Link 
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                padding: 'var(--space-4) var(--space-6)',
                fontSize: 'var(--text-base)',
                fontWeight: 600,
                borderRadius: 'var(--radius-xl)',
                background: 'transparent',
                border: '2px solid var(--gray-300)',
                color: 'var(--gray-700)',
                textDecoration: 'none',
                transition: 'all 0.3s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                  Nowe hasło
                </label>
                <div style={{ position: 'relative' }}>
                  <input 
                    className="form-input" 
                    type={showPassword ? 'text' : 'password'}
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="••••••••" 
                    required 
                    disabled={loading}
                    minLength={6}
                    style={{
                      fontSize: 'var(--text-base)',
                      padding: 'var(--space-4)',
                      paddingRight: 'var(--space-12)',
                      borderRadius: 'var(--radius-xl)',
                      border: '1px solid rgba(226, 232, 240, 0.6)',
                      background: 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(10px)',
                      transition: 'all 0.3s ease',
                      width: '100%'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: 'var(--space-4)',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 'var(--space-2)',
                      color: 'var(--gray-500)',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
                <p style={{ 
                  fontSize: 'var(--text-xs)', 
                  color: 'var(--gray-500)', 
                  marginTop: 'var(--space-2)' 
                }}>
                  Minimum 6 znaków
                </p>
              </div>
              
              <div className="form-group">
                <label className="form-label" style={{ 
                  fontSize: 'var(--text-sm)', 
                  fontWeight: 600,
                  color: 'var(--gray-700)',
                  marginBottom: 'var(--space-2)'
                }}>
                  Potwierdź hasło
                </label>
                <input 
                  className="form-input" 
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  placeholder="••••••••" 
                  required 
                  disabled={loading}
                  minLength={6}
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
                    Zmieniam hasło...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 'var(--space-2)' }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Zmień hasło
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

