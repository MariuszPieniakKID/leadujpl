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
  category?: string | null;
  pvInstalled?: boolean | null;
  billRange?: string | null;
  extraComments?: string | null;
};

export async function fetchClients() {
  const res = await api.get<Client[]>('/api/clients');
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


