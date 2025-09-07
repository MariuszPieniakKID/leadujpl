import { useEffect, useMemo, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isStandalone(): boolean {
  // iOS Safari
  const iosStandalone = (window as any).navigator?.standalone === true
  // All browsers
  const displayModeStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
  return iosStandalone || displayModeStandalone
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const platform = useMemo(() => {
    if (isIOS()) return 'ios'
    return 'android'
  }, [])

  useEffect(() => {
    if (isStandalone()) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      ;(window as any).__deferredBeforeInstallPrompt = e as BeforeInstallPromptEvent
      setVisible(true)
    }
    // @ts-ignore: beforeinstallprompt is not fully typed
    window.addEventListener('beforeinstallprompt', handler)
    
    const manualShow = async () => {
      if (isStandalone()) return
      // Android prompt available
      const dp = (window as any).__deferredBeforeInstallPrompt as BeforeInstallPromptEvent | undefined
      if (dp) {
        try {
          await dp.prompt()
          await dp.userChoice
          setVisible(false)
          setDeferredPrompt(null)
          ;(window as any).__deferredBeforeInstallPrompt = undefined
          return
        } catch {}
      }
      // Fallback: show banner (or iOS tip)
      setVisible(true)
    }
    window.addEventListener('show-install-prompt', manualShow as EventListener)
    return () => {
      // @ts-ignore
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('show-install-prompt', manualShow as EventListener)
    }
  }, [])

  useEffect(() => {
    // For iOS, show hint if not installed and not dismissed
    if (platform === 'ios' && !isStandalone() && !dismissed) {
      setVisible(true)
    }
  }, [platform, dismissed])

  if (!visible || isStandalone()) return null

  const close = () => setVisible(false)

  async function onInstallClick() {
    if (!deferredPrompt) return
    try {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') setVisible(false)
      setDeferredPrompt(null)
    } catch {
      // silently ignore
    }
  }

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000,
      padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center',
      background: 'rgba(11,18,32,0.98)', color: 'white', borderTop: '1px solid rgba(255,255,255,0.1)'
    }}>
      {platform === 'android' && deferredPrompt ? (
        <>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Zainstaluj aplikację</div>
            <div style={{ opacity: 0.9, fontSize: 13 }}>Dostęp offline i pełny ekran</div>
          </div>
          <button onClick={onInstallClick} className="primary" style={{ padding: '8px 12px' }}>Zainstaluj</button>
          <button onClick={close} className="ghost" aria-label="Zamknij" style={{ padding: 8 }}>
            ✕
          </button>
        </>
      ) : (
        <>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Dodaj do ekranu głównego</div>
            <div style={{ opacity: 0.9, fontSize: 13 }}>W Safari stuknij Udostępnij, potem „Dodaj do ekranu początkowego”.</div>
          </div>
          <button onClick={() => { setDismissed(true); close() }} className="ghost" aria-label="Zamknij" style={{ padding: 8 }}>
            Rozumiem
          </button>
        </>
      )}
    </div>
  )
}


