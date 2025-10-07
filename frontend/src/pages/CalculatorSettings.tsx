import { useEffect, useMemo, useState } from 'react'
import baseData from '../data/calculatorData.json'
import api from '../lib/api'
import { getUser } from '../lib/auth'
import { Navigate } from 'react-router-dom'

type PricingData = typeof baseData.pricing

export default function CalculatorSettingsPage() {
  const user = getUser()
  if (!user || (user.role !== 'MANAGER' && user.role !== 'ADMIN')) return <Navigate to="/calculator" replace />

  const [settings, setSettings] = useState<Record<string, any>>(() => ({ ...(baseData as any).settings }))
  const [pricing, setPricing] = useState<PricingData>(() => ({ ...(baseData as any).pricing }))
  const managerId = user?.id
  const marginMap = (settings?.margins as Record<string, { amount?: number; percent?: number }>) || {}
  const myMargin = marginMap[managerId || ''] || { amount: 0, percent: 0 }

  // Load from backend
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/calculator/config')
        if (res.data?.settings) setSettings(res.data.settings)
        if (res.data?.pricing) setPricing(res.data.pricing)
      } catch {
        // fallback to baseData already in state
      }
    })()
  }, [])

  async function save() {
    const payload = { settings, pricing }
    await api.put('/api/calculator/config', payload)
    alert('Zapisano ustawienia w bazie danych.')
  }

  async function reset() {
    setSettings({ ...(baseData as any).settings })
    setPricing({ ...(baseData as any).pricing })
    await api.put('/api/calculator/config', { settings: (baseData as any).settings, pricing: (baseData as any).pricing })
  }

  const pvSets = useMemo(() => Object.keys(pricing.pvPowerPriceD || {}), [pricing])
  const inverterKeys = useMemo(() => Object.keys(pricing.inverterMap || {}), [pricing])
  const batteryKeys = useMemo(() => Object.keys(pricing.batteryMap || {}), [pricing])

  return (
    <div className="app-wrapper">
      <div className="app-content">
        <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ustawienia kalkulatora</h1>
          <p className="text-gray-600">Edycja wartości, cen i parametrów (lokalnie)</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="secondary" onClick={reset}>Przywróć domyślne</button>
          <button className="primary" onClick={save}>Zapisz</button>
        </div>
      </div>

      {/* Globalna marża administratora (tylko dla ADMIN) */}
      {user?.role === 'ADMIN' && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Marża Administratora (Globalna)</h3>
          <p className="text-gray-600" style={{ marginBottom: 8 }}>
            Ta marża będzie automatycznie dodawana do wszystkich kalkulacji handlowców (dodatkowo do marży managera i osobistej).
          </p>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Stawka (PLN)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={(settings.adminMargin?.amount || 0) || ''}
                onChange={e => {
                  const amount = e.target.value === '' ? 0 : Number(e.target.value)
                  setSettings({ 
                    ...settings, 
                    adminMargin: { 
                      amount, 
                      percent: amount > 0 ? 0 : (settings.adminMargin?.percent || 0) 
                    } 
                  })
                }}
                placeholder="np. 500.00"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Procent (%)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={(settings.adminMargin?.percent || 0) || ''}
                onChange={e => {
                  const percent = e.target.value === '' ? 0 : Number(e.target.value)
                  setSettings({ 
                    ...settings, 
                    adminMargin: { 
                      amount: percent > 0 ? 0 : (settings.adminMargin?.amount || 0), 
                      percent 
                    } 
                  })
                }}
                placeholder="np. 5.00"
              />
            </div>
          </div>
        </section>
      )}

      {/* Marża managera dla handlowców przypisanych do tego managera */}
      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Marża Managera</h3>
        <p className="text-gray-600" style={{ marginBottom: 8 }}>Dla Twoich handlowców (przypisanych do Ciebie).</p>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Stawka (PLN)</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              value={myMargin.amount || ''}
              onChange={e => {
                const amount = e.target.value === '' ? 0 : Number(e.target.value)
                const next = { ...marginMap, [managerId!]: { amount, percent: amount > 0 ? 0 : myMargin.percent } }
                setSettings({ ...settings, margins: next })
              }}
              placeholder="np. 500.00"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Procent (%)</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              value={myMargin.percent || ''}
              onChange={e => {
                const percent = e.target.value === '' ? 0 : Number(e.target.value)
                const next = { ...marginMap, [managerId!]: { amount: percent > 0 ? 0 : myMargin.amount, percent } }
                setSettings({ ...settings, margins: next })
              }}
              placeholder="np. 5"
            />
          </div>
        </div>
        <div className="text-gray-600 text-sm">Ustaw jedno z pól: stawka albo procent. Użyte będzie to, które jest &gt; 0.</div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Kalkulator mocy PV - Parametry domyślne</h3>
        <p className="text-gray-600" style={{ marginBottom: 12 }}>Domyślne wartości używane w kalkulatorze mocy fotowoltaicznej</p>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Margines bezpieczeństwa</label>
            <input 
              className="form-input" 
              type="number" 
              step="0.01" 
              value={settings.pvMarginDefault || 1.2} 
              onChange={e => setSettings({ ...settings, pvMarginDefault: Number(e.target.value || 1.2) })} 
              placeholder="np. 1.2"
            />
            <div className="text-gray-600 text-sm">Domyślnie: 1.2 (oznacza +20% zapasu mocy)</div>
          </div>
          <div className="form-group">
            <label className="form-label">Roczna produkcja z 1 kWp (kWh)</label>
            <input 
              className="form-input" 
              type="number" 
              step="1" 
              value={settings.pvYieldPerKwpDefault || 1000} 
              onChange={e => setSettings({ ...settings, pvYieldPerKwpDefault: Number(e.target.value || 1000) })} 
              placeholder="np. 1000"
            />
            <div className="text-gray-600 text-sm">Domyślnie: 1000 kWh/rok z 1 kWp</div>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Parametry (USTAWIENIA)</h3>
        <div className="form-grid-2">
          {Object.keys(settings).filter(k => k !== 'pvMarginDefault' && k !== 'pvYieldPerKwpDefault').map((key) => (
            <div className="form-group" key={key}>
              <label className="form-label">{key}</label>
              <input className="form-input" value={String(settings[key] ?? '')} onChange={e => setSettings({ ...settings, [key]: e.target.value })} />
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Cennik zestawów PV (bazowy + grunt)</h3>
        <div className="form-grid-2">
          {pvSets.map((k) => (
            <div className="form-group" key={k} style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">{k}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input className="form-input" type="number" step="0.01" value={Number((pricing.pvPowerPriceD as any)[k] || 0)} onChange={e => setPricing({ ...pricing, pvPowerPriceD: { ...(pricing.pvPowerPriceD as any), [k]: Number(e.target.value || 0) } as any })} placeholder="Cena baza (netto)" />
                <input className="form-input" type="number" step="0.01" value={Number((pricing.pvPowerPriceE as any)[k] || 0)} onChange={e => setPricing({ ...pricing, pvPowerPriceE: { ...(pricing.pvPowerPriceE as any), [k]: Number(e.target.value || 0) } as any })} placeholder="Dopłata grunt (netto)" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Falowniki</h3>
        <div className="form-grid-2">
          {inverterKeys.map((k) => (
            <div className="form-group" key={k}>
              <label className="form-label">{k}</label>
              <input className="form-input" type="number" step="0.01" value={Number((pricing.inverterMap as any)[k] || 0)} onChange={e => setPricing({ ...pricing, inverterMap: { ...(pricing.inverterMap as any), [k]: Number(e.target.value || 0) } as any })} />
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 style={{ marginTop: 0 }}>Magazyny energii</h3>
        <div className="form-grid-2">
          {batteryKeys.map((k) => (
            <div className="form-group" key={k}>
              <label className="form-label">{k}</label>
              <input className="form-input" type="number" step="0.01" value={Number((pricing.batteryMap as any)[k] || 0)} onChange={e => setPricing({ ...pricing, batteryMap: { ...(pricing.batteryMap as any), [k]: Number(e.target.value || 0) } as any })} />
            </div>
          ))}
        </div>
      </section>
        </div>
      </div>
    </div>
  )
}


