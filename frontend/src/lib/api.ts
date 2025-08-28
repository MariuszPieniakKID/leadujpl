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


