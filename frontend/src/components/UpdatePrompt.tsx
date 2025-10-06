import { useEffect, useState } from 'react'

export default function UpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handleUpdate = (reg: ServiceWorkerRegistration) => {
      setRegistration(reg)
      setShowPrompt(true)
    }

    // Check for updates periodically (every 60 seconds)
    const interval = setInterval(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) {
          await reg.update()
        }
      } catch (err) {
        console.error('Update check failed:', err)
      }
    }, 60 * 1000)

    // Listen for new service worker
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // New service worker has taken control
      window.location.reload()
    })

    // Check if there's already a waiting worker
    navigator.serviceWorker.ready.then(reg => {
      if (reg.waiting) {
        handleUpdate(reg)
      }

      // Listen for new service worker installing
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              handleUpdate(reg)
            }
          })
        }
      })
    })

    return () => clearInterval(interval)
  }, [])

  const handleUpdate = () => {
    if (registration?.waiting) {
      // Tell the service worker to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      setShowPrompt(false)
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Show again in 1 hour
    setTimeout(() => setShowPrompt(true), 60 * 60 * 1000)
  }

  if (!showPrompt) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'var(--space-6)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 'var(--z-toast)',
        maxWidth: '90vw',
        width: '400px',
      }}
    >
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: 'var(--space-4)',
          boxShadow: 'var(--shadow-glass-xl)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
          </svg>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 700 }}>
              Nowa wersja dostępna
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', opacity: 0.9 }}>
              Kliknij "Aktualizuj", aby załadować najnowszą wersję aplikacji
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button
            className="secondary"
            onClick={handleDismiss}
            style={{ 
              flex: 1,
              background: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.3)',
            }}
          >
            Później
          </button>
          <button
            className="primary"
            onClick={handleUpdate}
            style={{ 
              flex: 1,
              background: 'white',
              color: '#667eea',
            }}
          >
            Aktualizuj teraz
          </button>
        </div>
      </div>
    </div>
  )
}

