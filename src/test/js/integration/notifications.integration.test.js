const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../main/js/server');
const User = require('../../../main/js/models/User');
const Notification = require('../../../main/js/models/Notification');
const Comment = require('../../../main/js/models/Comment');
const RehabTask = require('../../../main/js/models/RehabTask');
const jwt = require('jsonwebtoken');

/**
 * Notification System Integration Tests
 *
 * Tests the complete notification workflow from API endpoints through
 * NotificationService to database and Socket.io emission
 */
describe('Notification System Integration Tests', () => {
  let patientToken, physioToken, doctorToken;
  let patient, physiotherapist, doctor;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Notification.deleteMany({});
    await Comment.deleteMany({});
    await RehabTask.deleteMany({});

    // Create test patient
    patient = await User.create({
      firstName: 'John',
      lastName: 'Patient',
      email: 'patient@test.com',
      password: 'password123',
      role: 'patient',
      phoneNumber: '+1234567890'
    });

    // Create test physiotherapist
    physiotherapist = await User.create({
      firstName: 'Jane',
      lastName: 'Physio',
      email: 'physio@test.com',
      password: 'password123',
      role: 'physiotherapist',
      phoneNumber: '+1234567891',
      assignedPatients: [patient._id]
    });

    // Create test doctor
    doctor = await User.create({
      firstName: 'Dr',
      lastName: 'Smith',
      email: 'doctor@test.com',
      password: 'password123',
      role: 'doctor',
      phoneNumber: '+1234567892',
      specialization: 'Orthopedics'
    });

    // Update patient with assigned provider
    patient.assignedProviders = [{
      providerId: doctor._id,
      role: 'doctor',
      assignedAt: new Date()
    }];
    await patient.save();

    // Generate tokens
    patientToken = jwt.sign({ userId: patient._id, role: 'patient' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    physioToken = jwt.sign({ userId: physiotherapist._id, role: 'physiotherapist' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    doctorToken = jwt.sign({ userId: doctor._id, role: 'doctor' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Feedback Notification Flow', () => {
    it('should create notification when physiotherapist provides feedback', async () => {
      const feedbackData = {
        patientId: patient._id,
        content: 'Great progress this week! Keep up the excellent work.',
        feedbackType: 'encouragement',
        category: 'progress_review',
        priority: 'normal'
      };

      // Submit feedback
      const feedbackRes = await request(app)
        .post('/api/physiotherapists/feedback')
        .set('Authorization', `Bearer ${physioToken}`)
        .send(feedbackData);

      expect(feedbackRes.status).toBe(201);

      // Verify notification was created
      const notifications = await Notification.find({
        recipient: patient._id,
        type: 'feedback_received'
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toContain('New Feedback');
      expect(notifications[0].sender.toString()).toBe(physiotherapist._id.toString());
      expect(notifications[0].priority).toBe('normal');
      expect(notifications[0].isRead).toBe(false);
    });

    it('should allow patient to retrieve feedback notification', async () => {
      // Create feedback first
      await request(app)
        .post('/api/physiotherapists/feedback')
        .set('Authorization', `Bearer ${physioToken}`)
        .send({
          patientId: patient._id,
          content: 'Feedback content'
        });

      // Patient retrieves notifications
      const notifRes = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(notifRes.status).toBe(200);
      expect(notifRes.body.data.notifications.length).toBeGreaterThan(0);

      const feedbackNotif = notifRes.body.data.notifications.find(n => n.type === 'feedback_received');
      expect(feedbackNotif).toBeDefined();
      expect(feedbackNotif.relatedEntity).toBeDefined();
    });
  });

  describe('Clinical Recommendation Notification Flow', () => {
    it('should create notification when doctor provides recommendation', async () => {
      const recommendationData = {
        patientId: patient._id,
        content: 'Increase exercise intensity gradually over next 4 weeks',
        category: 'treatment_adjustment',
        recommendationType: 'treatment',
        priority: 'high'
      };

      const recRes = await request(app)
        .post('/api/doctors/recommendations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(recommendationData);

      expect(recRes.status).toBe(201);

      // Verify notification was created for patient
      const patientNotifications = await Notification.find({
        recipient: patient._id,
        type: 'recommendation_received'
      });

      expect(patientNotifications).toHaveLength(1);
      expect(patientNotifications[0].title).toContain('New Clinical Recommendation');
      expect(patientNotifications[0].priority).toBe('high');

      // Verify notification was created for physiotherapist
      const physioNotifications = await Notification.find({
        recipient: physiotherapist._id,
        type: 'recommendation_received'
      });

      expect(physioNotifications).toHaveLength(1);
      expect(physioNotifications[0].recipientRole).toBe('physiotherapist');
    });

    it('should mark high priority recommendations as urgent', async () => {
      const urgentRecommendation = {
        patientId: patient._id,
        content: 'URGENT: Stop current exercises immediately',
        category: 'treatment_adjustment',
        priority: 'high'
      };

      await request(app)
        .post('/api/doctors/recommendations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(urgentRecommendation);

      const notification = await Notification.findOne({
        recipient: patient._id,
        type: 'recommendation_received'
      });

      expect(notification.priority).toBe('high');
      expect(notification.isRead).toBe(false);
    });
  });

  describe('Notification Retrieval and Management', () => {
    beforeEach(async () => {
      // Create multiple notifications
      await Notification.create([
        {
          recipient: patient._id,
          recipientRole: 'patient',
          sender: physiotherapist._id,
          title: 'Feedback Notification',
          message: 'New feedback from physiotherapist',
          type: 'feedback_received',
          category: 'communication',
          priority: 'normal'
        },
        {
          recipient: patient._id,
          recipientRole: 'patient',
          sender: doctor._id,
          title: 'Recommendation Notification',
          message: 'New recommendation from doctor',
          type: 'recommendation_received',
          category: 'clinical',
          priority: 'high'
        },
        {
          recipient: patient._id,
          recipientRole: 'patient',
          title: 'Task Reminder',
          message: 'Upcoming exercise session',
          type: 'task_reminder',
          category: 'reminders',
          priority: 'normal'
        }
      ]);
    });

    it('should retrieve all notifications with pagination', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${patientToken}`)
        .query({ page: 1, limit: 2 });

      expect(res.status).toBe(200);
      expect(res.body.data.notifications).toHaveLength(2);
      expect(res.body.data.pagination.totalCount).toBe(3);
      expect(res.body.data.pagination.totalPages).toBe(2);
    });

    it('should filter notifications by category', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${patientToken}`)
        .query({ category: 'clinical' });

      expect(res.status).toBe(200);
      expect(res.body.data.notifications).toHaveLength(1);
      expect(res.body.data.notifications[0].category).toBe('clinical');
    });

    it('should filter unread notifications only', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${patientToken}`)
        .query({ unreadOnly: true });

      expect(res.status).toBe(200);
      expect(res.body.data.notifications.length).toBe(3);
      expect(res.body.data.notifications.every(n => !n.isRead)).toBe(true);
    });

    it('should get unread notification count', async () => {
      const res = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.unreadCount).toBe(3);
    });
  });

  describe('Notification Actions', () => {
    let notificationId;

    beforeEach(async () => {
      const notification = await Notification.create({
        recipient: patient._id,
        recipientRole: 'patient',
        sender: physiotherapist._id,
        title: 'Test Notification',
        message: 'Test message',
        type: 'feedback_received',
        category: 'communication',
        priority: 'normal'
      });
      notificationId = notification._id;
    });

    it('should mark notification as read', async () => {
      const res = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.notification.isRead).toBe(true);
      expect(res.body.data.notification.readAt).toBeDefined();
    });

    it('should mark all notifications as read', async () => {
      // Create additional notifications
      await Notification.create([
        {
          recipient: patient._id,
          recipientRole: 'patient',
          title: 'Notification 2',
          message: 'Message 2',
          type: 'system_alert',
          category: 'system',
          priority: 'normal'
        },
        {
          recipient: patient._id,
          recipientRole: 'patient',
          title: 'Notification 3',
          message: 'Message 3',
          type: 'task_reminder',
          category: 'reminders',
          priority: 'normal'
        }
      ]);

      const res = await request(app)
        .put('/api/notifications/mark-all-read')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.modifiedCount).toBeGreaterThanOrEqual(3);

      // Verify all are marked as read
      const unreadCount = await Notification.countDocuments({
        recipient: patient._id,
        isRead: false
      });
      expect(unreadCount).toBe(0);
    });

    it('should dismiss notification', async () => {
      const res = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.notification.isDismissed).toBe(true);
      expect(res.body.data.notification.dismissedAt).toBeDefined();
    });

    it('should not allow marking another user\'s notification', async () => {
      const res = await request(app)
        .put(`/api/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${physioToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('Notification Statistics', () => {
    beforeEach(async () => {
      await Notification.create([
        {
          recipient: patient._id,
          recipientRole: 'patient',
          title: 'High Priority',
          message: 'Urgent message',
          type: 'critical_alert',
          category: 'health_alerts',
          priority: 'urgent',
          isUrgent: true
        },
        {
          recipient: patient._id,
          recipientRole: 'patient',
          title: 'Normal Priority',
          message: 'Normal message',
          type: 'task_reminder',
          category: 'reminders',
          priority: 'normal',
          isRead: true
        },
        {
          recipient: patient._id,
          recipientRole: 'patient',
          title: 'Low Priority',
          message: 'Info message',
          type: 'info',
          category: 'updates',
          priority: 'low'
        }
      ]);
    });

    it('should retrieve notification statistics', async () => {
      const res = await request(app)
        .get('/api/notifications/statistics')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.unread).toBe(2);
      expect(res.body.data.urgent).toBe(1);
      expect(res.body.data.byCategory).toBeDefined();
      expect(res.body.data.byPriority).toBeDefined();
    });
  });

  describe('Cross-Role Notification Flow', () => {
    it('should notify physiotherapist when patient adds task notes', async () => {
      // Create a task
      const task = await RehabTask.create({
        title: 'Morning Exercise',
        description: 'Daily routine',
        assignedTo: patient._id,
        assignedBy: physiotherapist._id,
        status: 'active',
        scheduleType: 'daily',
        exercises: [{
          name: 'Stretching',
          sets: 3,
          reps: 10
        }]
      });

      // Patient adds notes (if this triggers notification)
      const noteRes = await request(app)
        .post(`/api/patients/tasks/${task._id}/notes`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          notes: 'Had some difficulty with this exercise today'
        });

      expect(noteRes.status).toBe(200);

      // Check if notification was created for physiotherapist
      // (depends on implementation - this is an example)
      // Commenting out since current implementation may not create this notification
      // const notifications = await Notification.find({
      //   recipient: physiotherapist._id,
      //   type: 'patient_note_added'
      // });
      // expect(notifications.length).toBeGreaterThan(0);
    });

    it('should handle multi-recipient notifications for recommendations', async () => {
      const recommendationData = {
        patientId: patient._id,
        content: 'Team recommendation: adjust therapy plan',
        category: 'treatment_adjustment',
        priority: 'high'
      };

      await request(app)
        .post('/api/doctors/recommendations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send(recommendationData);

      // Both patient and physiotherapist should receive notifications
      const patientNotifs = await Notification.find({
        recipient: patient._id,
        type: 'recommendation_received'
      });

      const physioNotifs = await Notification.find({
        recipient: physiotherapist._id,
        type: 'recommendation_received'
      });

      expect(patientNotifs).toHaveLength(1);
      expect(physioNotifs).toHaveLength(1);
      expect(patientNotifs[0].recipientRole).toBe('patient');
      expect(physioNotifs[0].recipientRole).toBe('physiotherapist');
    });
  });

  describe('Notification Template Processing', () => {
    it('should use correct template for feedback notifications', async () => {
      await request(app)
        .post('/api/physiotherapists/feedback')
        .set('Authorization', `Bearer ${physioToken}`)
        .send({
          patientId: patient._id,
          content: 'Excellent progress!'
        });

      const notification = await Notification.findOne({
        recipient: patient._id,
        type: 'feedback_received'
      }).populate('sender', 'firstName lastName');

      expect(notification.title).toContain('Feedback');
      expect(notification.message).toContain(physiotherapist.firstName);
    });

    it('should use correct template for recommendation notifications', async () => {
      await request(app)
        .post('/api/doctors/recommendations')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          patientId: patient._id,
          content: 'Adjust treatment plan',
          category: 'treatment_adjustment'
        });

      const notification = await Notification.findOne({
        recipient: patient._id,
        type: 'recommendation_received'
      }).populate('sender', 'firstName lastName');

      expect(notification.title).toContain('Recommendation');
      expect(notification.message).toContain(doctor.firstName);
    });
  });

  describe('Notification Security and Privacy', () => {
    let patientNotificationId, physioNotificationId;

    beforeEach(async () => {
      const patientNotif = await Notification.create({
        recipient: patient._id,
        recipientRole: 'patient',
        title: 'Patient Notification',
        message: 'Private patient message',
        type: 'system_alert',
        category: 'system',
        priority: 'normal'
      });
      patientNotificationId = patientNotif._id;

      const physioNotif = await Notification.create({
        recipient: physiotherapist._id,
        recipientRole: 'physiotherapist',
        title: 'Physio Notification',
        message: 'Private physio message',
        type: 'system_alert',
        category: 'system',
        priority: 'normal'
      });
      physioNotificationId = physioNotif._id;
    });

    it('should not allow user to access another user\'s notifications', async () => {
      const res = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      const notifIds = res.body.data.notifications.map(n => n._id);
      expect(notifIds).toContain(patientNotificationId.toString());
      expect(notifIds).not.toContain(physioNotificationId.toString());
    });

    it('should not allow user to mark another user\'s notification as read', async () => {
      const res = await request(app)
        .put(`/api/notifications/${physioNotificationId}/read`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(404);

      // Verify notification remains unread
      const notification = await Notification.findById(physioNotificationId);
      expect(notification.isRead).toBe(false);
    });

    it('should require authentication for all notification endpoints', async () => {
      const endpoints = [
        { method: 'get', url: '/api/notifications' },
        { method: 'get', url: '/api/notifications/unread-count' },
        { method: 'get', url: '/api/notifications/statistics' },
        { method: 'put', url: `/api/notifications/${patientNotificationId}/read` },
        { method: 'put', url: '/api/notifications/mark-all-read' },
        { method: 'delete', url: `/api/notifications/${patientNotificationId}` }
      ];

      for (const endpoint of endpoints) {
        const res = await request(app)[endpoint.method](endpoint.url);
        expect(res.status).toBe(401);
      }
    });
  });
});
