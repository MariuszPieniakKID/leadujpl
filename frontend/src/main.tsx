import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { startOfflineSync } from './lib/offline'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register/force-update service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      // Actively check for a new SW right after registration
      try { await reg.update() } catch {}
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        regs.forEach(r => { try { r.update() } catch {} })
      } catch {}
      setTimeout(() => { try { reg.update() } catch {} }, 2000)
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      }
      if (reg.installing) {
        reg.installing.addEventListener('statechange', () => {
          if (reg.installing?.state === 'installed') {
            reg.waiting?.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      }
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })

      // Setup push notifications after service worker is ready
      setupPushNotifications(reg)
    } catch {}
  })
}

// Start simple offline sync for queued writes
startOfflineSync()

// iOS swipe-back mitigation: prevent browser back on horizontal pan inside app shell
window.addEventListener('touchstart', (e) => {
  try {
    const target = e.target as HTMLElement
    const withinInteractive = target.closest('input,textarea,select,button,.modal-content,.calendar-container')
    if (withinInteractive) {
      // Mark to prevent passive default back swipe behavior
      ;(e as any)._preventNav = true
    }
  } catch {}
}, { passive: true })

window.addEventListener('touchmove', (e) => {
  try {
    // If started in interactive region and the gesture is horizontal near screen edge, prevent navigation back
    const anyE: any = e
    if (anyE._preventNav) {
      // Do not block when interacting with calendar grid
      const target = e.target as HTMLElement
      const inCalendar = target.closest('.rbc-calendar, .calendar-shell')
      if (inCalendar) return
      e.preventDefault()
    }
  } catch {}
}, { passive: false })

// Setup push notifications
async function setupPushNotifications(registration: ServiceWorkerRegistration) {
  try {
    // Only setup service worker, don't automatically subscribe
    // Users will subscribe when they interact with the push notification button
    if (registration.active) {
      console.log('Push notification service worker ready');
    }
  } catch (error) {
    console.error('Failed to setup push notifications:', error);
  }
}
