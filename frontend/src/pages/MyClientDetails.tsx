import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import api, { type Client, listClientOffers, listClientAttachments, downloadOffer, fetchOffer, type AttachmentItem, viewAttachmentUrl, downloadAttachmentUrl, getClientLatestStatus } from '../lib/api'
import EmbeddedCalculator from '../components/EmbeddedCalculator'

export default function MyClientDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [client, setClient] = useState<Client | null>(null)
  const [loading, setLoading] = useState(true)
  const [offers, setOffers] = useState<Array<{ id: string; fileName: string; createdAt: string }>>([])
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [showCalc, setShowCalc] = useState(false)
  const [calcInitialSnapshot, setCalcInitialSnapshot] = useState<any | null>(null)
  const [calcKey, setCalcKey] = useState<string>('')
  const [latestStatus, setLatestStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      navigate('/my-clients')
      return
    }
    loadClient()
  }, [id])

  async function loadClient() {
    try {
      setLoading(true)
      const res = await api.get<Client>(`/api/clients/${id}`)
      setClient(res.data)
      
      // Load offers
      try {
        const offs = await listClientOffers(id!)
        setOffers(offs)
      } catch {}
      
      // Load attachments
      try {
        const atts = await listClientAttachments(id!)
        setAttachments(atts)
      } catch {}
      
      // Load latest status
      try {
        const statusRes = await getClientLatestStatus(id!)
        setLatestStatus(statusRes.status || null)
      } catch {}
    } catch (e) {
      console.error(e)
      navigate('/my-clients')
    } finally {
      setLoading(false)
    }
  }

  async function loadOffers() {
    try {
      const offs = await listClientOffers(id!)
      setOffers(offs)
    } catch {}
  }

  if (loading) {
    return (
      <div className="app-wrapper">
        <div className="app-content">
          <div className="container">
            <div className="loading">Ładowanie...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!client) {
    return null
  }

  return (
    <div className="app-wrapper">
      <div className="app-content">
        <div className="container">
          <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
            <div>
              <Link to="/my-clients" className="secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                ← Powrót do moich klientów
              </Link>
              <h1 className="page-title">{client.firstName} {client.lastName}</h1>
              <p className="page-subtitle">Szczegóły klienta</p>
            </div>
          </div>

          <div className="grid grid-cols-1" style={{ gap: 'var(--space-6)' }}>
            {/* Contact Info Card */}
            <div className="card">
              <h2 className="card-title">📞 Dane kontaktowe</h2>
              <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--gray-200)' }}>
                  <span className="text-gray-600">Telefon</span>
                  <span className="font-semibold">{client.phone ? <a href={`tel:${client.phone.replace(/\s|-/g,'')}`} className="text-primary-600">{client.phone}</a> : <span className="text-gray-400">—</span>}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--gray-200)' }}>
                  <span className="text-gray-600">E-mail</span>
                  <span className="font-semibold">{client.email ? <a href={`mailto:${client.email}`} className="text-primary-600">{client.email}</a> : <span className="text-gray-400">—</span>}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--gray-200)' }}>
                  <span className="text-gray-600">Adres</span>
                  <span className="font-semibold">{[client.street, client.city, (client as any).postalCode].filter(Boolean).join(', ') || <span className="text-gray-400">—</span>}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--gray-200)' }}>
                  <span className="text-gray-600">Kategoria</span>
                  <span className="font-semibold">{client.category || <span className="text-gray-400">—</span>}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-gray-600">Status</span>
                  <span className="font-semibold">{latestStatus || <span className="text-gray-400">—</span>}</span>
                </div>
              </div>
            </div>

            {/* Offers Card */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showCalc ? 'var(--space-6)' : 0 }}>
                <h2 className="card-title" style={{ marginBottom: 0 }}>📄 Oferty</h2>
                <button className="primary" onClick={() => {
                  setShowCalc(s => !s)
                  setCalcInitialSnapshot(null)
                  setCalcKey('')
                }}>
                  {showCalc ? 'Ukryj' : '➕ Dodaj ofertę'}
                </button>
              </div>
              
              {showCalc && (
                <div style={{ marginTop: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                  <EmbeddedCalculator
                    key={calcKey}
                    clientId={id!}
                    initialSnapshot={calcInitialSnapshot || undefined}
                    onSaved={async () => {
                      setShowCalc(false)
                      setCalcInitialSnapshot(null)
                      await loadOffers()
                    }}
                  />
                </div>
              )}
              
              {!showCalc && (
                offers.length === 0 ? (
                  <div className="empty-state" style={{ padding: 'var(--space-8) var(--space-4)' }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                    <div className="empty-state-title">Brak ofert</div>
                    <div className="empty-state-text">Kliknij "Dodaj ofertę" aby utworzyć pierwszą</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                    {offers.map(o => (
                      <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4)', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)' }}>
                        <div>
                          <div className="font-semibold">{o.fileName}</div>
                          <div className="text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString('pl-PL')}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                          <a href={downloadOffer(o.id)} target="_blank" rel="noreferrer" className="btn-sm secondary">Pobierz</a>
                          <button className="btn-sm secondary" onClick={async () => {
                            try {
                              const meta = await fetchOffer(o.id)
                              setCalcInitialSnapshot(meta.snapshot)
                              setCalcKey(o.id)
                              setShowCalc(true)
                            } catch {}
                          }}>Edytuj</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>

            {/* Attachments Card */}
            <div className="card">
              <h2 className="card-title">📎 Załączniki</h2>
              {attachments.length === 0 ? (
                <div className="empty-state" style={{ padding: 'var(--space-8) var(--space-4)' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  <div className="empty-state-title">Brak załączników</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  {attachments.map(a => (
                    <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3)', background: 'var(--gray-50)', borderRadius: 'var(--radius-lg)' }}>
                      <span className="font-medium truncate" style={{ flex: 1 }}>{a.fileName}</span>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <a href={viewAttachmentUrl(a.id)} target="_blank" rel="noreferrer" className="btn-sm secondary">Zobacz</a>
                        <a href={downloadAttachmentUrl(a.id)} download className="btn-sm secondary">Pobierz</a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
