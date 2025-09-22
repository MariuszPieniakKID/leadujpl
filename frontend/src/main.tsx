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

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(() => {})
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
      e.preventDefault()
    }
  } catch {}
}, { passive: false })
