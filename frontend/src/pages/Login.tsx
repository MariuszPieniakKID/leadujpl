import { useState } from 'react'
import axios from 'axios'
import { saveAuth } from '../lib/auth'
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
      const res = await axios.post('/api/auth/login', { email, password })
      saveAuth(res.data.token, res.data.user)
      navigate('/')
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Błąd logowania')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)', padding: 'var(--space-4)' }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <div className="text-center mb-6">
          <h1 style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary-600)', marginBottom: 'var(--space-2)' }}>leaduj</h1>
          <p className="text-gray-600">Zaloguj się do swojego konta</p>
        </div>
        
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">Adres email</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="twoj@email.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Hasło</label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          
          {error && (
            <div className="text-error text-sm p-3 bg-error-50 rounded border border-error-200 mb-4">
              {error}
            </div>
          )}
          
          <button className="primary" type="submit" style={{ width: '100%', padding: 'var(--space-3) var(--space-4)' }}>
            Zaloguj się
          </button>
        </form>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Demo konta:</p>
          <p>admin@admin.pl / menago@example.com / user@user.pl</p>
          <p>Hasło: test123</p>
        </div>
      </div>
    </div>
  )
}


