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
    for (const pr of items) {
      try {
        const res = await sendRequest(pr)
        if (res.ok) {
          // If entity created, drop local placeholder
          if (pr.entityStore && pr.localId) {
            try { await offlineStore.delete(pr.entityStore, pr.localId) } catch {}
          }
          await pendingQueue.remove(pr.id)
        }
      } catch {
        // keep in queue
      }
    }
    await processUploads()
    try { localStorage.setItem('offline_last_sync', String(Date.now())) } catch {}
    try { window.dispatchEvent(new CustomEvent('offline-sync-complete')) } catch {}
  } catch {}
}

let syncListenerAttached = false
export function startOfflineSync() {
  if (syncListenerAttached) return
  syncListenerAttached = true
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { processQueue().catch(() => {}) })
    // Try once on startup
    setTimeout(() => { processQueue().catch(() => {}) }, 1000)
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
