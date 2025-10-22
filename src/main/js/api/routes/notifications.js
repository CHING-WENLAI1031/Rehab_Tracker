const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleMiddleware');
const { validateQuery, validateParams, validateBody } = require('../middleware/validationMiddleware');

// Apply authentication to all routes
router.use(authenticate);

/**
 * Notification Routes
 * Handles notification management, delivery, and user preferences
 */

// @route   GET /api/notifications
// @desc    Get notifications for current user with pagination and filtering
// @access  Private (All authenticated users)
router.get('/', validateQuery(), async (req, res) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      category: req.query.category,
      priority: req.query.priority,
      unreadOnly: req.query.unreadOnly === 'true',
      type: req.query.type
    };

    // Get NotificationService instance from app
    const notificationService = req.app.get('notificationService');
    const result = await notificationService.getNotificationsForUser(req.user.id, options);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get notifications',
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get notifications',
      message: error.message
    });
  }
});

// @route   GET /api/notifications/unread-count
// @desc    Get unread notification count for current user
// @access  Private (All authenticated users)
router.get('/unread-count', async (req, res) => {
  try {
    const notificationService = req.app.get('notificationService');
    const result = await notificationService.getUnreadCount(req.user.id);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get unread count',
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count',
      message: error.message
    });
  }
});

// @route   GET /api/notifications/statistics
// @desc    Get notification statistics for current user
// @access  Private (All authenticated users)
router.get('/statistics', validateQuery(), async (req, res) => {
  try {
    const dateRange = {};
    if (req.query.startDate) dateRange.start = req.query.startDate;
    if (req.query.endDate) dateRange.end = req.query.endDate;

    const notificationService = req.app.get('notificationService');
    const result = await notificationService.getNotificationStatistics(req.user.id, dateRange);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to get notification statistics',
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get notification statistics',
      message: error.message
    });
  }
});

// @route   POST /api/notifications
// @desc    Create a new notification (for healthcare providers)
// @access  Private (Healthcare providers only)
router.post('/', requireRoles(['physiotherapist', 'doctor']), validateBody([
  'recipient',
  'title',
  'message',
  'type'
]), async (req, res) => {
  try {
    const notificationData = {
      ...req.body,
      sender: req.user.id
    };

    const notificationService = req.app.get('notificationService');
    const result = await notificationService.createNotification(notificationData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to create notification',
        message: result.error
      });
    }

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to create notification',
      message: error.message
    });
  }
});

// @route   POST /api/notifications/bulk
// @desc    Create bulk notifications (for healthcare providers)
// @access  Private (Healthcare providers only)
router.post('/bulk', requireRoles(['physiotherapist', 'doctor']), validateBody([
  'recipients',
  'title',
  'message',
  'type'
]), async (req, res) => {
  try {
    const { recipients, ...notificationTemplate } = req.body;
    notificationTemplate.sender = req.user.id;

    const notificationService = req.app.get('notificationService');
    const result = await notificationService.createBulkNotifications(recipients, notificationTemplate);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to create bulk notifications',
        message: result.error
      });
    }

    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to create bulk notifications',
      message: error.message
    });
  }
});

// @route   PUT /api/notifications/:notificationId/read
// @desc    Mark notification as read
// @access  Private (All authenticated users)
router.put('/:notificationId/read', validateParams(['notificationId']), async (req, res) => {
  try {
    const notificationService = req.app.get('notificationService');
    const result = await notificationService.markAsRead(req.params.notificationId, req.user.id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: 'Failed to mark notification as read',
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
      message: error.message
    });
  }
});

// @route   PUT /api/notifications/mark-all-read
// @desc    Mark all notifications as read
// @access  Private (All authenticated users)
router.put('/mark-all-read', validateQuery(), async (req, res) => {
  try {
    const options = {};
    if (req.query.category) options.category = req.query.category;
    if (req.query.type) options.type = req.query.type;

    const notificationService = req.app.get('notificationService');
    const result = await notificationService.markAllAsRead(req.user.id, options);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to mark all notifications as read',
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read',
      message: error.message
    });
  }
});

