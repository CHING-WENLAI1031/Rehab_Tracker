import apiClient from './axios';

export const authAPI = {
  // Login
  login: async (email, password) => {
    return await apiClient.post('/auth/login', { email, password });
  },

  // Register
  register: async (userData) => {
    return await apiClient.post('/auth/register', userData);
  },

  // Get current user
  getCurrentUser: async () => {
    return await apiClient.get('/auth/me');
  },

  // Logout
  logout: async () => {
    return await apiClient.post('/auth/logout');
  },

  // Refresh token
  refreshToken: async () => {
    return await apiClient.post('/auth/refresh');
  },
};

export default authAPI;
