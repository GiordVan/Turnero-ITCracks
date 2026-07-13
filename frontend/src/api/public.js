import apiClient from './client';

export const getPublicConfig = () => apiClient.get('/public/config');
export const getProfessionals = () => apiClient.get('/public/professionals');
export const getAvailableSlots = (date, professionalId) =>
  apiClient.get('/public/available-slots', { params: { date, professionalId } });
export const createTurn = (data) => apiClient.post('/public/turns', data);
export const getMyTurns = (email) =>
  apiClient.get('/public/my-turns', { params: { email } });
// El token de gestión (devuelto al crear el turno) reemplaza al email como
// autorización para cancelar/pagar.
export const cancelTurn = (id, token) => apiClient.patch(`/public/turns/${id}/cancel`, { token });
export const createDeposit = (turnId, token) => apiClient.post(`/public/turns/${turnId}/deposit`, { token });
export const confirmDeposit = (paymentId, token) => apiClient.post(`/public/deposits/${paymentId}/confirm`, { token });
