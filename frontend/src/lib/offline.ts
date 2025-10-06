import { getToken } from './auth'

export type PendingRequest = {
  id: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  body?: any
  headers?: Record<string, string>
  createdAt: number
  entityStore?: 'clients' | 'meetings'
  localId?: string
}

type StoreName = 'clients' | 'meetings' | 'offers' | 'attachments' | 'pending'

const DB_NAME = 'leaduj_offline'
const DB_VERSION = 2

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onerror = () => reject(req.error)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('clients')) db.createObjectStore('clients', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('meetings')) db.createObjectStore('meetings', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('offers')) db.createObjectStore('offers', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('attachments')) db.createObjectStore('attachments', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('pending')) db.createObjectStore('pending', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('attachments_cache')) db.createObjectStore('attachments_cache', { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
  })
}

async function withStore<T>(name: StoreName, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(name, mode)
    const store = tx.objectStore(name)
    Promise.resolve(fn(store)).then((res) => {
      tx.oncomplete = () => resolve(res)
      tx.onerror = () => reject(tx.error)
    }).catch(reject)
  })
}

export const offlineStore = {
  put: async (store: StoreName, value: any) => withStore(store, 'readwrite', s => new Promise((resolve, reject) => {
    const r = s.put(value); r.onsuccess = () => resolve(true as any); r.onerror = () => reject(r.error)
  })),
  get: async <T=any>(store: StoreName, id: string) => withStore(store, 'readonly', s => new Promise<T | undefined>((resolve, reject) => {
    const r = s.get(id); r.onsuccess = () => resolve(r.result as T | undefined); r.onerror = () => reject(r.error)
  })),
  getAll: async <T=any>(store: StoreName) => withStore(store, 'readonly', s => new Promise<T[]>((resolve, reject) => {
    const r = s.getAll(); r.onsuccess = () => resolve(r.result as T[]); r.onerror = () => reject(r.error)
  })),
  delete: async (store: StoreName, id: string) => withStore(store, 'readwrite', s => new Promise((resolve, reject) => {
    const r = s.delete(id); r.onsuccess = () => resolve(true as any); r.onerror = () => reject(r.error)
  })),
  clear: async (store: StoreName) => withStore(store, 'readwrite', s => new Promise((resolve, reject) => {
    const r = s.clear(); r.onsuccess = () => resolve(true as any); r.onerror = () => reject(r.error)
  })),
}

export const pendingQueue = {
  enqueue: async (req: PendingRequest) => offlineStore.put('pending', req),
  list: async (): Promise<PendingRequest[]> => offlineStore.getAll('pending'),
  remove: async (id: string) => offlineStore.delete('pending', id),
}

