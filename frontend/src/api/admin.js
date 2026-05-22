import apiClient from './client';

// Config
export const getConfig = () => apiClient.get('/admin/config');
export const updateConfig = (data) => apiClient.put('/admin/config', data);

// Work bands
export const getWorkBands = () => apiClient.get('/admin/work-bands');
export const createWorkBand = (data) => apiClient.post('/admin/work-bands', data);
export const updateWorkBand = (id, data) => apiClient.put(`/admin/work-bands/${id}`, data);
export const deleteWorkBand = (id) => apiClient.delete(`/admin/work-bands/${id}`);

// Turns
export const getDailyTurns = (date) =>
  apiClient.get('/admin/turns', { params: { date } });
