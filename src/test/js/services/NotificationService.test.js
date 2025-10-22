const mongoose = require('mongoose');
const NotificationService = require('../../../main/js/services/NotificationService');
const Notification = require('../../../main/js/models/Notification');
const User = require('../../../main/js/models/User');
const RehabTask = require('../../../main/js/models/RehabTask');

describe('NotificationService', () => {
  let notificationService;
  let patientId, physiotherapistId, doctorId;
  let mockIo;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Notification.deleteMany({});
    await RehabTask.deleteMany({});

    // Mock Socket.io
    mockIo = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    notificationService = new NotificationService(mockIo);

    // Create test users
    const patient = await User.create({
      firstName: 'Test',
      lastName: 'Patient',
      email: 'patient@test.com',
      password: 'password123',
      role: 'patient',
      phoneNumber: '+1234567890'
    });

    const physiotherapist = await User.create({
      firstName: 'Test',
      lastName: 'Physiotherapist',
      email: 'physio@test.com',
      password: 'password123',
      role: 'physiotherapist',
      phoneNumber: '+1234567891',
      assignedPatients: [patient._id]
    });

    const doctor = await User.create({
      firstName: 'Test',
      lastName: 'Doctor',
      email: 'doctor@test.com',
      password: 'password123',
      role: 'doctor',
      phoneNumber: '+1234567892'
    });

    patientId = patient._id;
    physiotherapistId = physiotherapist._id;
    doctorId = doctor._id;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('createNotification', () => {
    it('should create a basic notification successfully', async () => {
      const notificationData = {
        recipient: patientId,
        sender: physiotherapistId,
        title: 'Test Notification',
        message: 'This is a test notification',
        type: 'system_alert',
        category: 'system',
        priority: 'normal'
      };

      const result = await notificationService.createNotification(notificationData);

      expect(result.success).toBe(true);
      expect(result.data.notification.title).toBe(notificationData.title);
      expect(result.data.notification.recipient._id.toString()).toBe(patientId.toString());
      expect(result.data.notification.recipientRole).toBe('patient');
    });

    it('should use template when templateId is provided', async () => {
      const notificationData = {
        recipient: patientId,
        sender: physiotherapistId,
        templateId: 'task_reminder',
        templateVariables: {
          taskTitle: 'Daily Exercise'
        },
        type: 'task_reminder',
        relatedEntity: {
          entityType: 'rehabTask',
          entityId: new mongoose.Types.ObjectId()
        }
      };

      const result = await notificationService.createNotification(notificationData);

      expect(result.success).toBe(true);
      expect(result.data.notification.title).toBe('Exercise Reminder');
      expect(result.data.notification.message).toContain('Daily Exercise');
      expect(result.data.notification.actionText).toBe('Start Exercise');
    });

    it('should handle scheduled notifications', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

      const notificationData = {
        recipient: patientId,
        title: 'Scheduled Notification',
        message: 'This is scheduled',
        type: 'task_reminder',
        scheduledFor: futureDate
      };

      const result = await notificationService.createNotification(notificationData);

      expect(result.success).toBe(true);
      expect(result.data.notification.isScheduled).toBe(true);
      expect(result.data.notification.scheduledFor).toEqual(futureDate);
    });

    it('should validate recipient exists', async () => {
      const fakeUserId = new mongoose.Types.ObjectId();
      const notificationData = {
        recipient: fakeUserId,
        title: 'Test',
        message: 'Test',
        type: 'system_alert'
      };

      const result = await notificationService.createNotification(notificationData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Recipient not found');
    });
  });

  describe('createBulkNotifications', () => {
    it('should create multiple notifications for different recipients', async () => {
      const recipients = [
        { _id: patientId, role: 'patient' },
        { _id: physiotherapistId, role: 'physiotherapist' }
      ];

      const notificationTemplate = {
        title: 'Bulk Notification',
        message: 'This is a bulk notification',
        type: 'system_alert',
        category: 'system',
        sender: doctorId
      };

      const result = await notificationService.createBulkNotifications(recipients, notificationTemplate);

      expect(result.success).toBe(true);
      expect(result.data.count).toBe(2);
      expect(result.data.notifications).toHaveLength(2);
    });
  });

  describe('getNotificationsForUser', () => {
    beforeEach(async () => {
      // Create test notifications
      await Notification.create([
        {
          recipient: patientId,
          recipientRole: 'patient',
          title: 'Notification 1',
          message: 'Message 1',
          type: 'task_reminder',
          category: 'reminders',
          priority: 'high'
        },
        {
          recipient: patientId,
          recipientRole: 'patient',
          title: 'Notification 2',
          message: 'Message 2',
          type: 'system_alert',
          category: 'system',
          priority: 'normal',
          isRead: true
        },
        {
          recipient: patientId,
          recipientRole: 'patient',
          title: 'Notification 3',
          message: 'Message 3',
          type: 'comment_mention',
          category: 'communication',
          priority: 'normal'
        }
      ]);
    });

    it('should get notifications with pagination', async () => {
      const result = await notificationService.getNotificationsForUser(patientId, {
        page: 1,
        limit: 2
      });

      expect(result.success).toBe(true);
      expect(result.data.notifications).toHaveLength(2);
      expect(result.data.pagination.totalCount).toBe(3);
      expect(result.data.pagination.totalPages).toBe(2);
    });

    it('should filter by category', async () => {
      const result = await notificationService.getNotificationsForUser(patientId, {
        category: 'reminders'
      });

      expect(result.success).toBe(true);
      expect(result.data.notifications).toHaveLength(1);
      expect(result.data.notifications[0].category).toBe('reminders');
    });

    it('should filter unread only', async () => {
      const result = await notificationService.getNotificationsForUser(patientId, {
        unreadOnly: true
      });

      expect(result.success).toBe(true);
      expect(result.data.notifications).toHaveLength(2);
      expect(result.data.notifications.every(n => !n.isRead)).toBe(true);
    });

    it('should filter by priority', async () => {
      const result = await notificationService.getNotificationsForUser(patientId, {
        priority: 'high'
      });

      expect(result.success).toBe(true);
      expect(result.data.notifications).toHaveLength(1);
      expect(result.data.notifications[0].priority).toBe('high');
    });
  });

  describe('getUnreadCount', () => {
    beforeEach(async () => {
      await Notification.create([
        {
          recipient: patientId,
          recipientRole: 'patient',
          title: 'Unread 1',
          message: 'Message 1',
          type: 'task_reminder',
          category: 'reminders'
        },
        {
          recipient: patientId,
          recipientRole: 'patient',
          title: 'Unread 2',
          message: 'Message 2',
          type: 'system_alert',
          category: 'system'
        },
        {
          recipient: patientId,
          recipientRole: 'patient',
          title: 'Read Notification',
          message: 'Message 3',
          type: 'comment_mention',
          category: 'communication',
          isRead: true
        }
      ]);
    });

    it('should return correct unread count', async () => {
      const result = await notificationService.getUnreadCount(patientId);

      expect(result.success).toBe(true);
      expect(result.data.unreadCount).toBe(2);
    });
  });

  describe('markAsRead', () => {
    let notificationId;

    beforeEach(async () => {
      const notification = await Notification.create({
        recipient: patientId,
        recipientRole: 'patient',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system_alert',
        category: 'system'
      });
      notificationId = notification._id;
    });

    it('should mark notification as read', async () => {
      const result = await notificationService.markAsRead(notificationId, patientId);

      expect(result.success).toBe(true);
      expect(result.data.notification.isRead).toBe(true);
      expect(result.data.notification.readAt).toBeDefined();
    });

    it('should not mark notification for different user', async () => {
      const result = await notificationService.markAsRead(notificationId, physiotherapistId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Notification not found');
    });
  });

  describe('markAllAsRead', () => {
    beforeEach(async () => {
      await Notification.create([
        {
          recipient: patientId,
          recipientRole: 'patient',
          title: 'Notification 1',
          message: 'Message 1',
          type: 'task_reminder',
          category: 'reminders'
        },
        {
          recipient: patientId,
          recipientRole: 'patient',
          title: 'Notification 2',
          message: 'Message 2',
          type: 'system_alert',
          category: 'system'
        }
      ]);
    });

    it('should mark all notifications as read', async () => {
      const result = await notificationService.markAllAsRead(patientId);

      expect(result.success).toBe(true);
      expect(result.data.modifiedCount).toBe(2);

      // Verify all are marked as read
      const unreadCount = await notificationService.getUnreadCount(patientId);
      expect(unreadCount.data.unreadCount).toBe(0);
    });

    it('should mark notifications by category', async () => {
      const result = await notificationService.markAllAsRead(patientId, {
        category: 'reminders'
      });

      expect(result.success).toBe(true);
      expect(result.data.modifiedCount).toBe(1);
    });
  });

  describe('dismissNotification', () => {
    let notificationId;

    beforeEach(async () => {
      const notification = await Notification.create({
        recipient: patientId,
        recipientRole: 'patient',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system_alert',
        category: 'system'
      });
      notificationId = notification._id;
    });

    it('should dismiss notification', async () => {
      const result = await notificationService.dismissNotification(notificationId, patientId);

      expect(result.success).toBe(true);
      expect(result.data.notification.isDismissed).toBe(true);
      expect(result.data.notification.dismissedAt).toBeDefined();
    });
  });

  describe('trackEngagement', () => {
    let notificationId;

    beforeEach(async () => {
      const notification = await Notification.create({
        recipient: patientId,
        recipientRole: 'patient',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system_alert',
        category: 'system'
      });
      notificationId = notification._id;
    });

    it('should track click engagement', async () => {
      const result = await notificationService.trackEngagement(notificationId, patientId, 'click');

      expect(result.success).toBe(true);
      expect(result.data.notification.analytics.clicks).toBe(1);
      expect(result.data.notification.analytics.impressions).toBe(1);
    });
  });

  describe('createTaskReminders', () => {
    beforeEach(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await RehabTask.create({
        title: 'Morning Exercise',
        description: 'Daily morning routine',
        assignedTo: patientId,
        assignedBy: physiotherapistId,
        status: 'active',
        scheduleType: 'once',
        scheduledDate: tomorrow,
        exercises: [{
          name: 'Push-ups',
          sets: 3,
          reps: 10
        }]
      });
    });

    it('should create task reminder notifications', async () => {
      const result = await notificationService.createTaskReminders();

      expect(result.success).toBe(true);
      expect(result.data.remindersCreated).toBeGreaterThan(0);

      // Check notification was created
      const notifications = await Notification.find({
        recipient: patientId,
        type: 'task_reminder'
      });
      expect(notifications).toHaveLength(1);
    });
  });

  describe('getNotificationStatistics', () => {
    beforeEach(async () => {
      await Notification.create([
        {
          recipient: patientId,
          recipientRole: 'patient',
          title: 'Notification 1',
          message: 'Message 1',
          type: 'task_reminder',
          category: 'reminders',
          priority: 'high'
        },
        {
          recipient: patientId,
          recipientRole: 'patient',
          title: 'Notification 2',
          message: 'Message 2',
          type: 'system_alert',
          category: 'system',
          priority: 'normal',
          isRead: true
        },
        {
          recipient: patientId,
          recipientRole: 'patient',
          title: 'Urgent Notification',
          message: 'Urgent message',
          type: 'critical_alert',
          category: 'health_alerts',
          priority: 'urgent',
          isUrgent: true
        }
      ]);
    });

    it('should return notification statistics', async () => {
      const result = await notificationService.getNotificationStatistics(patientId);

      expect(result.success).toBe(true);
      expect(result.data.total).toBe(3);
      expect(result.data.unread).toBe(2);
      expect(result.data.urgent).toBe(1);
      expect(result.data.byCategory.reminders.total).toBe(1);
      expect(result.data.byPriority.high.total).toBe(1);
    });
  });

  describe('deliverInAppNotification', () => {
    let notification;

    beforeEach(async () => {
      notification = await Notification.create({
        recipient: patientId,
        recipientRole: 'patient',
        title: 'Test Notification',
        message: 'Test message',
        type: 'system_alert',
        category: 'system',
        channels: [{ type: 'in_app', status: 'pending' }]
      });

      // Populate for testing
      await notification.populate('recipient', 'firstName lastName role email phoneNumber');
    });

    it('should emit socket event for in-app notification', async () => {
      await notificationService.deliverInAppNotification(notification);

      expect(mockIo.to).toHaveBeenCalledWith(`user_${patientId}`);
      expect(mockIo.emit).toHaveBeenCalledWith('notification', expect.objectContaining({
        title: 'Test Notification',
        message: 'Test message',
        type: 'system_alert'
      }));
    });
  });

  describe('processTemplate', () => {
    it('should replace template variables', async () => {
      const template = 'Hello {{name}}, you have {{count}} new messages';
      const variables = { name: 'John', count: 5 };

      const result = notificationService.processTemplate(template, variables);

      expect(result).toBe('Hello John, you have 5 new messages');
    });

    it('should leave unreplaced variables as is', async () => {
      const template = 'Hello {{name}}, {{missing}} variable';
      const variables = { name: 'John' };

      const result = notificationService.processTemplate(template, variables);

      expect(result).toBe('Hello John, {{missing}} variable');
    });
  });
});