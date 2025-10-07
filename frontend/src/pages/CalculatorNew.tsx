import { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { generateOfferPDF, saveOfferForClient, type Client } from '../lib/api'
import api from '../lib/api'
import { getUser } from '../lib/auth'
import baseData from '../data/calculatorData.json'

// Pricing data from PDF
const pricingData: Record<number, { modules: number; basePrice: number; groundWork: number }> = {
  3.51: { modules: 6, basePrice: 16315.05, groundWork: 1698.50 },
  4.095: { modules: 7, basePrice: 18615.05, groundWork: 1698.50 },
  4.68: { modules: 8, basePrice: 20257.26, groundWork: 1655.25 },
  5.265: { modules: 9, basePrice: 27130.79, groundWork: 1837.88 },
  5.85: { modules: 10, basePrice: 28772.99, groundWork: 1794.76 },
  6.435: { modules: 11, basePrice: 29812.55, groundWork: 1913.99 },
  7.02: { modules: 12, basePrice: 31655.76, groundWork: 1751.51 },
  7.605: { modules: 13, basePrice: 32795.32, groundWork: 1870.74 },
  8.19: { modules: 14, basePrice: 34638.53, groundWork: 1708.26 },
  8.775: { modules: 15, basePrice: 35778.09, groundWork: 1827.49 },
  9.36: { modules: 16, basePrice: 37621.30, groundWork: 1665.01 },
  9.945: { modules: 17, basePrice: 38760.86, groundWork: 1784.24 },
  10.53: { modules: 18, basePrice: 40604.07, groundWork: 1621.76 },
  11.115: { modules: 19, basePrice: 41743.63, groundWork: 1740.99 },
  11.7: { modules: 20, basePrice: 43586.84, groundWork: 1578.51 },
  12.285: { modules: 21, basePrice: 44726.40, groundWork: 1697.74 },
  12.87: { modules: 22, basePrice: 46569.61, groundWork: 1535.26 },
  13.455: { modules: 23, basePrice: 47709.17, groundWork: 1654.49 },
  14.04: { modules: 24, basePrice: 49552.38, groundWork: 1492.01 },
  14.625: { modules: 25, basePrice: 50691.94, groundWork: 1611.24 },
  15.21: { modules: 26, basePrice: 52535.15, groundWork: 1448.76 },
  15.795: { modules: 27, basePrice: 53674.71, groundWork: 1567.99 },
  16.38: { modules: 28, basePrice: 55517.92, groundWork: 1405.51 },
  16.965: { modules: 29, basePrice: 56657.48, groundWork: 1524.74 },
  17.55: { modules: 30, basePrice: 58500.69, groundWork: 1362.26 },
  18.135: { modules: 31, basePrice: 59640.25, groundWork: 1481.49 },
  18.72: { modules: 32, basePrice: 61483.46, groundWork: 1319.01 },
  19.305: { modules: 33, basePrice: 62623.02, groundWork: 1438.24 },
  19.89: { modules: 34, basePrice: 64466.23, groundWork: 1275.76 }
}

// Inverter prices
const inverterPrices: Record<string, number> = {
  'SUN-3.6K-SG03LP1 1FAZ': 8497.08,
  'SUN-5K-SG04LP3': 13778.58,
  'SUN-6K-SG04LP3': 13970.54,
  'SUN-8K-SG04LP3': 14162.48,
  'SUN-10K-SG04LP3': 14552.96,
  'SUN-12K-SG04LP3': 14943.46,
  'SUN-15K-SG01HP3': 15330.64,
  'SUN-20K-SG01HP3': 15717.82,
  'SUN-25K-SG01HP3': 16882.67,
  'SUN-30K-SG01HP3': 25427.11
}

// Storage prices
const storagePrices: Record<string, number> = {
  '5 kWh': 7892.28,
  '10 kWh': 14186.67,
  '15 kWh': 19386.76,
  '20 kWh': 24586.67,
  '25 kWh': 30859.85,
  '30 kWh': 38773.33,
  '35 kWh': 43783.33,
  '40 kWh': 49173.33
}

export default function CalculatorNewPage() {
  const user = getUser()
  
  // Load config from backend (marże)
  const [remoteData, setRemoteData] = useState<any | null>(null)
  const data = useMemo(() => remoteData || (baseData as any), [remoteData])
  const settings = (data as any).settings || {}
  
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
  
  // State
  const [selectedProduct, setSelectedProduct] = useState<'pv_me' | 'inverter_me' | null>(null)
  const [installationType, setInstallationType] = useState<'roof' | 'ground' | null>(null)
  const [selectedPower, setSelectedPower] = useState<number | null>(null)
  const [selectedInverter, setSelectedInverter] = useState<string>('SUN-5K-SG04LP3')
  const [selectedStorage, setSelectedStorage] = useState<string>('5 kWh')
  const [turbineEnabled, setTurbineEnabled] = useState(false)
  const [excavationEnabled, setExcavationEnabled] = useState(false)
  const [excavationMeters, setExcavationMeters] = useState(1)
  const [backupEnabled, setBackupEnabled] = useState(false)
  const [grantEnabled, setGrantEnabled] = useState(false)
  const [vatRate, setVatRate] = useState<8 | 23>(8)
  const [ownContribution, setOwnContribution] = useState(0)
  const [extraItems, setExtraItems] = useState<Array<{ label: string; amount: number }>>([])
  
  // Personal sales margin (only for SALES_REP)
  function getSalesMargin() {
    try {
      const raw = localStorage.getItem('salesMargin')
      if (!raw) return { amount: 0, percent: 0 }
      const parsed = JSON.parse(raw)
      return { amount: Number(parsed.amount || 0), percent: Number(parsed.percent || 0) }
    } catch {
      return { amount: 0, percent: 0 }
    }
  }
  
  // Auto-fill date with today (YYYY-MM-DD format)
  const todayDate = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])
  
  // Client selection for saving offer
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientQuery, setClientQuery] = useState('')
  const [clientOptions, setClientOptions] = useState<Client[]>([])
  const [isSearchingClients, setIsSearchingClients] = useState(false)
  
  // New client creation
  const [showNewClientForm, setShowNewClientForm] = useState(false)
  const [newClientForm, setNewClientForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  })
  
  // Save offer state
  const [isSaving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  // Calculate prices
  const calculation = useMemo(() => {
    let subtotalPlain = 0
    const breakdown: Array<{ service: string; details: string; price: number }> = []
    
    if (selectedProduct === 'pv_me' && selectedPower && installationType) {
      const data = pricingData[selectedPower]
      subtotalPlain += data.basePrice
      
      const installationTypeText = installationType === 'roof' ? 'na dachu' : 'na gruncie'
      breakdown.push({
        service: 'Instalacja fotowoltaiczna',
        details: `${selectedPower} kW (${data.modules} modułów) - montaż ${installationTypeText}`,
        price: data.basePrice
      })
      
      if (installationType === 'ground') {
        subtotalPlain += data.groundWork
        breakdown.push({
          service: 'Prace ziemne',
          details: 'Przygotowanie gruntu pod instalację',
          price: data.groundWork
        })
      }
      
      // Inverter
      const inverterPrice = inverterPrices[selectedInverter]
      subtotalPlain += inverterPrice
      breakdown.push({
        service: 'Falownik Deye HYD',
        details: selectedInverter,
        price: inverterPrice
      })
      
      // Storage
      const storagePrice = storagePrices[selectedStorage]
      subtotalPlain += storagePrice
      breakdown.push({
        service: 'Magazyn energii',
        details: selectedStorage,
        price: storagePrice
      })
    } else if (selectedProduct === 'inverter_me') {
      // Inverter
      const inverterPrice = inverterPrices[selectedInverter]
      subtotalPlain += inverterPrice
      breakdown.push({
        service: 'Wymiana falownika',
        details: selectedInverter,
        price: inverterPrice
      })
      
      // Storage
      const storagePrice = storagePrices[selectedStorage]
      subtotalPlain += storagePrice
      breakdown.push({
        service: 'Magazyn energii',
        details: selectedStorage,
        price: storagePrice
      })
    }
    
    // Turbine
    if (turbineEnabled) {
      subtotalPlain += 30000
      breakdown.push({
        service: 'Turbina wiatrowa',
        details: 'XALTUS 6kW',
        price: 30000
      })
    }
    
    // Excavation
    if (excavationEnabled) {
      const excavationPrice = 500 + (excavationMeters * 30)
      subtotalPlain += excavationPrice
      breakdown.push({
        service: 'Przekop',
        details: `Koparka: 500 zł + ${excavationMeters} metrów × 30 zł/m`,
        price: excavationPrice
      })
    }
    
    // Backup
    if (backupEnabled) {
      subtotalPlain += 2500
      breakdown.push({
        service: 'Backup (zasilanie awaryjne)',
        details: 'System zasilania awaryjnego',
        price: 2500
      })
    }
    
    // Extra items
    for (const item of extraItems) {
      subtotalPlain += item.amount
      breakdown.push({
        service: item.label || 'Pozycja dodatkowa',
        details: 'Dodatkowa usługa',
        price: item.amount
      })
    }
    
    // Apply margins in order: Admin global → Manager → Sales Rep own
    let totalNet = subtotalPlain
    let marginAmount = 0
    
    try {
      const margins = settings?.margins || {}
      
      // 1. Admin global margin (applies to everyone)
      const adminMargin = settings.adminMargin
      if (adminMargin) {
        const amount = Number(adminMargin.amount || 0)
        const percent = Number(adminMargin.percent || 0)
        const uplift = (percent > 0) ? (totalNet * (percent / 100)) : amount
        if (uplift > 0) {
          totalNet = Math.max(totalNet + uplift, 0)
          marginAmount += uplift
        }
      }
      
      // 2. Manager margin (for SALES_REP assigned to manager, or for MANAGER themselves)
      if (user?.role === 'SALES_REP') {
        // For sales rep: use their manager's margin
        const managerId = user?.managerId || null
        const m = managerId ? margins[managerId] : null
        if (m) {
          const amount = Number(m.amount || 0)
          const percent = Number(m.percent || 0)
          const uplift = (percent > 0) ? (totalNet * (percent / 100)) : amount
          if (uplift > 0) {
            totalNet = Math.max(totalNet + uplift, 0)
            marginAmount += uplift
          }
        }
      } else if (user?.role === 'MANAGER') {
        // For manager: use their own margin
        const m = margins[user.id] || null
        if (m) {
          const amount = Number(m.amount || 0)
          const percent = Number(m.percent || 0)
          const uplift = (percent > 0) ? (totalNet * (percent / 100)) : amount
          if (uplift > 0) {
            totalNet = Math.max(totalNet + uplift, 0)
            marginAmount += uplift
          }
        }
      }
    } catch {}
    
    // 3. Sales rep's personal margin (only for SALES_REP)
    if (user && user.role === 'SALES_REP') {
      const sm = getSalesMargin()
      if (sm) {
        const amount = Number(sm.amount || 0)
        const percent = Number(sm.percent || 0)
        const uplift = (percent > 0) ? (totalNet * (percent / 100)) : amount
        if (uplift > 0) {
          totalNet = Math.max(totalNet + uplift, 0)
          marginAmount += uplift
        }
      }
    }
    
    // Show margin in breakdown if it exists
    if (marginAmount > 0) {
      breakdown.push({
        service: 'Marża',
        details: 'Marża handlowa',
        price: marginAmount
      })
    }
    
    // Grant
    const grantAmount = grantEnabled ? 47000 : 0
    if (grantEnabled) {
      breakdown.push({
        service: 'Dotacja "Moja Elektrownia Wiatrowa"',
        details: 'Dofinansowanie z programu rządowego',
        price: -grantAmount
      })
      totalNet -= grantAmount
    }
    
    const vat = totalNet * (vatRate / 100)
    const totalGross = totalNet + vat
    
    // Price before grant
    let priceBeforeGrant = totalGross
    if (grantEnabled) {
      priceBeforeGrant = totalGross + (grantAmount * (1 + vatRate / 100))
    }
    
    return {
      breakdown,
      totalNet,
      vat,
      totalGross,
      priceBeforeGrant
    }
  }, [selectedProduct, selectedPower, installationType, selectedInverter, selectedStorage, turbineEnabled, excavationEnabled, excavationMeters, backupEnabled, vatRate, grantEnabled, extraItems, user, settings])
  
  // Calculate financing
  const financing = useMemo(() => {
    const loanTerms = [12, 24, 36, 48, 60, 72, 84, 96, 108, 120]
    const annualRate = 0.1272
    const monthlyRate = annualRate / 12
    
    return loanTerms.map(months => {
      // Before grant
      let loanAmountBefore = calculation.priceBeforeGrant - ownContribution
      if (loanAmountBefore < 0) loanAmountBefore = 0
      let monthlyPaymentBefore = 0
      if (loanAmountBefore > 0) {
        monthlyPaymentBefore = loanAmountBefore * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
      }
      
      // After grant
      let loanAmountAfter = calculation.totalGross - ownContribution
      if (loanAmountAfter < 0) loanAmountAfter = 0
      let monthlyPaymentAfter = 0
      if (loanAmountAfter > 0) {
        monthlyPaymentAfter = loanAmountAfter * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)
      }
      
      return {
        months,
        before: monthlyPaymentBefore,
        after: monthlyPaymentAfter
      }
    })
  }, [calculation, ownContribution])
  
  // Energy production
  const energyProduction = useMemo(() => {
    if (selectedProduct === 'pv_me' && selectedPower) {
      const pvProduction = Math.round(selectedPower * 1000)
      const turbineProduction = turbineEnabled ? Math.round(6000 * 0.633) : 0
      const totalProduction = pvProduction + turbineProduction
      const savings = Math.round(totalProduction * 0.65)
      return { pvProduction, turbineProduction, totalProduction, savings }
    }
    return null
  }, [selectedProduct, selectedPower, turbineEnabled])
  
  const resetCalculator = () => {
    setSelectedProduct(null)
    setInstallationType(null)
    setSelectedPower(null)
    setSelectedInverter('SUN-5K-SG04LP3')
    setSelectedStorage('5 kWh')
    setTurbineEnabled(false)
    setExcavationEnabled(false)
    setExcavationMeters(1)
    setBackupEnabled(false)
    setGrantEnabled(false)
    setVatRate(8)
    setOwnContribution(0)
    setExtraItems([])
    setSelectedClient(null)
    setClientQuery('')
    setSaveMessage(null)
  }
  
  // Search for clients
  const searchClients = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setClientOptions([])
      return
    }
    setIsSearchingClients(true)
    try {
      const res = await api.get<Client[]>('/api/clients', { params: { search: query.trim() } })
      setClientOptions(res.data.slice(0, 10))
    } catch {
      setClientOptions([])
    } finally {
      setIsSearchingClients(false)
    }
  }
  
  // Generate snapshot for backend
  const generateSnapshot = () => {
    // Map to old calculator format for backend compatibility
    let systemType = 'PV – Dach'
    if (selectedProduct === 'inverter_me') systemType = 'Falownik + Magazyn'
    else if (installationType === 'ground') systemType = 'PV – Grunt'
    
    const data = selectedPower && selectedProduct === 'pv_me' ? pricingData[selectedPower] : null
    const pvSetLabel = data ? `${selectedPower} kW (${data.modules} modułów)` : ''
    
    const form = {
      systemType,
      pvSet: pvSetLabel,
      battery: selectedStorage,
      inverter: selectedInverter,
      backup: (backupEnabled ? 'Tak' : 'Nie') as 'Tak' | 'Nie',
      trench: (excavationEnabled ? 'Tak' : 'Nie') as 'Tak' | 'Nie',
      grant: grantEnabled ? 'Dotacja MEW (47 000 zł)' : 'Brak dotacji',
      downPayment: ownContribution,
      termMonths: 120,
      vatRate,
      extraItems,
    }
    
    const calc = {
      pvBase: selectedProduct === 'pv_me' && selectedPower ? pricingData[selectedPower].basePrice : 0,
      pvGroundExtra: selectedProduct === 'pv_me' && installationType === 'ground' && selectedPower ? pricingData[selectedPower].groundWork : 0,
      inverterPrice: inverterPrices[selectedInverter] || 0,
      batteryPrice: storagePrices[selectedStorage] || 0,
      backupPrice: backupEnabled ? 2500 : 0,
      trenchPrice: excavationEnabled ? (500 + excavationMeters * 30) : 0,
      subtotalNet: calculation.totalNet,
      grant: grantEnabled ? 47000 : 0,
      financed: calculation.totalGross - ownContribution,
      rrsoYear: 0.1272,
      monthly: financing[financing.length - 1]?.after || 0,
      otherTerms: financing.map(f => ({ term: f.months, monthly: f.after })),
    }
    
    const clientName = selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : (newClientForm.firstName && newClientForm.lastName ? `${newClientForm.firstName} ${newClientForm.lastName}` : '')
    const clientDate = todayDate
    
    return { form, calc, clientName, clientDate, turbineEnabled, excavationMeters }
  }
  
  // Download PDF
  const handleDownloadPDF = async () => {
    try {
      const snapshot = generateSnapshot()
      const clientName = selectedClient ? `${selectedClient.firstName}-${selectedClient.lastName}` : (newClientForm.firstName && newClientForm.lastName ? `${newClientForm.firstName}-${newClientForm.lastName}` : 'kalkulator')
      const blob = await generateOfferPDF(snapshot)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `oferta-${clientName}-${new Date().getTime()}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSaveMessage({ type: 'success', text: '✅ PDF pobrano pomyślnie!' })
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (e) {
      console.error(e)
      setSaveMessage({ type: 'error', text: '❌ Błąd podczas generowania PDF' })
      setTimeout(() => setSaveMessage(null), 3000)
    }
  }
  
  // Create new client
  const handleCreateNewClient = async () => {
    if (!newClientForm.firstName || !newClientForm.lastName) {
      setSaveMessage({ type: 'error', text: '❌ Imię i nazwisko są wymagane' })
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }
    
    setSaving(true)
    try {
      // Create new client
      const res = await api.post<Client>('/api/clients', newClientForm)
      const createdClient = res.data
      
      // Save offer for the newly created client
      const snapshot = generateSnapshot()
      const fileName = `oferta-${createdClient.firstName}-${createdClient.lastName}-${new Date().getTime()}.pdf`
      await saveOfferForClient(createdClient.id, fileName, snapshot)
      
      setSaveMessage({ type: 'success', text: `✅ Utworzono klienta ${createdClient.firstName} ${createdClient.lastName} i zapisano ofertę` })
      
      // Reset form
      setNewClientForm({ firstName: '', lastName: '', phone: '', email: '' })
      setShowNewClientForm(false)
      
      setTimeout(() => setSaveMessage(null), 5000)
    } catch (e: any) {
      console.error(e)
      setSaveMessage({ type: 'error', text: `❌ ${e?.response?.data?.error || 'Błąd podczas tworzenia klienta'}` })
      setTimeout(() => setSaveMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }
  
  // Save offer for existing client
  const handleSaveOffer = async () => {
    if (!selectedClient) {
      setSaveMessage({ type: 'error', text: '❌ Wybierz klienta z listy' })
      setTimeout(() => setSaveMessage(null), 3000)
      return
    }
    
    setSaving(true)
    try {
      const snapshot = generateSnapshot()
      const fileName = `oferta-${selectedClient.firstName}-${selectedClient.lastName}-${new Date().getTime()}.pdf`
      await saveOfferForClient(selectedClient.id, fileName, snapshot)
      setSaveMessage({ type: 'success', text: `✅ Oferta zapisana dla ${selectedClient.firstName} ${selectedClient.lastName}` })
      setTimeout(() => setSaveMessage(null), 5000)
    } catch (e) {
      console.error(e)
      setSaveMessage({ type: 'error', text: '❌ Błąd podczas zapisywania oferty' })
      setTimeout(() => setSaveMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <div className="container">
      <div className="page-header">
        <div>
          <h1 className="page-title">⚡ ATOMIC Kalkulator</h1>
          <p className="page-subtitle">Instalacje Fotowoltaiczne i Wiatrowe</p>
        </div>
        {user && user.role === 'SALES_REP' && (
          <SalesMarginButton />
        )}
      </div>
      
      {/* Product Selection */}
      <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <h2 className="card-title">☀️ Wybór Produktu</h2>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
          Rodzaj Instalacji
        </h3>
        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <button
            className={selectedProduct === 'pv_me' ? 'primary' : 'secondary'}
            onClick={() => setSelectedProduct('pv_me')}
            style={{ textAlign: 'left', padding: 'var(--space-4)', height: 'auto' }}
          >
            <div style={{ fontWeight: 600 }}>☀️ PV + Magazyn Energii</div>
            <div style={{ fontSize: 'var(--text-sm)', opacity: 0.8, marginTop: 'var(--space-1)' }}>
              Kompletna instalacja fotowoltaiczna z magazynem
            </div>
          </button>
          <button
            className={selectedProduct === 'inverter_me' ? 'primary' : 'secondary'}
            onClick={() => setSelectedProduct('inverter_me')}
            style={{ textAlign: 'left', padding: 'var(--space-4)', height: 'auto' }}
          >
            <div style={{ fontWeight: 600 }}>🔄 Wymiana Falownika + Magazyn Energii</div>
            <div style={{ fontSize: 'var(--text-sm)', opacity: 0.8, marginTop: 'var(--space-1)' }}>
              Wymiana istniejącego falownika + dodanie magazynu
            </div>
          </button>
        </div>
        
        {/* Installation Type (only for PV+ME) */}
        {selectedProduct === 'pv_me' && (
          <div style={{ marginTop: 'var(--space-8)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
              Typ Instalacji PV
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <button
                className={installationType === 'roof' ? 'primary' : 'secondary'}
                onClick={() => setInstallationType('roof')}
              >
                🏠 Na Dachu
              </button>
              <button
                className={installationType === 'ground' ? 'primary' : 'secondary'}
                onClick={() => setInstallationType('ground')}
              >
                🌱 Na Gruncie
              </button>
            </div>
          </div>
        )}
        
        {/* Power Selection (only for PV+ME) */}
        {selectedProduct === 'pv_me' && installationType && (
          <div style={{ marginTop: 'var(--space-8)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
              Moc Instalacji
            </h3>
            <div className="form-group">
              <select 
                value={selectedPower || ''} 
                onChange={e => setSelectedPower(e.target.value ? parseFloat(e.target.value) : null)}
              >
                <option value="">Wybierz moc instalacji...</option>
                {Object.entries(pricingData).map(([power, data]) => (
                  <option key={power} value={power}>
                    {power} kW ({data.modules} modułów)
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </section>
      
      {/* Inverter & Storage */}
      {selectedProduct && (
        <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
            <div className="form-group">
              <label className="form-label">⚡ Falownik Deye HYD</label>
              <select value={selectedInverter} onChange={e => setSelectedInverter(e.target.value)}>
                {Object.keys(inverterPrices).map(inv => (
                  <option key={inv} value={inv}>{inv}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">🔋 Magazyn Energii</label>
              <select value={selectedStorage} onChange={e => setSelectedStorage(e.target.value)}>
                {Object.keys(storagePrices).map(storage => (
                  <option key={storage} value={storage}>{storage}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
      )}
      
      {/* Additional Options */}
      {selectedProduct && (
        <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="card-title">🔧 Dodatkowe Opcje</h2>
          
          {/* Turbine */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>💨 Turbina Wiatrowa XALTUS 6kW</strong>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)', marginTop: 'var(--space-1)' }}>
                  Cena: 30 000 zł {turbineEnabled && '✓ Automatycznie aktywuje dotację'}
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={turbineEnabled} 
                onChange={e => setTurbineEnabled(e.target.checked)} 
              />
            </div>
          </div>
          
          {/* Excavation */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Przekop (500 zł + 30 zł/m)</strong>
              </div>
              <input 
                type="checkbox" 
                checked={excavationEnabled} 
                onChange={e => setExcavationEnabled(e.target.checked)} 
              />
            </div>
            {excavationEnabled && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <input 
                  type="number" 
                  min="1" 
                  value={excavationMeters} 
                  onChange={e => setExcavationMeters(parseInt(e.target.value) || 1)}
                  placeholder="Ilość metrów"
                />
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)', marginTop: 'var(--space-1)' }}>
                  Koparka: 500 zł + metry × 30 zł
                </div>
              </div>
            )}
          </div>
          
          {/* Backup */}
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Backup (+2500 zł)</strong>
              </div>
              <input 
                type="checkbox" 
                checked={backupEnabled} 
                onChange={e => setBackupEnabled(e.target.checked)} 
              />
            </div>
          </div>
          
          {/* Extra Items */}
          <div style={{ marginBottom: 'var(--space-6)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--gray-200)' }}>
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
              📋 Dodatkowe Pozycje
            </h3>
            
            {extraItems.length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                {extraItems.map((item, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: 'var(--space-3)',
                    marginBottom: 'var(--space-2)',
                    background: 'var(--gray-50)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--gray-200)'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.label || 'Pozycja'}</div>
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)' }}>
                        {item.amount.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                      </div>
                    </div>
                    <button 
                      className="btn-sm secondary" 
                      onClick={() => setExtraItems(extraItems.filter((_, i) => i !== idx))}
                      style={{ minWidth: '80px' }}
                    >
                      🗑️ Usuń
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 'var(--space-3)', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Nazwa pozycji</label>
                <input 
                  type="text" 
                  id="extraLabel"
                  placeholder="np. Dodatkowe okablowanie"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Kwota (netto)</label>
                <input 
                  type="number" 
                  id="extraAmount"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
              <button 
                className="primary" 
                onClick={() => {
                  const labelInput = document.getElementById('extraLabel') as HTMLInputElement
                  const amountInput = document.getElementById('extraAmount') as HTMLInputElement
                  const label = labelInput?.value || ''
                  const amount = parseFloat(amountInput?.value || '0')
                  if (label || amount > 0) {
                    setExtraItems([...extraItems, { label: label || 'Pozycja', amount: isNaN(amount) ? 0 : amount }])
                    if (labelInput) labelInput.value = ''
                    if (amountInput) amountInput.value = ''
                  }
                }}
                style={{ minWidth: '120px', height: '48px' }}
              >
                ➕ Dodaj
              </button>
            </div>
          </div>
          
        </section>
      )}
      
      {/* VAT Rate */}
      {selectedProduct && (
        <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="card-title">📊 Stawka VAT</h2>
          <div className="form-group">
            <select value={vatRate} onChange={e => setVatRate(parseInt(e.target.value) as 8 | 23)}>
              <option value={8}>8% VAT</option>
              <option value={23}>23% VAT</option>
            </select>
          </div>
        </section>
      )}
      
      {/* Price Summary & Financing */}
      {selectedProduct && calculation.totalNet > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          {/* Price Summary */}
          <section className="card">
            <h2 className="card-title">📊 Podsumowanie Ceny</h2>
            
            {/* Breakdown */}
            <div style={{ marginBottom: 'var(--space-6)' }}>
              {calculation.breakdown.map((item, idx) => (
                <div key={idx} style={{ marginBottom: 'var(--space-3)', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--gray-200)' }}>
                  <div style={{ fontWeight: 600 }}>{item.service}</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)' }}>{item.details}</div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginTop: 'var(--space-1)' }}>
                    {item.price.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                  </div>
                </div>
              ))}
            </div>
            
            {/* Totals */}
            <div style={{ paddingTop: 'var(--space-4)', borderTop: '2px solid var(--gray-300)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                <span style={{ fontWeight: 700 }}>Cena netto:</span>
                <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
                  {calculation.totalNet.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)', fontSize: 'var(--text-sm)' }}>
                <span>VAT ({vatRate}%):</span>
                <span>{calculation.vat.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--gray-200)' }}>
                <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Cena brutto:</span>
                <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 900, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {calculation.totalGross.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł
                </span>
              </div>
            </div>
            
            {/* Energy Production */}
            {energyProduction && (
              <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--info-50)', borderRadius: 'var(--radius-xl)' }}>
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                  📊 Szacunkowa produkcja energii
                </h4>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--info-700)' }}>
                  <div>Panele PV: ~{energyProduction.pvProduction.toLocaleString('pl-PL')} kWh/rok</div>
                  {energyProduction.turbineProduction > 0 && (
                    <div>Turbina: ~{energyProduction.turbineProduction.toLocaleString('pl-PL')} kWh/rok</div>
                  )}
                  <div style={{ fontWeight: 600, marginTop: 'var(--space-2)' }}>
                    Łącznie: ~{energyProduction.totalProduction.toLocaleString('pl-PL')} kWh/rok
                  </div>
                  <div>Roczne oszczędności: ~{energyProduction.savings.toLocaleString('pl-PL')} zł</div>
                </div>
              </div>
            )}
            
            <button className="secondary" onClick={resetCalculator} style={{ width: '100%', marginTop: 'var(--space-6)' }}>
              🔄 Wyczyść Kalkulator
            </button>
          </section>
          
          {/* Financing */}
          <section className="card">
            <h2 className="card-title">💰 Wycena i Finansowanie</h2>
            
            {/* Grant */}
            <div style={{ marginBottom: 'var(--space-6)', padding: 'var(--space-4)', background: 'var(--warning-50)', borderRadius: 'var(--radius-xl)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <strong>🏛️ Dotacja "Moja Elektrownia Wiatrowa"</strong>
                <input 
                  type="checkbox" 
                  checked={grantEnabled} 
                  onChange={e => setGrantEnabled(e.target.checked)} 
                />
              </div>
              
              {grantEnabled && (
                <div style={{ fontSize: 'var(--text-sm)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <span>Cena przed dotacją:</span>
                    <span style={{ fontWeight: 600 }}>
                      {calculation.priceBeforeGrant.toLocaleString('pl-PL', { minimumFractionDigits: 0 })} zł
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <span>Kwota dotacji:</span>
                    <span style={{ fontWeight: 600, color: 'var(--success-600)' }}>-47 000 zł</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--warning-200)' }}>
                    <span style={{ fontWeight: 700 }}>Cena po dotacji:</span>
                    <span style={{ fontWeight: 700, color: 'var(--success-700)' }}>
                      {calculation.totalGross.toLocaleString('pl-PL', { minimumFractionDigits: 0 })} zł
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Own Contribution */}
            <div className="form-group">
              <label className="form-label">Wkład własny (zł)</label>
              <input 
                type="number" 
                min="0" 
                step="1000" 
                value={ownContribution || ''} 
                onChange={e => setOwnContribution(parseInt(e.target.value) || 0)}
                placeholder="0 zł"
              />
            </div>
            
            {/* Loan Table */}
            <div style={{ marginTop: 'var(--space-6)' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)', textAlign: 'center' }}>
                📊 Symulacja rat kredytowych (RRSO 12,72%)
              </h3>
              <div style={{ background: 'var(--white)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--gray-200)' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Okres</th>
                      <th style={{ textAlign: 'center' }}>Przed dotacją</th>
                      <th style={{ textAlign: 'center' }}>Po dotacji</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financing.map(item => (
                      <tr key={item.months}>
                        <td>{item.months} miesięcy</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>
                          {item.before.toLocaleString('pl-PL', { minimumFractionDigits: 0 })} zł
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--success-600)' }}>
                          {item.after.toLocaleString('pl-PL', { minimumFractionDigits: 0 })} zł
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)', textAlign: 'center', marginTop: 'var(--space-3)' }}>
                💡 Wszystkie kwoty to miesięczne raty
              </div>
            </div>
          </section>
        </div>
      )}
      
      {/* Save Offer Section */}
      {selectedProduct && calculation.totalNet > 0 && (
        <section className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <h2 className="card-title">💾 Zapisz Ofertę</h2>
          
          {saveMessage && (
            <div style={{ 
              padding: 'var(--space-4)', 
              marginBottom: 'var(--space-6)', 
              borderRadius: 'var(--radius-xl)', 
              background: saveMessage.type === 'success' ? 'var(--success-50)' : 'var(--error-50)',
              color: saveMessage.type === 'success' ? 'var(--success-700)' : 'var(--error-700)',
              border: `1px solid ${saveMessage.type === 'success' ? 'var(--success-200)' : 'var(--error-200)'}`,
              fontWeight: 600
            }}>
              {saveMessage.text}
            </div>
          )}
          
          {/* Toggle between existing/new client */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <button 
              className={!showNewClientForm ? 'primary' : 'secondary'}
              onClick={() => {
                setShowNewClientForm(false)
                setNewClientForm({ firstName: '', lastName: '', phone: '', email: '' })
              }}
              disabled={isSaving}
              style={{ flex: 1 }}
            >
              📋 Wybierz istniejącego klienta
            </button>
            <button 
              className={showNewClientForm ? 'primary' : 'secondary'}
              onClick={() => {
                setShowNewClientForm(true)
                setSelectedClient(null)
                setClientQuery('')
              }}
              disabled={isSaving}
              style={{ flex: 1 }}
            >
              ➕ Utwórz nowego klienta
            </button>
          </div>
          
          {/* Existing Client Search */}
          {!showNewClientForm && (
            <div className="form-group">
              <label className="form-label">Wyszukaj klienta z bazy danych</label>
              <input 
                type="text" 
                value={clientQuery} 
                onChange={e => {
                  setClientQuery(e.target.value)
                  searchClients(e.target.value)
                  if (selectedClient) setSelectedClient(null)
                }}
                onFocus={() => clientQuery && searchClients(clientQuery)}
                placeholder="Szukaj po nazwisku, telefonie, email..."
                disabled={isSaving}
              />
              
              {/* Autocomplete dropdown */}
              {clientOptions.length > 0 && (
                <div className="autocomplete-dropdown">
                  {clientOptions.map(client => (
                    <div 
                      key={client.id}
                      className="autocomplete-item"
                      onClick={() => {
                        setSelectedClient(client)
                        setClientQuery(`${client.firstName} ${client.lastName}`)
                        setClientOptions([])
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{client.firstName} {client.lastName}</div>
                      {client.phone && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)' }}>{client.phone}</div>}
                    </div>
                  ))}
                </div>
              )}
              
              {isSearchingClients && (
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--gray-600)', marginTop: 'var(--space-2)' }}>
                  Szukam...
                </div>
              )}
              
              {selectedClient && (
                <div style={{ 
                  marginTop: 'var(--space-3)', 
                  padding: 'var(--space-3)', 
                  background: 'var(--primary-50)', 
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--primary-700)' }}>
                      ✓ Wybrany klient: {selectedClient.firstName} {selectedClient.lastName}
                    </div>
                    {selectedClient.phone && (
                      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--primary-600)' }}>{selectedClient.phone}</div>
                    )}
                  </div>
                  <button 
                    className="btn-sm secondary" 
                    onClick={() => {
                      setSelectedClient(null)
                      setClientQuery('')
                    }}
                    disabled={isSaving}
                  >
                    Zmień
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* New Client Form */}
          {showNewClientForm && (
            <div>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
                Dane nowego klienta
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div className="form-group">
                  <label className="form-label">Imię *</label>
                  <input 
                    type="text" 
                    value={newClientForm.firstName}
                    onChange={e => setNewClientForm({ ...newClientForm, firstName: e.target.value })}
                    placeholder="Imię klienta"
                    disabled={isSaving}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nazwisko *</label>
                  <input 
                    type="text" 
                    value={newClientForm.lastName}
                    onChange={e => setNewClientForm({ ...newClientForm, lastName: e.target.value })}
                    placeholder="Nazwisko klienta"
                    disabled={isSaving}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input 
                    type="tel" 
                    value={newClientForm.phone}
                    onChange={e => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                    placeholder="Numer telefonu"
                    disabled={isSaving}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input 
                    type="email" 
                    value={newClientForm.email}
                    onChange={e => setNewClientForm({ ...newClientForm, email: e.target.value })}
                    placeholder="Adres email"
                    disabled={isSaving}
                  />
                </div>
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)', marginTop: 'var(--space-2)' }}>
                * Pola wymagane
              </div>
            </div>
          )}
          
          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginTop: 'var(--space-6)' }}>
            {showNewClientForm ? (
              <button 
                className="primary" 
                onClick={handleCreateNewClient}
                disabled={isSaving || !newClientForm.firstName || !newClientForm.lastName}
              >
                {isSaving ? '⏳ Tworzę klienta...' : '➕ Utwórz klienta i zapisz ofertę'}
              </button>
            ) : (
              <button 
                className="primary" 
                onClick={handleSaveOffer}
                disabled={!selectedClient || isSaving}
              >
                {isSaving ? '⏳ Zapisuję...' : '💾 Zapisz ofertę dla klienta'}
              </button>
            )}
            <button 
              className="secondary" 
              onClick={handleDownloadPDF}
              disabled={isSaving}
            >
              📥 Pobierz PDF
            </button>
          </div>
          
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)', marginTop: 'var(--space-4)', textAlign: 'center' }}>
            {showNewClientForm 
              ? '💡 Nowy klient zostanie utworzony w systemie i od razu przypisana zostanie mu oferta'
              : '💡 Oferta zostanie zapisana w systemie i przypisana do wybranego klienta z bazy'
            }
          </div>
        </section>
      )}
    </div>
  )
}

function SalesMarginButton() {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState<string | number>(() => {
    try { const raw = localStorage.getItem('salesMargin'); const val = raw ? Number(JSON.parse(raw).amount || 0) : 0; return val || '' } catch { return '' }
  })
  const [percent, setPercent] = useState<string | number>(() => {
    try { const raw = localStorage.getItem('salesMargin'); const val = raw ? Number(JSON.parse(raw).percent || 0) : 0; return val || '' } catch { return '' }
  })
  const btnRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  function save() {
    const payload = { amount: Number(amount || 0), percent: Number(percent || 0) }
    localStorage.setItem('salesMargin', JSON.stringify(payload))
    setOpen(false)
  }
  function clear() {
    localStorage.removeItem('salesMargin')
    setAmount(''); setPercent('')
    setOpen(false)
  }
  function toggle() {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect()
      if (r) {
        const width = 280
        const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width))
        const top = r.bottom + 8
        setPos({ top, left })
      }
    }
    setOpen(o => !o)
  }
  // Close on outside click or ESC
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (!panelRef.current || panelRef.current.contains(t)) return
      if (btnRef.current && btnRef.current.contains(t)) return
      setOpen(false)
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onEsc)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onEsc) }
  }, [open])
  return (
    <>
      <button ref={btnRef} className="secondary" onClick={toggle}>💰 Moja marża</button>
      {open && pos && createPortal(
        <div className="card" ref={panelRef} style={{ position: 'fixed', top: pos.top, left: pos.left, width: 280, zIndex: 2147483647 }}>
          <div className="form-group">
            <label className="form-label">Stawka (PLN)</label>
            <input className="form-input" type="number" step="0.01" value={amount} onChange={e => { const val = e.target.value; setAmount(val === '' ? '' : Number(val)); if (Number(val||0) > 0) setPercent('') }} />
          </div>
          <div className="form-group">
            <label className="form-label">Procent (%)</label>
            <input className="form-input" type="number" step="0.01" value={percent} onChange={e => { const val = e.target.value; setPercent(val === '' ? '' : Number(val)); if (Number(val||0) > 0) setAmount('') }} />
          </div>
          <div className="flex items-center gap-2" style={{ justifyContent: 'flex-end' }}>
            <button className="secondary" onClick={clear}>Wyczyść</button>
            <button className="primary" onClick={save}>Zapisz</button>
          </div>
          <div className="text-gray-600 text-xs" style={{ marginTop: 8 }}>Ustaw jedną wartość. Obowiązuje tylko dla Twoich obliczeń.</div>
        </div>,
        document.body
      )}
    </>
  )
}

