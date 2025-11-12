import apiClient from './axios';

export const notificationsAPI = {
  // Get notifications
  getNotifications: async (params = {}) => {
    return await apiClient.get('/notifications', { params });
  },

  // Get unread count
  getUnreadCount: async () => {
    return await apiClient.get('/notifications/unread-count');
  },

  // Get statistics
  getStatistics: async () => {
    return await apiClient.get('/notifications/statistics');
  },

  // Mark as read
  markAsRead: async (notificationId) => {
    return await apiClient.put(`/notifications/${notificationId}/read`);
  },

  // Mark all as read
  markAllAsRead: async () => {
    return await apiClient.put('/notifications/mark-all-read');
  },

  // Dismiss notification
  dismissNotification: async (notificationId) => {
    return await apiClient.delete(`/notifications/${notificationId}`);
  },
};

export default notificationsAPI;
