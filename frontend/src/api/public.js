import apiClient from './client';

export const getPublicConfig = () => apiClient.get('/public/config');
export const getAvailableSlots = (date) =>
  apiClient.get('/public/available-slots', { params: { date } });
export const createTurn = (data) => apiClient.post('/public/turns', data);
export const getMyTurns = (email) =>
  apiClient.get('/public/my-turns', { params: { email } });
export const cancelTurn = (id) => apiClient.patch(`/public/turns/${id}/cancel`);
