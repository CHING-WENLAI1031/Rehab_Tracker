const Notification = require('../models/Notification');
const User = require('../models/User');
const RehabTask = require('../models/RehabTask');
const Comment = require('../models/Comment');
const cron = require('node-cron');

/**
 * Comprehensive Notification Service
 * Handles creation, delivery, scheduling, and management of all notifications
 */
class NotificationService {
  constructor(io) {
    this.io = io; // Socket.io instance for real-time notifications
    this.templates = this.initializeTemplates();
    this.scheduledJobs = new Map();
    this.initializeScheduledTasks();
  }

  /**
   * Initialize notification templates
   */
  initializeTemplates() {
    return {
      task_reminder: {
        title: 'Exercise Reminder',
        message: 'You have a rehabilitation exercise due: {{taskTitle}}',
        actionText: 'Start Exercise',
        channels: ['in_app', 'push']
      },
      task_overdue: {
        title: 'Overdue Exercise',
        message: 'Your exercise "{{taskTitle}}" is overdue. Please complete it when you can.',
        actionText: 'Complete Now',
        channels: ['in_app', 'push', 'email']
      },
      task_completed: {
        title: 'Great Work!',
        message: 'You completed "{{taskTitle}}"! Keep up the excellent progress.',
        actionText: 'View Progress',
        channels: ['in_app']
      },
      progress_milestone: {
        title: 'Milestone Achieved!',
        message: 'Congratulations! You\'ve reached {{milestone}} in your recovery journey.',
        actionText: 'View Achievements',
        channels: ['in_app', 'push']
      },
      comment_mention: {
        title: 'You were mentioned',
        message: '{{senderName}} mentioned you in a comment',
        actionText: 'View Comment',
        channels: ['in_app', 'push']
      },
      comment_reply: {
        title: 'New Reply',
        message: '{{senderName}} replied to your comment',
        actionText: 'View Reply',
        channels: ['in_app', 'push']
      },
      appointment_reminder: {
        title: 'Appointment Reminder',
        message: 'You have an appointment with {{providerName}} at {{time}}',
        actionText: 'View Details',
        channels: ['in_app', 'push', 'email']
      },
      achievement_unlocked: {
        title: 'Achievement Unlocked!',
        message: 'You\'ve earned the "{{achievementName}}" badge!',
        actionText: 'View Badge',
        channels: ['in_app', 'push']
      },
      low_engagement: {
        title: 'We Miss You!',
        message: 'You haven\'t logged your exercises in {{days}} days. Let\'s get back on track!',
        actionText: 'Resume Exercises',
        channels: ['in_app', 'push', 'email']
      },
      critical_alert: {
        title: 'Important Health Alert',
        message: '{{alertMessage}}',
        actionText: 'Contact Provider',
        channels: ['in_app', 'push', 'email', 'sms']
      },
      welcome: {
        title: 'Welcome to Your Recovery Journey',
        message: 'Welcome {{firstName}}! Let\'s start your personalized rehabilitation program.',
        actionText: 'Get Started',
        channels: ['in_app', 'email']
      },
      feedback_request: {
        title: 'How Are You Feeling?',
        message: 'Your therapist would like feedback on your recent progress.',
        actionText: 'Provide Feedback',
        channels: ['in_app', 'push']
      }
    };
  }

