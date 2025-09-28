import { useEffect, useMemo, useState } from 'react'
import baseData from '../data/calculatorData.json'
import api, { generateOfferPDF, saveOfferForClient } from '../lib/api'
import { offlineStore, newLocalId } from '../lib/offline'
import { getUser } from '../lib/auth'

export default function EmbeddedCalculator({ clientId, meetingId, offerId, onSaved, initialSnapshot, onSavedSnapshot }: { clientId: string; meetingId?: string; offerId?: string; onSaved?: () => void; initialSnapshot?: { form?: any; calc?: any }; onSavedSnapshot?: (snapshot: any) => void }) {
  const [remoteData, setRemoteData] = useState<any | null>(null)
  const data = useMemo(() => remoteData || (baseData as any), [remoteData])
  const user = getUser()

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/calculator/config')
        setRemoteData(res.data)
      } catch {
        setRemoteData(null)
      }
    })()
  }, [])

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

  // Quick PV power calculator (embedded)
  const [quickCalc, setQuickCalc] = useState<{ monthlyKwh: string; margin: number; yieldPerKwp: number }>({ monthlyKwh: '', margin: 1.2, yieldPerKwp: 1000 })
  const quickKwp = useMemo(() => {
    const mkwh = Number(String(quickCalc.monthlyKwh).replace(',', '.'))
    const margin = Number(quickCalc.margin || 0)
    const yieldPer = Number(quickCalc.yieldPerKwp || 0)
    if (!(mkwh > 0 && margin > 0 && yieldPer > 0)) return null as number | null
    return (mkwh * 12 * margin) / yieldPer
  }, [quickCalc])

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
    const subtotalPlain = pvBase + pvGroundExtra + inverterPrice + batteryPrice + backupPrice + trenchPrice

    // Apply manager margin to subtotal (net price)
    let subtotalNet = subtotalPlain
    try {
      const margins = (data as any).settings?.margins || {}
      const managerId = user?.managerId || null
      const m = managerId ? margins[managerId] : null
      if (m) {
        const amount = Number(m.amount || 0)
        const percent = Number(m.percent || 0)
        const uplift = (percent > 0) ? (subtotalNet * (percent / 100)) : amount
        subtotalNet = Math.max(subtotalNet + Math.max(uplift, 0), 0)
      }
    } catch {}

    // Apply sales personal margin from localStorage (if present)
    try {
      if (user && user.role === 'SALES_REP') {
        const raw = localStorage.getItem('salesMargin')
        if (raw) {
          const sm = JSON.parse(raw)
          const amount = Number(sm.amount || 0)
          const percent = Number(sm.percent || 0)
          const uplift = (percent > 0) ? (subtotalNet * (percent / 100)) : amount
          subtotalNet = Math.max(subtotalNet + Math.max(uplift, 0), 0)
        }
      }
    } catch {}

    const grant = (grantOptions.find(g => g.label === form.grant)?.value) || 0
    const totalAfterGrant = Math.max(subtotalNet - grant, 0)
    const financed = Math.max(totalAfterGrant - (form.downPayment || 0), 0)

    const rrsoYear = Number(settings['RRSO (rocznie)'] || 0.1)
    const rateMonthly = rrsoYear / 12
    let monthly = pmt(rateMonthly, form.termMonths, financed)

    // Manager margin for assigned sales reps: apply on final numbers
    try {
      const margins = (data as any).settings?.margins || {}
      const managerId = user?.managerId || null
      const m = managerId ? margins[managerId] : null
      if (m) {
        const amount = Number(m.amount || 0)
        const percent = Number(m.percent || 0)
        const base = financed
        const uplift = (percent > 0) ? (base * (percent / 100)) : amount
        const newFinanced = Math.max(base + Math.max(uplift, 0), 0)
        monthly = pmt(rateMonthly, form.termMonths, newFinanced)
      }
    } catch {}

    // Prepare alternative terms (12..240 months)
    const terms: number[] = Array.from({ length: 10 }, (_, i) => (i + 1) * 12)
    const otherTerms = terms
      .filter(t => t !== form.termMonths)
      .map(t => ({ term: t, monthly: pmt(rateMonthly, t, financed) }))

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
      otherTerms,
    }
  }, [form, prices, settings, grantOptions, data, user])

  useEffect(() => {
    if (initialSnapshot && initialSnapshot.form) {
      const f = initialSnapshot.form
      setForm(prev => ({
        ...prev,
        systemType: f.systemType || prev.systemType,
        pvSet: f.pvSet || '',
        battery: f.battery || '',
        inverter: f.inverter || '',
        backup: f.backup || prev.backup,
        trench: f.trench || prev.trench,
        grant: f.grant || prev.grant,
        downPayment: f.downPayment != null ? Number(f.downPayment) : prev.downPayment,
        termMonths: f.termMonths != null ? Number(f.termMonths) : prev.termMonths,
      }))
    }
  }, [initialSnapshot])

  async function onGeneratePDF() {
    const snapshot: any = { form, calc }
    if (quickKwp && quickKwp > 0) {
      snapshot.quickCalc = {
        monthlyKwh: Number(String(quickCalc.monthlyKwh).replace(',', '.')),
        margin: Number(quickCalc.margin || 0),
        yieldPerKwp: Number(quickCalc.yieldPerKwp || 0),
        resultKwp: quickKwp,
      }
    }
    const blob = await generateOfferPDF(snapshot)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'oferta.pdf'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onSave() {
    const snapshot: any = { form, calc }
    if (quickKwp && quickKwp > 0) {
      snapshot.quickCalc = {
        monthlyKwh: Number(String(quickCalc.monthlyKwh).replace(',', '.')),
        margin: Number(quickCalc.margin || 0),
        yieldPerKwp: Number(quickCalc.yieldPerKwp || 0),
        resultKwp: quickKwp,
      }
    }
    if (onSavedSnapshot) {
      onSavedSnapshot(snapshot)
      return
    }
    if (navigator.onLine) {
      await saveOfferForClient(clientId, undefined, snapshot, meetingId, offerId)
    } else {
      const id = newLocalId('offer')
      await offlineStore.put('offers', { id, clientId, fileName: 'oferta.pdf', snapshot, meetingId, uploaded: false })
    }
    onSaved && onSaved()
  }

  return (
    <div className="card" style={{ border: '1px solid var(--gray-200)', marginTop: 8 }}>
      <div className="card" style={{ border: '1px solid var(--gray-200)', marginBottom: 8 }}>
        <h3 style={{ marginTop: 0 }}>Kalkulator mocy PV</h3>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Średnie miesięczne zużycie (kWh)</label>
            <input className="form-input" inputMode="decimal" value={quickCalc.monthlyKwh} onChange={e => setQuickCalc({ ...quickCalc, monthlyKwh: e.target.value })} placeholder="np. 400" />
          </div>
          <div className="form-group">
            <label className="form-label">Margines bezpieczeństwa</label>
            <input className="form-input" type="number" step="0.01" value={quickCalc.margin} onChange={e => setQuickCalc({ ...quickCalc, margin: Number(e.target.value || 0) })} />
          </div>
          <div className="form-group">
            <label className="form-label">Roczna produkcja z 1 kWp (kWh)</label>
            <input className="form-input" type="number" step="1" value={quickCalc.yieldPerKwp} onChange={e => setQuickCalc({ ...quickCalc, yieldPerKwp: Number(e.target.value || 0) })} />
          </div>
        </div>
        <div className="list" style={{ marginTop: 6 }}>
          <div className="list-row" style={{ fontWeight: 600 }}>
            <span>Szacowana moc instalacji</span>
            <span>{quickKwp && quickKwp > 0 ? `${quickKwp.toFixed(2)} kWp` : '—'}</span>
          </div>
        </div>
      </div>
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
          <div className="list">
            <div className="list-row" style={{ fontWeight: 600 }}><span>Rata miesięczna</span><span>{Math.abs(calc.monthly).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span></div>
            <div className="list-row"><span>Okres (mies.)</span><span>{form.termMonths}</span></div>
          </div>
          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: '8px 0' }}>Pozostałe możliwości</h4>
            <div className="list">
              {calc.otherTerms.map((it: any) => (
                <div className="list-row" key={it.term}>
                  <span>{it.term} mies. ({it.term / 12} lat)</span>
                  <span>{Math.abs(it.monthly).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
        <button className="secondary" onClick={onSave}>{onSavedSnapshot ? 'Dodaj do spotkania' : 'Zapisz do klienta'}</button>
        <button className="primary" onClick={onGeneratePDF}>Generuj PDF</button>
      </div>
    </div>
  )
}


