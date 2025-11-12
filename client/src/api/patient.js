import apiClient from './axios';

export const patientAPI = {
  // Dashboard
  getDashboard: async () => {
    return await apiClient.get('/patients/dashboard');
  },

  getDashboardOverview: async () => {
    return await apiClient.get('/patients/dashboard/overview');
  },

  getActiveTasks: async () => {
    return await apiClient.get('/patients/dashboard/active-tasks');
  },

  getRecentProgress: async () => {
    return await apiClient.get('/patients/dashboard/recent-progress');
  },

  getAchievements: async () => {
    return await apiClient.get('/patients/dashboard/achievements');
  },

  getWeeklyStats: async () => {
    return await apiClient.get('/patients/dashboard/weekly-stats');
  },

  getOverallProgress: async () => {
    return await apiClient.get('/patients/dashboard/overall-progress');
  },

  // Tasks
  getTasks: async (params = {}) => {
    return await apiClient.get('/patients/tasks', { params });
  },

  getTask: async (taskId) => {
    return await apiClient.get(`/patients/tasks/${taskId}`);
  },

  getUpcoming: async (days = 7) => {
    return await apiClient.get(`/patients/upcoming?days=${days}`);
  },

  addTaskNotes: async (taskId, notes) => {
    return await apiClient.post(`/patients/tasks/${taskId}/notes`, { notes });
  },

  // Personal Notes
  createNote: async (noteData) => {
    return await apiClient.post('/patients/notes', noteData);
  },

  getNotes: async (params = {}) => {
    return await apiClient.get('/patients/notes', { params });
  },

  // Progress
  recordProgress: async (progressData) => {
    return await apiClient.post('/patients/progress', progressData);
  },

  getProgress: async (params = {}) => {
    return await apiClient.get('/patients/progress', { params });
  },

  getProgressById: async (progressId) => {
    return await apiClient.get(`/patients/progress/${progressId}`);
  },

  updateProgress: async (progressId, data) => {
    return await apiClient.put(`/patients/progress/${progressId}`, data);
  },

  deleteProgress: async (progressId) => {
    return await apiClient.delete(`/patients/progress/${progressId}`);
  },

  // Analytics
  getAnalytics: async (params = {}) => {
    return await apiClient.get('/patients/analytics', { params });
  },

  getTaskProgress: async (taskId) => {
    return await apiClient.get(`/patients/tasks/${taskId}/progress`);
  },

  // Providers
  getProviders: async () => {
    return await apiClient.get('/patients/providers');
  },
};

export default patientAPI;
