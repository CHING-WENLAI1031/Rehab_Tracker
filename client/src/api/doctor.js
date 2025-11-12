import apiClient from './axios';

export const doctorAPI = {
  // Dashboard & Analytics
  getDashboard: async () => {
    return await apiClient.get('/doctors/dashboard');
  },

  getAnalyticsOverview: async () => {
    return await apiClient.get('/doctors/analytics/overview');
  },

  // Patient Management
  getAllPatients: async () => {
    return await apiClient.get('/doctors/patients');
  },

  getPatientRecovery: async (patientId) => {
    return await apiClient.get(`/doctors/patients/${patientId}/recovery`);
  },

  // Medical Annotations
  createAnnotation: async (annotationData) => {
    return await apiClient.post('/doctors/annotations', annotationData);
  },

  // Surgery Records
  createSurgeryRecord: async (surgeryData) => {
    return await apiClient.post('/doctors/surgery-records', surgeryData);
  },

  getSurgeryRecords: async (patientId) => {
    return await apiClient.get(`/doctors/surgery-records/${patientId}`);
  },

  updateSurgeryRecord: async (recordId, data) => {
    return await apiClient.put(`/doctors/surgery-records/${recordId}`, data);
  },

  // Clinical Recommendations
  createRecommendation: async (recommendationData) => {
    return await apiClient.post('/doctors/recommendations', recommendationData);
  },
};

export default doctorAPI;