// @route   PUT /api/notifications/:notificationId/dismiss
// @desc    Dismiss notification
// @access  Private (All authenticated users)
router.put('/:notificationId/dismiss', validateParams(['notificationId']), async (req, res) => {
  try {
    const notificationService = req.app.get('notificationService');
    const result = await notificationService.dismissNotification(req.params.notificationId, req.user.id);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: 'Failed to dismiss notification',
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to dismiss notification',
      message: error.message
    });
  }
});

// @route   POST /api/notifications/:notificationId/track
// @desc    Track notification engagement
// @access  Private (All authenticated users)
router.post('/:notificationId/track', validateParams(['notificationId']), validateBody(['type']), async (req, res) => {
  try {
    const { type } = req.body; // 'click', 'view', etc.

    const notificationService = req.app.get('notificationService');
    const result = await notificationService.trackEngagement(
      req.params.notificationId,
      req.user.id,
      type
    );

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: 'Failed to track engagement',
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to track engagement',
      message: error.message
    });
  }
});

// @route   POST /api/notifications/system/task-reminders
// @desc    Manually trigger task reminder creation (for testing/admin)
// @access  Private (Healthcare providers only)
router.post('/system/task-reminders', requireRoles(['physiotherapist', 'doctor']), async (req, res) => {
  try {
    const notificationService = req.app.get('notificationService');
    const result = await notificationService.createTaskReminders();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create task reminders',
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create task reminders',
      message: error.message
    });
  }
});

// @route   POST /api/notifications/system/overdue-tasks
// @desc    Manually trigger overdue task notification creation (for testing/admin)
// @access  Private (Healthcare providers only)
router.post('/system/overdue-tasks', requireRoles(['physiotherapist', 'doctor']), async (req, res) => {
  try {
    const notificationService = req.app.get('notificationService');
    const result = await notificationService.createOverdueTaskNotifications();

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create overdue task notifications',
        message: result.error
      });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create overdue task notifications',
      message: error.message
    });
  }
});

// @route   GET /api/notifications/types
// @desc    Get available notification types and categories
// @access  Private (All authenticated users)
router.get('/types', async (req, res) => {
  try {
    const types = [
      'task_reminder',
      'task_overdue',
      'task_completed',
      'progress_milestone',
      'comment_mention',
      'comment_reply',
      'appointment_reminder',
      'schedule_change',
      'system_alert',
      'achievement_unlocked',
      'low_engagement',
      'critical_alert',
      'welcome',
      'feedback_request'
    ];

    const categories = [
      'reminders',
      'achievements',
      'communication',
      'system',
      'health_alerts',
      'schedule',
      'progress'
    ];

    const priorities = ['low', 'normal', 'high', 'urgent'];

    res.status(200).json({
      success: true,
      data: {
        types,
        categories,
        priorities
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get notification types',
      message: error.message
    });
  }
});

// @route   GET /api/notifications/templates
// @desc    Get available notification templates (for healthcare providers)
// @access  Private (Healthcare providers only)
router.get('/templates', requireRoles(['physiotherapist', 'doctor']), async (req, res) => {
  try {
    const notificationService = req.app.get('notificationService');
    const templates = notificationService.templates;

    res.status(200).json({
      success: true,
      data: { templates }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get notification templates',
      message: error.message
    });
  }
});

// @route   POST /api/notifications/test
// @desc    Send test notification (for development/testing)
// @access  Private (Healthcare providers only)
router.post('/test', requireRoles(['physiotherapist', 'doctor']), validateBody([
  'title',
  'message'
]), async (req, res) => {
  try {
    const notificationData = {
      recipient: req.user.id, // Send to self for testing
      sender: req.user.id,
      title: req.body.title,
      message: req.body.message,
      type: req.body.type || 'system_alert',
      category: req.body.category || 'system',
      priority: req.body.priority || 'normal',
      channels: req.body.channels || [{ type: 'in_app', status: 'pending' }]
    };

    const notificationService = req.app.get('notificationService');
    const result = await notificationService.createNotification(notificationData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to send test notification',
        message: result.error
      });
    }

    res.status(201).json({
      success: true,
      message: 'Test notification sent successfully',
      data: result.data
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to send test notification',
      message: error.message
    });
  }
});

module.exports = router;