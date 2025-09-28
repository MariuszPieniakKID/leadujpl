import axios from 'axios';
import { getToken } from './auth';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/',
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for better error logging (only in development)
if (import.meta.env.DEV) {
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      console.error('API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      return Promise.reject(error);
    }
  );
}

// Also add a global interceptor for default axios (in case some modules use it directly)
axios.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

export type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  company?: string;
  notes?: string;
  status: string;
  ownerId: string;
  teamId?: string | null;
};

export async function fetchLeads(params?: { userId?: string; teamId?: string }) {
  const res = await api.get<Lead[]>('/api/leads', { params });
  return res.data;
}

export async function createLead(payload: Omit<Lead, 'id' | 'status'> & { status?: string }) {
  const res = await api.post<Lead>('/api/leads', payload);
  return res.data;
}

export type Client = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  category?: string | null;
  pvInstalled?: boolean | null;
  pvPower?: number | null;
  billRange?: string | null;
  extraComments?: string | null;
};

export async function fetchClients(params?: { q?: string; status?: string; scope?: 'team' | 'mine'; managerId?: string }) {
  const res = await api.get<Client[]>('/api/clients', { params });
  return res.data;
}

export async function createClient(payload: Omit<Client, 'id'>) {
  const res = await api.post<Client>('/api/clients', payload);
  return res.data;
}

export async function updateClient(id: string, payload: Partial<Omit<Client, 'id'>>) {
  const res = await api.patch<Client>(`/api/clients/${id}`, payload);
  return res.data;
}

export async function deleteClient(id: string) {
  const res = await api.delete<{ ok: true }>(`/api/clients/${id}`);
  return res.data;
}

// Client latest meeting status helpers
export async function getClientLatestStatus(clientId: string): Promise<{ meetingId: string | null; status: string | null }> {
  const res = await api.get(`/api/clients/${clientId}/status`)
  return res.data
}

export async function setClientLatestStatus(clientId: string, status: 'Umowa' | 'Sukces' | 'Porażka' | 'Dogrywka' | 'Przełożone' | 'Umówione' | 'Odbyte'): Promise<{ meetingId: string | null; status: string | null }> {
  const res = await api.patch(`/api/clients/${clientId}/status`, { status })
  return res.data
}

// Attachments
export async function uploadAttachments(meetingId: string, clientId: string, files: File[]) {
  const form = new FormData()
  form.append('meetingId', meetingId)
  form.append('clientId', clientId)
  for (const f of files) form.append('files', f)
  const res = await api.post(`/api/attachments/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return res.data as { count: number }
}

export type AttachmentItem = { id: string; fileName: string; mimeType: string; createdAt: string; meetingId?: string; category?: string | null }

export async function listMeetingAttachments(meetingId: string): Promise<AttachmentItem[]> {
  const res = await api.get(`/api/attachments/meeting/${meetingId}`)
  return res.data
}

export async function listClientAttachments(clientId: string): Promise<AttachmentItem[]> {
  const res = await api.get(`/api/attachments/client/${clientId}`)
  return res.data
}

export function viewAttachmentUrl(attachmentId: string): string {
  const token = getToken()
  const base = import.meta.env.VITE_API_BASE || ''
  return `${base}/api/attachments/${attachmentId}/view${token ? `?token=${encodeURIComponent(token)}` : ''}`
}

export function downloadAttachmentUrl(attachmentId: string): string {
  const token = getToken()
  const base = import.meta.env.VITE_API_BASE || ''
  return `${base}/api/attachments/${attachmentId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`
}

export async function deleteAttachment(attachmentId: string): Promise<{ ok: true }> {
  const res = await api.delete(`/api/attachments/${attachmentId}`)
  return res.data
}

// Offers
export async function generateOfferPDF(snapshot: any): Promise<Blob> {
  const res = await api.post(`/api/offers/generate`, snapshot, { responseType: 'blob' })
  return res.data as Blob
}

export async function saveOfferForClient(clientId: string, fileName: string | undefined, snapshot: any, meetingId?: string, offerId?: string): Promise<{ id: string; fileName: string }> {
  const res = await api.post(`/api/offers/save`, { clientId, fileName, snapshot, ...(meetingId ? { meetingId } : {}), ...(offerId ? { offerId } : {}) })
  return res.data
}

export async function listClientOffers(clientId: string): Promise<Array<{ id: string; fileName: string; createdAt: string; meetingId?: string }>> {
  const res = await api.get(`/api/offers/client/${clientId}`)
  return res.data
}

export async function listMeetingOffers(meetingId: string): Promise<Array<{ id: string; fileName: string; createdAt: string }>> {
  const res = await api.get(`/api/offers/meeting/${meetingId}`)
  return res.data
}

export function downloadOffer(offerId: string): string {
  const token = getToken()
  const base = import.meta.env.VITE_API_BASE || ''
  return `${base}/api/offers/${offerId}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`
}

export function viewOffer(offerId: string): string {
  const token = getToken()
  const base = import.meta.env.VITE_API_BASE || ''
  return `${base}/api/offers/${offerId}/view${token ? `?token=${encodeURIComponent(token)}` : ''}`
}

export async function fetchOffer(offerId: string): Promise<{ id: string; fileName: string; createdAt: string; snapshot: any; clientId: string; ownerId: string }>{
  const res = await api.get(`/api/offers/${offerId}`)
  return res.data
}

// Users
export type AppUserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'SALES_REP';
  managerId?: string | null;
}

export async function fetchUsers(): Promise<AppUserSummary[]> {
  const res = await api.get<AppUserSummary[]>('/api/users')
  return res.data
}

// Points
export async function fetchMyPoints(): Promise<{ total: number }> {
  const res = await api.get('/api/users/me/points')
  return res.data
}

export async function fetchPointsLeaderboard(params?: { managerId?: string }): Promise<Array<{ id: string; firstName: string; lastName: string; total: number }>> {
  const res = await api.get('/api/users/leaderboard/points', { params })
  return res.data
}


