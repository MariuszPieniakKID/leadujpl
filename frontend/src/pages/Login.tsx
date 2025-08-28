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
    <div style={{ maxWidth: 360, margin: '80px auto' }}>
      <h2>Logowanie</h2>
      <form onSubmit={onSubmit}>
        <div>
          <label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div>
          <label>Hasło</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit">Zaloguj</button>
      </form>
    </div>
  )
}