export function newLocalId(prefix: 'client' | 'meeting' | 'offer' | 'att') {
  return `local-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

async function sendRequest(pr: PendingRequest): Promise<Response> {
  const token = getToken()
  const res = await fetch(pr.url, {
    method: pr.method,
    headers: { 'Content-Type': 'application/json', ...(pr.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: pr.body ? JSON.stringify(pr.body) : undefined,
  })
  return res
}

export async function processQueue() {
  try {
    const items = await pendingQueue.list()
    
    // Sort by creation time (oldest first)
    items.sort((a, b) => a.createdAt - b.createdAt)
    
    let successCount = 0
    let failCount = 0
    
    for (const pr of items) {
      try {
        // Check if item is too old (more than 24 hours)
        const ageHours = (Date.now() - pr.createdAt) / (1000 * 60 * 60)
        if (ageHours > 24) {
          console.warn('[Sync] Removing expired request:', pr.id, 'age:', ageHours.toFixed(1), 'hours')
          await pendingQueue.remove(pr.id)
          continue
        }
        
        console.log('[Sync] Processing request:', { id: pr.id, method: pr.method, url: pr.url, localId: pr.localId })
        
        const res = await sendRequest(pr)
        console.log('[Sync] Response:', { id: pr.id, status: res.status, ok: res.ok })
        
        if (res.ok) {
          // Success - remove from queue and delete local placeholder
          console.log('[Sync] Success! Removing local data:', pr.localId)
          if (pr.entityStore && pr.localId) {
            try { await offlineStore.delete(pr.entityStore, pr.localId) } catch (e) {
              console.error('[Sync] Failed to delete local entity:', e)
            }
          }
          await pendingQueue.remove(pr.id)
          successCount++
        } else if (res.status === 409 || res.status === 400) {
          // Conflict or bad request - likely duplicate, remove from queue
          const errorText = await res.text().catch(() => '')
          console.warn('[Sync] Removing conflicting/invalid request:', pr.id, 'status:', res.status, 'error:', errorText)
          if (pr.entityStore && pr.localId) {
            try { await offlineStore.delete(pr.entityStore, pr.localId) } catch {}
          }
          await pendingQueue.remove(pr.id)
        } else {
          // Server error, keep in queue for retry
          const errorText = await res.text().catch(() => '')
          console.error('[Sync] Server error, will retry:', pr.id, 'status:', res.status, 'error:', errorText)
          failCount++
        }
      } catch (err) {
        // Network error, keep in queue for retry
        console.error('[Sync] Network error, will retry:', pr.id, 'error:', err)
        failCount++
      }
    }
    
    await processUploads()
    
    try { localStorage.setItem('offline_last_sync', String(Date.now())) } catch {}
    try { 
      window.dispatchEvent(new CustomEvent('offline-sync-complete', { 
        detail: { successCount, failCount, totalProcessed: items.length } 
      })) 
    } catch {}
    
    console.log('Sync complete:', { successCount, failCount, total: items.length })
  } catch (err) {
    console.error('Error processing queue:', err)
  }
}

let syncListenerAttached = false
export function startOfflineSync() {
  if (syncListenerAttached) return
  syncListenerAttached = true
  if (typeof window !== 'undefined') {
    // Listen for online event
    window.addEventListener('online', () => { 
      console.log('Network online, processing queue...')
      processQueue().catch(() => {}) 
    })
    
    // Try once on startup
    setTimeout(() => { processQueue().catch(() => {}) }, 1000)
    
    // Periodic sync every 5 minutes when online
    setInterval(() => {
      if (navigator.onLine) {
        processQueue().catch(() => {})
      }
    }, 5 * 60 * 1000)
    
    // Register Background Sync if available (works even when tab is closed)
    if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        // Trigger background sync when network becomes available
        window.addEventListener('online', () => {
          registration.sync.register('sync-pending-requests').catch(err => {
            console.warn('Background sync registration failed:', err)
          })
        })
        
        // Also trigger on visibility change (when user returns to tab)
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden && navigator.onLine) {
            processQueue().catch(() => {})
          }
        })
      }).catch(err => {
        console.warn('Service Worker not ready for background sync:', err)
      })
    }
    
    // Listen for sync messages from service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_PENDING_REQUESTS') {
          console.log('Received sync trigger from service worker')
          processQueue().catch(() => {})
        }
      })
    }
  }
}

// Binary uploads (attachments, offers) processing when online
export async function processUploads() {
  const token = getToken()
  const base = (import.meta as any).env?.VITE_API_BASE || ''
  // Attachments
  try {
    const atts = await offlineStore.getAll<any>('attachments')
    for (const a of atts) {
      if (a.uploaded) continue
      const form = new FormData()
      form.append('meetingId', a.meetingId)
      form.append('clientId', a.clientId)
      if (a.category) form.append('category', a.category)
      const blob: Blob = a.data
      form.append('files', blob, a.fileName)
      const res = await fetch(`${base}/api/attachments/upload`, { method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: form })
      if (res.ok) {
        await offlineStore.delete('attachments', a.id)
      }
    }
  } catch {}
  // Offers
  try {
    const offers = await offlineStore.getAll<any>('offers')
    for (const o of offers) {
      if (o.uploaded) continue
      const res = await fetch(`${base}/api/offers/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clientId: o.clientId, fileName: o.fileName, snapshot: o.snapshot, ...(o.meetingId ? { meetingId: o.meetingId } : {}), ...(o.offerId ? { offerId: o.offerId } : {}) })
      })
      if (res.ok) {
        await offlineStore.delete('offers', o.id)
      }
    }
  } catch {}
}

export async function getPendingCount(): Promise<number> {
  try { const items = await pendingQueue.list(); return items?.length || 0 } catch { return 0 }
}
