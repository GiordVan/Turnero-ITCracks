import apiClient from './client';

export const getPublicConfig = () => apiClient.get('/public/config');
export const getProfessionals = () => apiClient.get('/public/professionals');
export const getAvailableSlots = (date, professionalId) =>
  apiClient.get('/public/available-slots', { params: { date, professionalId } });
export const createTurn = (data) => apiClient.post('/public/turns', data);
export const getMyTurns = (email) =>
  apiClient.get('/public/my-turns', { params: { email } });
export const cancelTurn = (id, email) => apiClient.patch(`/public/turns/${id}/cancel`, { email });
export const createDeposit = (turnId, email) => apiClient.post(`/public/turns/${turnId}/deposit`, { email });
export const confirmDeposit = (paymentId, email) => apiClient.post(`/public/deposits/${paymentId}/confirm`, { email });
