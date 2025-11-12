import apiClient from './axios';

export const physiotherapistAPI = {
  // Dashboard
  getDashboard: async () => {
    return await apiClient.get('/physiotherapists/dashboard');
  },

  // Patients
  getPatients: async () => {
    return await apiClient.get('/physiotherapists/patients');
  },

  getPatientDetails: async (patientId) => {
    return await apiClient.get(`/physiotherapists/patients/${patientId}`);
  },

  // Feedback
  provideFeedback: async (feedbackData) => {
    return await apiClient.post('/physiotherapists/feedback', feedbackData);
  },

  // Analytics
  getAnalytics: async (params = {}) => {
    return await apiClient.get('/physiotherapists/analytics', { params });
  },

  // Schedule Management
  createSchedule: async (scheduleData) => {
    return await apiClient.post('/physiotherapists/schedule', scheduleData);
  },

  updateSchedule: async (scheduleId, data) => {
    return await apiClient.put(`/physiotherapists/schedule/${scheduleId}`, data);
  },
};

export default physiotherapistAPI;