  /**
   * Create a new notification
   */
  async createNotification(notificationData) {
    try {
      // Validate recipient
      const recipient = await User.findById(notificationData.recipient);
      if (!recipient) {
        throw new Error('Recipient not found');
      }

      // Get template if templateId provided
      let finalData = { ...notificationData };
      if (notificationData.templateId && this.templates[notificationData.templateId]) {
        const template = this.templates[notificationData.templateId];
        finalData = {
          ...finalData,
          title: finalData.title || this.processTemplate(template.title, notificationData.templateVariables),
          message: finalData.message || this.processTemplate(template.message, notificationData.templateVariables),
          actionText: finalData.actionText || template.actionText,
          channels: finalData.channels || template.channels.map(type => ({ type, status: 'pending' }))
        };
      }

      // Set default channels if none provided
      if (!finalData.channels || finalData.channels.length === 0) {
        finalData.channels = [{ type: 'in_app', status: 'pending' }];
      }

      // Set recipient role
      finalData.recipientRole = recipient.role;

      // Create notification
      const notification = new Notification(finalData);
      const savedNotification = await notification.save();

      // Populate sender information
      const populatedNotification = await Notification.findById(savedNotification._id)
        .populate('sender', 'firstName lastName role')
        .populate('recipient', 'firstName lastName role email phoneNumber');

      // Handle immediate delivery or scheduling
      if (notification.scheduledFor && notification.scheduledFor > new Date()) {
        await this.scheduleNotification(populatedNotification);
      } else {
        await this.deliverNotification(populatedNotification);
      }

      return {
        success: true,
        data: {
          notification: populatedNotification
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create bulk notifications
   */
  async createBulkNotifications(recipients, notificationTemplate) {
    try {
      const notifications = recipients.map(recipient => ({
        ...notificationTemplate,
        recipient: recipient._id || recipient,
        recipientRole: recipient.role
      }));

      const createdNotifications = await Notification.createBulkNotifications(notifications);

      // Deliver all notifications
      for (const notification of createdNotifications) {
        const populated = await Notification.findById(notification._id)
          .populate('sender', 'firstName lastName role')
          .populate('recipient', 'firstName lastName role email phoneNumber');
        await this.deliverNotification(populated);
      }

      return {
        success: true,
        data: {
          notifications: createdNotifications,
          count: createdNotifications.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Deliver notification through specified channels
   */
  async deliverNotification(notification) {
    try {
      const deliveryPromises = notification.channels.map(async (channel) => {
        try {
          switch (channel.type) {
            case 'in_app':
              await this.deliverInAppNotification(notification);
              break;
            case 'push':
              await this.deliverPushNotification(notification);
              break;
            case 'email':
              await this.deliverEmailNotification(notification);
              break;
            case 'sms':
              await this.deliverSMSNotification(notification);
              break;
          }

          await notification.updateDeliveryStatus(channel.type, 'sent');
        } catch (error) {
          await notification.updateDeliveryStatus(channel.type, 'failed', { reason: error.message });
        }
      });

      await Promise.allSettled(deliveryPromises);

      // Update overall notification status
      notification.status = 'sent';
      await notification.save();

      return {
        success: true,
        data: { notification }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Deliver in-app notification via Socket.io
   */
  async deliverInAppNotification(notification) {
    if (this.io) {
      const room = `user_${notification.recipient._id}`;
      this.io.to(room).emit('notification', {
        id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        isUrgent: notification.isUrgent,
        actionUrl: notification.actionUrl,
        actionText: notification.actionText,
        timeAgo: notification.timeAgo,
        createdAt: notification.createdAt
      });
    }
  }

  /**
   * Deliver push notification (placeholder for push service integration)
   */
  async deliverPushNotification(notification) {
    // Placeholder for push notification service (FCM, APNS, etc.)
    console.log(`Push notification sent to ${notification.recipient.email}:`, notification.title);

    // In a real implementation, you would integrate with:
    // - Firebase Cloud Messaging (FCM) for Android
    // - Apple Push Notification Service (APNS) for iOS
    // - Web Push API for web browsers

    return Promise.resolve();
  }

  /**
   * Deliver email notification (placeholder for email service integration)
   */
  async deliverEmailNotification(notification) {
    // Placeholder for email service integration
    console.log(`Email notification sent to ${notification.recipient.email}:`, notification.title);

    // In a real implementation, you would integrate with:
    // - SendGrid
    // - AWS SES
    // - Nodemailer with SMTP

    return Promise.resolve();
  }

  /**
   * Deliver SMS notification (placeholder for SMS service integration)
   */
  async deliverSMSNotification(notification) {
    // Placeholder for SMS service integration
    console.log(`SMS notification sent to ${notification.recipient.phoneNumber}:`, notification.title);

    // In a real implementation, you would integrate with:
    // - Twilio
    // - AWS SNS
    // - Other SMS providers

    return Promise.resolve();
  }

  /**
   * Schedule notification for future delivery
   */
  async scheduleNotification(notification) {
    const scheduleTime = new Date(notification.scheduledFor);
    const jobId = `notification_${notification._id}`;

    // Convert to cron format (simplified for minute precision)
    const cronExpression = `${scheduleTime.getMinutes()} ${scheduleTime.getHours()} ${scheduleTime.getDate()} ${scheduleTime.getMonth() + 1} *`;

    const job = cron.schedule(cronExpression, async () => {
      await this.deliverNotification(notification);
      this.scheduledJobs.delete(jobId);
    }, {
      scheduled: false,
      timezone: notification.conditions?.timezone || 'UTC'
    });

    job.start();
    this.scheduledJobs.set(jobId, job);

    return {
      success: true,
      data: { jobId, scheduledFor: scheduleTime }
    };
  }

  /**
   * Get notifications for user with pagination and filtering
   */
  async getNotificationsForUser(userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        priority,
        unreadOnly = false,
        type
      } = options;

      const query = { recipient: userId };

      if (category) query.category = category;
      if (priority) query.priority = priority;
      if (type) query.type = type;
      if (unreadOnly) {
        query.isRead = false;
        query.isDismissed = false;
      }

      const skip = (page - 1) * limit;

      const [notifications, totalCount] = await Promise.all([
        Notification.find(query)
          .populate('sender', 'firstName lastName role')
          .sort({ priority: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Notification.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
        success: true,
        data: {
          notifications,
          pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get unread notification count for user
   */
  async getUnreadCount(userId) {
    try {
      const count = await Notification.countDocuments({
        recipient: userId,
        isRead: false,
        isDismissed: false,
        status: { $in: ['pending', 'sent', 'delivered'] }
      });

      return {
        success: true,
        data: { unreadCount: count }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.markAsRead();

      return {
        success: true,
        data: { notification }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Mark multiple notifications as read
   */
  async markAllAsRead(userId, options = {}) {
    try {
      const query = {
        recipient: userId,
        isRead: false
      };

      if (options.category) query.category = options.category;
      if (options.type) query.type = options.type;

      const result = await Notification.updateMany(query, {
        isRead: true,
        readAt: new Date(),
        status: 'read'
      });

      return {
        success: true,
        data: {
          modifiedCount: result.modifiedCount
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Dismiss notification
   */
  async dismissNotification(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.dismiss();

      return {
        success: true,
        data: { notification }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Track notification engagement (click, view, etc.)
   */
  async trackEngagement(notificationId, userId, type = 'click') {
    try {
      const notification = await Notification.findOne({
        _id: notificationId,
        recipient: userId
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.trackEngagement(type);

      return {
        success: true,
        data: { notification }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create task reminder notifications
   */
  async createTaskReminders() {
    try {
      const now = new Date();
      const reminderTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

      const upcomingTasks = await RehabTask.find({
        status: 'active',
        scheduledDate: {
          $gte: now,
          $lte: reminderTime
        }
      }).populate('assignedTo');

      const notifications = upcomingTasks.map(task => ({
        recipient: task.assignedTo._id,
        type: 'task_reminder',
        templateId: 'task_reminder',
        templateVariables: {
          taskTitle: task.title
        },
        relatedEntity: {
          entityType: 'rehabTask',
          entityId: task._id
        },
        actionUrl: `/tasks/${task._id}`,
        priority: task.priority || 'normal'
      }));

      if (notifications.length > 0) {
        await this.createBulkNotifications(upcomingTasks.map(t => t.assignedTo), notifications[0]);
      }

      return {
        success: true,
        data: {
          remindersCreated: notifications.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create overdue task notifications
   */
  async createOverdueTaskNotifications() {
    try {
      const now = new Date();

      const overdueTasks = await RehabTask.find({
        status: 'active',
        scheduledDate: { $lt: now }
      }).populate('assignedTo');

      const notifications = [];
      for (const task of overdueTasks) {
        notifications.push({
          recipient: task.assignedTo._id,
          type: 'task_overdue',
          templateId: 'task_overdue',
          templateVariables: {
            taskTitle: task.title
          },
          relatedEntity: {
            entityType: 'rehabTask',
            entityId: task._id
          },
          actionUrl: `/tasks/${task._id}`,
          priority: 'high'
        });
      }

      if (notifications.length > 0) {
        const result = await this.createBulkNotifications(
          overdueTasks.map(t => t.assignedTo),
          notifications[0]
        );
        return result;
      }

      return {
        success: true,
        data: { overdueNotificationsCreated: 0 }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process template variables
   */
  processTemplate(template, variables = {}) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  /**
   * Initialize scheduled tasks
   */
  initializeScheduledTasks() {
    // Run task reminders every hour
    cron.schedule('0 * * * *', async () => {
      await this.createTaskReminders();
    });

    // Check for overdue tasks every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      await this.createOverdueTaskNotifications();
    });

    // Clean up old notifications daily
    cron.schedule('0 2 * * *', async () => {
      await this.cleanupOldNotifications();
    });
  }

  /**
   * Clean up old read/dismissed notifications
   */
  async cleanupOldNotifications() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30); // 30 days ago

      const result = await Notification.deleteMany({
        $or: [
          { isRead: true, readAt: { $lt: cutoffDate } },
          { isDismissed: true, dismissedAt: { $lt: cutoffDate } }
        ]
      });

      console.log(`Cleaned up ${result.deletedCount} old notifications`);

      return {
        success: true,
        data: { deletedCount: result.deletedCount }
      };
    } catch (error) {
      console.error('Notification cleanup error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get notification statistics for user
   */
  async getNotificationStatistics(userId, dateRange = {}) {
    try {
      const stats = await Notification.getStatistics(userId, dateRange);

      if (stats.length === 0) {
        return {
          success: true,
          data: {
            total: 0,
            unread: 0,
            urgent: 0,
            byCategory: {},
            byPriority: {}
          }
        };
      }

      const statistics = stats[0];
      const categoryStats = {};
      const priorityStats = {};

      statistics.byCategory.forEach(item => {
        if (!categoryStats[item.category]) {
          categoryStats[item.category] = { total: 0, unread: 0 };
        }
        categoryStats[item.category].total++;
        if (!item.isRead) {
          categoryStats[item.category].unread++;
        }

        if (!priorityStats[item.priority]) {
          priorityStats[item.priority] = { total: 0, unread: 0 };
        }
        priorityStats[item.priority].total++;
        if (!item.isRead) {
          priorityStats[item.priority].unread++;
        }
      });

      return {
        success: true,
        data: {
          total: statistics.total,
          unread: statistics.unread,
          urgent: statistics.urgent,
          byCategory: categoryStats,
          byPriority: priorityStats
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = NotificationService;