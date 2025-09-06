import { useMemo, useState } from 'react'
import baseData from '../data/calculatorData.json'
import api from '../lib/api'
import { getUser } from '../lib/auth'
import { Link } from 'react-router-dom'

export default function CalculatorPage() {
  const [remoteData, setRemoteData] = useState<any | null>(null)
  const data = useMemo(() => remoteData || (baseData as any), [remoteData])

  // Load config from backend
  useState(() => {
    (async () => {
      try {
        const res = await api.get('/api/calculator/config')
        setRemoteData(res.data)
      } catch {
        setRemoteData(null)
      }
    })()
  })

  const pvOptions = useMemo(() => Object.keys((data as any).pricing.pvPowerPriceD || {}), [data])
  const batteryOptions = useMemo(() => Object.keys((data as any).pricing.batteryMap || {}), [data])
  const inverterOptions = useMemo(() => Object.keys((data as any).pricing.inverterMap || {}), [data])
  const grantOptions = useMemo(() => {
    const s = (data as any).settings || {}
    return [
      { label: 'Brak dotacji', value: Number(s['Brak dotacji'] || 0) },
      { label: 'Mój Prąd (korzystał wcześniej)', value: Number(s['Mój Prąd (korzystał wcześniej)'] || 0) },
      { label: 'Mój Prąd (nie korzystał wcześniej)', value: Number(s['Mój Prąd (nie korzystał wcześniej)'] || 0) },
    ]
  }, [])

  const [form, setForm] = useState({
    systemType: 'PV – Dach' as 'PV – Dach' | 'PV – Grunt' | 'Falownik + Magazyn',
    pvSet: '',
    battery: '',
    inverter: '',
    backup: 'Nie' as 'Tak' | 'Nie',
    trench: 'Nie' as 'Tak' | 'Nie',
    grant: 'Brak dotacji',
    downPayment: 0,
    termMonths: 120,
  })

  const prices = (data as any).pricing
  const settings = (data as any).settings

  function pmt(ratePerPeriod: number, numberOfPayments: number, presentValue: number): number {
    if (ratePerPeriod === 0) return numberOfPayments > 0 ? -(presentValue / numberOfPayments) : 0
    const r = ratePerPeriod
    const n = numberOfPayments
    return -(presentValue * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  }

  const calc = useMemo(() => {
    const pvBase = form.pvSet ? Number(prices.pvPowerPriceD[form.pvSet] || 0) : 0
    const pvGroundExtra = form.systemType === 'PV – Grunt' && form.pvSet ? Number(prices.pvPowerPriceE[form.pvSet] || 0) : 0
    const inverterPrice = form.systemType === 'Falownik + Magazyn' && form.inverter ? Number(prices.inverterMap[form.inverter] || 0) : 0
    const batteryPrice = form.battery ? Number(prices.batteryMap[form.battery] || 0) : 0
    const backupPrice = form.backup === 'Tak' ? Number(settings['Dodatki: Backup (netto)'] || 0) : 0
    const trenchPrice = form.trench === 'Tak' ? Number(settings['Dodatki: Przekop (netto)'] || 0) : 0
    const subtotalNet = pvBase + pvGroundExtra + inverterPrice + batteryPrice + backupPrice + trenchPrice

    const grant = (grantOptions.find(g => g.label === form.grant)?.value) || 0
    const totalAfterGrant = Math.max(subtotalNet - grant, 0)
    const financed = Math.max(totalAfterGrant - (form.downPayment || 0), 0)

    const rrsoYear = Number(settings['RRSO (rocznie)'] || 0.1)
    const rateMonthly = rrsoYear / 12
    const monthly = pmt(rateMonthly, form.termMonths, financed)

    return {
      pvBase,
      pvGroundExtra,
      inverterPrice,
      batteryPrice,
      backupPrice,
      trenchPrice,
      subtotalNet,
      grant,
      totalAfterGrant,
      financed,
      rrsoYear,
      monthly,
    }
  }, [form, prices, settings, grantOptions])

  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kalkulator ofertowy</h1>
          <p className="text-gray-600">Wprowadź dane, aby przygotować ofertę</p>
        </div>
        {(() => { const u = getUser(); return (u && u.role === 'MANAGER') ? (
          <div>
            <Link className="secondary" to="/calculator/settings">Edytuj ustawienia</Link>
          </div>
        ) : null })()}
      </div>

      <section className="card" style={{ maxWidth: 1100 }}>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Rodzaj systemu</label>
            <select className="form-select" value={form.systemType} onChange={e => setForm({ ...form, systemType: e.target.value as any })}>
              <option value="PV – Dach">PV – Dach</option>
              <option value="PV – Grunt">PV – Grunt</option>
              <option value="Falownik + Magazyn">Falownik + Magazyn</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Zestaw PV</label>
            <select className="form-select" value={form.pvSet} onChange={e => setForm({ ...form, pvSet: e.target.value })}>
              <option value="">— wybierz —</option>
              {pvOptions.map(k => (<option key={k} value={k}>{k}</option>))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Magazyn energii</label>
            <select className="form-select" value={form.battery} onChange={e => setForm({ ...form, battery: e.target.value })}>
              <option value="">— wybierz —</option>
              {batteryOptions.map(k => (<option key={k} value={k}>{k}</option>))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Model falownika</label>
            <select className="form-select" value={form.inverter} onChange={e => setForm({ ...form, inverter: e.target.value })}>
              <option value="">— wybierz —</option>
              {inverterOptions.map(k => (<option key={k} value={k}>{k}</option>))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Backup</label>
            <select className="form-select" value={form.backup} onChange={e => setForm({ ...form, backup: e.target.value as any })}>
              <option value="Nie">Nie</option>
              <option value="Tak">Tak</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Przekop</label>
            <select className="form-select" value={form.trench} onChange={e => setForm({ ...form, trench: e.target.value as any })}>
              <option value="Nie">Nie</option>
              <option value="Tak">Tak</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Dotacja</label>
            <select className="form-select" value={form.grant} onChange={e => setForm({ ...form, grant: e.target.value })}>
              {grantOptions.map(g => (<option key={g.label} value={g.label}>{g.label} ({g.value.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })})</option>))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Wkład własny (PLN)</label>
            <input className="form-input" type="number" min={0} value={form.downPayment} onChange={e => setForm({ ...form, downPayment: Number(e.target.value || 0) })} />
          </div>
          <div className="form-group">
            <label className="form-label">Okres kredytu (miesiące)</label>
            <input className="form-input" type="number" min={1} value={form.termMonths} onChange={e => setForm({ ...form, termMonths: Math.max(1, Number(e.target.value || 1)) })} />
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="card" style={{ border: '1px solid var(--gray-200)' }}>
            <h3 style={{ marginTop: 0 }}>Podsumowanie (netto)</h3>
            <div className="list">
              <div className="list-row"><span>Zestaw PV</span><span>{calc.pvBase.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span></div>
              {form.systemType === 'PV – Grunt' && (
                <div className="list-row"><span>Dopłata za grunt</span><span>{calc.pvGroundExtra.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span></div>
              )}
              {form.systemType === 'Falownik + Magazyn' && (
                <div className="list-row"><span>Falownik</span><span>{calc.inverterPrice.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span></div>
              )}
              {form.battery && (
                <div className="list-row"><span>Magazyn energii</span><span>{calc.batteryPrice.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span></div>
              )}
              {form.backup === 'Tak' && (
                <div className="list-row"><span>Backup</span><span>{calc.backupPrice.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span></div>
              )}
              {form.trench === 'Tak' && (
                <div className="list-row"><span>Przekop</span><span>{calc.trenchPrice.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span></div>
              )}
              <div className="list-row" style={{ fontWeight: 600 }}><span>Suma netto</span><span>{calc.subtotalNet.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span></div>
              <div className="list-row"><span>Dotacja</span><span>- {calc.grant.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span></div>
              <div className="list-row"><span>Wkład własny</span><span>- {form.downPayment.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span></div>
              <div className="list-row" style={{ fontWeight: 600 }}><span>Kwota finansowana</span><span>{calc.financed.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span></div>
            </div>
          </div>
          <div className="card" style={{ border: '1px solid var(--gray-200)' }}>
            <h3 style={{ marginTop: 0 }}>Finansowanie</h3>
            <p className="muted" style={{ marginBottom: 8 }}>RRSO rocznie: {(calc.rrsoYear * 100).toFixed(2)}%</p>
            <div className="list">
              <div className="list-row" style={{ fontWeight: 600 }}><span>Rata miesięczna</span><span>{Math.abs(calc.monthly).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span></div>
              <div className="list-row"><span>Okres (mies.)</span><span>{form.termMonths}</span></div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}


