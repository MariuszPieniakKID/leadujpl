import { useEffect, useState } from 'react'
import { clearAuth } from '../lib/auth'
import api from '../lib/api'
import { isValidPolishPhone, polishPhoneHtmlPattern, polishPhoneTitle } from '../lib/phone'

type Me = {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string | null
  street?: string | null
  city?: string | null
  postalCode?: string | null
  houseNumber?: string | null
  apartmentNumber?: string | null
  company?: string | null
  industry?: string | null
  role: string
}

export default function AccountPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await api.get<Me>('/api/users/me')
        setMe(res.data)
      } catch (e: any) {
        setError(e?.response?.data?.error || 'Nie udało się pobrać danych konta')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function save() {
    if (!me) return
    setSaving(true)
    setError(null)
    try {
      if (me.phone && !isValidPolishPhone(me.phone)) { setError('Nieprawidłowy numer telefonu (PL)'); setSaving(false); return }
      await api.patch('/api/users/me', {
        firstName: me.firstName,
        lastName: me.lastName,
        phone: me.phone || undefined,
        street: me.street || undefined,
        city: me.city || undefined,
        postalCode: me.postalCode || undefined,
        houseNumber: me.houseNumber || undefined,
        apartmentNumber: me.apartmentNumber || undefined,
        company: me.company || undefined,
        industry: me.industry || undefined,
      })
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Nie udało się zapisać zmian')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="app-wrapper"><div className="app-content"><div className="container"><section className="card"><div>Ładowanie…</div></section></div></div></div>
  if (error) return <div className="app-wrapper"><div className="app-content"><div className="container"><section className="card"><div className="text-error">{error}</div></section></div></div></div>
  if (!me) return null

  return (
    <div className="app-wrapper">
      <div className="app-content">
        <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Moje konto</h1>
          <p className="text-gray-600">Edytuj swoje dane</p>
        </div>
      </div>
      <section className="card">
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Imię</label>
            <input className="form-input" value={me.firstName} onChange={e => setMe({ ...me, firstName: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Nazwisko</label>
            <input className="form-input" value={me.lastName} onChange={e => setMe({ ...me, lastName: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Telefon</label>
            <input className="form-input" value={me.phone || ''} onChange={e => setMe({ ...me, phone: e.target.value })} pattern={polishPhoneHtmlPattern} title={polishPhoneTitle} inputMode="tel" />
          </div>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" value={me.email} disabled />
          </div>
          <div className="form-group">
            <label className="form-label">Ulica</label>
            <input className="form-input" value={me.street || ''} onChange={e => setMe({ ...me, street: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Miasto</label>
            <input className="form-input" value={me.city || ''} onChange={e => setMe({ ...me, city: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Kod pocztowy</label>
            <input className="form-input" value={me.postalCode || ''} onChange={e => setMe({ ...me, postalCode: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Nr domu</label>
            <input className="form-input" value={me.houseNumber || ''} onChange={e => setMe({ ...me, houseNumber: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Nr lokalu</label>
            <input className="form-input" value={me.apartmentNumber || ''} onChange={e => setMe({ ...me, apartmentNumber: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Firma</label>
            <input className="form-input" value={me.company || ''} onChange={e => setMe({ ...me, company: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Branża</label>
            <input className="form-input" value={me.industry || ''} onChange={e => setMe({ ...me, industry: e.target.value })} />
          </div>
        </div>
        {error && <div className="text-error text-sm mt-4 p-3 bg-error-50 rounded border border-error-200">{error}</div>}
        <div className="modal-footer" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <button className="primary" onClick={save} disabled={saving}>{saving ? 'Zapisywanie…' : 'Zapisz'}</button>
          <button className="danger" onClick={() => { clearAuth(); window.location.href = '/login' }}>Wyloguj</button>
        </div>
      </section>
        </div>
      </div>
    </div>
  )
}


