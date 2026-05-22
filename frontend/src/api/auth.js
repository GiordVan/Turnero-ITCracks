import apiClient from './client';

export const login = (credentials) => apiClient.post('/auth/login', credentials);
export const getMe = () => apiClient.get('/auth/me');
