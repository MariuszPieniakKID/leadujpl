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

  if (loading) {
    return (
      <div className="container">
        <div className="text-center py-8">Ładowanie...</div>
      </div>
    )
  }

  if (!client) {
    return null
  }

  return (
    <div className="container">
      <div className="page-header" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <Link to="/my-clients" className="secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', textDecoration: 'none' }}>
            ← Powrót do moich klientów
          </Link>
          <h1 className="page-title">{client.firstName} {client.lastName}</h1>
          <p className="text-gray-600">Szczegóły klienta</p>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-6)' }}>
        {/* Contact Info Card */}
        <div className="card">
          <h2 className="card-title">Dane kontaktowe</h2>
          <div className="list">
            <div className="list-row">
              <span>Telefon</span>
              <span>{client.phone ? <a href={`tel:${client.phone.replace(/\s|-/g,'')}`}>{client.phone}</a> : <span className="text-gray-400">—</span>}</span>
            </div>
            <div className="list-row">
              <span>E-mail</span>
              <span>{client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : <span className="text-gray-400">—</span>}</span>
            </div>
            <div className="list-row">
              <span>Adres</span>
              <span>{[client.street, client.city, client.postalCode].filter(Boolean).join(', ') || <span className="text-gray-400">—</span>}</span>
            </div>
            <div className="list-row">
              <span>Kategoria</span>
              <span>{client.category || <span className="text-gray-400">—</span>}</span>
            </div>
            <div className="list-row">
              <span>Status</span>
              <span>{latestStatus || <span className="text-gray-400">—</span>}</span>
            </div>
          </div>
        </div>

        {/* Offers Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 className="card-title" style={{ marginBottom: 0 }}>Oferty</h2>
            <button className="primary" onClick={() => {
              setShowCalc(s => !s)
              setCalcInitialSnapshot(null)
              setCalcKey('')
            }}>
              {showCalc ? 'Ukryj kalkulator' : '➕ Dodaj ofertę'}
            </button>
          </div>
          
          {showCalc && (
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <EmbeddedCalculator
                key={calcKey}
                clientId={id!}
                initialSnapshot={calcInitialSnapshot || undefined}
                onSaved={async () => {
                  setShowCalc(false)
                  setCalcInitialSnapshot(null)
                  try { const offs = await listClientOffers(id!); setOffers(offs) } catch {}
                }}
              />
            </div>
          )}
          
          {offers.length === 0 ? (
            <div className="text-center py-4 text-gray-500">Brak ofert</div>
          ) : (
            <div className="list">
              {offers.map(o => (
                <div key={o.id} className="list-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>{o.fileName}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--gray-600)' }}>{new Date(o.createdAt).toLocaleDateString('pl-PL')}</div>
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
          )}
        </div>

        {/* Attachments Card */}
        <div className="card">
          <h2 className="card-title">Załączniki</h2>
          {attachments.length === 0 ? (
            <div className="text-center py-4 text-gray-500">Brak załączników</div>
          ) : (
            <div className="list">
              {attachments.map(a => (
                <div key={a.id} className="list-row">
                  <span>{a.fileName}</span>
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
  )
}

