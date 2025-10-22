const mongoose = require('mongoose');

/**
 * Notification Schema for system-wide notifications, reminders, and alerts
 * Supports real-time notifications, email/SMS delivery, and user preferences
 */
const notificationSchema = new mongoose.Schema({
  // Recipient Information
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Notification recipient is required']
  },
  recipientRole: {
    type: String,
    enum: ['patient', 'physiotherapist', 'doctor'],
    required: [true, 'Recipient role is required']
  },

  // Sender Information (optional, for user-generated notifications)
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Notification Content
  title: {
    type: String,
    required: [true, 'Notification title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  message: {
    type: String,
    required: [true, 'Notification message is required'],
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },

  // Notification Type and Category
  type: {
    type: String,
    required: [true, 'Notification type is required'],
    enum: {
      values: [
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
      ],
      message: 'Invalid notification type'
    }
  },
  category: {
    type: String,
    required: [true, 'Notification category is required'],
    enum: {
      values: [
        'reminders',
        'achievements',
        'communication',
        'system',
        'health_alerts',
        'schedule',
        'progress'
      ],
      message: 'Invalid notification category'
    }
  },

  // Priority and Urgency
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  isUrgent: {
    type: Boolean,
    default: false
  },

  // Related Content References
  relatedEntity: {
    entityType: {
      type: String,
      enum: ['rehabTask', 'progress', 'comment', 'appointment', 'user', 'system']
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId
    }
  },

  // Deep Link Information
  actionUrl: {
    type: String,
    trim: true
  },
  actionText: {
    type: String,
    trim: true,
    maxlength: [50, 'Action text cannot exceed 50 characters']
  },

  // Status and Interaction
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'read', 'failed', 'dismissed'],
    default: 'pending'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  isDismissed: {
    type: Boolean,
    default: false
  },
  dismissedAt: {
    type: Date
  },

  // Delivery Channels
  channels: [{
    type: {
      type: String,
      enum: ['in_app', 'email', 'sms', 'push'],
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed'],
      default: 'pending'
    },
    sentAt: Date,
    deliveredAt: Date,
    failureReason: String,
    retryCount: {
      type: Number,
      default: 0
    }
  }],

  // Scheduling
  scheduledFor: {
    type: Date,
    validate: {
      validator: function(v) {
        return !v || v > new Date();
      },
      message: 'Scheduled time must be in the future'
    }
  },
  isScheduled: {
    type: Boolean,
    default: false
  },

  // Bulk Notification Support
  batchId: {
    type: String,
    index: true
  },
  isBulkNotification: {
    type: Boolean,
    default: false
  },

  // Template and Personalization
  templateId: {
    type: String,
    trim: true
  },
  templateVariables: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },

  // Notification Rules and Conditions
  conditions: {
    timezone: String,
    preferredTime: {
      start: String, // HH:mm format
      end: String    // HH:mm format
    },
    daysOfWeek: [{
      type: Number,
      min: 0, // Sunday
      max: 6  // Saturday
    }]
  },

  // Expiration
  expiresAt: {
    type: Date,
    index: { expireAfterSeconds: 0 }
  },

  // Analytics and Tracking
  analytics: {
    impressions: {
      type: Number,
      default: 0
    },
    clicks: {
      type: Number,
      default: 0
    },
    engagementScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },

  // Metadata
  metadata: {
    source: {
      type: String,
      enum: ['system', 'user', 'api', 'scheduler'],
      default: 'system'
    },
    version: {
      type: String,
      default: '1.0'
    },
    tags: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for time since creation
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diffMs = now - this.createdAt;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return this.createdAt.toLocaleDateString();
});

// Virtual for overall delivery status
notificationSchema.virtual('deliveryStatus').get(function() {
  if (this.channels.length === 0) return 'pending';

  const statuses = this.channels.map(c => c.status);
  if (statuses.every(s => s === 'delivered')) return 'delivered';
  if (statuses.some(s => s === 'failed')) return 'partially_failed';
  if (statuses.some(s => s === 'sent')) return 'in_transit';
  return 'pending';
});

// Virtual for is actionable
notificationSchema.virtual('isActionable').get(function() {
  return !!(this.actionUrl && this.actionText);
});

// Pre-save middleware
notificationSchema.pre('save', function(next) {
  // Set expiration for certain notification types
  if (!this.expiresAt) {
    const expirationHours = {
      'task_reminder': 72,      // 3 days
      'appointment_reminder': 24, // 1 day
      'comment_mention': 168,   // 7 days
      'system_alert': 24,       // 1 day
      'achievement_unlocked': 720 // 30 days
    };

    const hours = expirationHours[this.type] || 168; // Default 7 days
    this.expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  // Set scheduled flag
  this.isScheduled = !!this.scheduledFor;

  // Set category based on type if not provided
  if (!this.category) {
    const categoryMap = {
      'task_reminder': 'reminders',
      'task_overdue': 'reminders',
      'task_completed': 'progress',
      'progress_milestone': 'achievements',
      'comment_mention': 'communication',
      'comment_reply': 'communication',
      'appointment_reminder': 'schedule',
      'schedule_change': 'schedule',
      'system_alert': 'system',
      'achievement_unlocked': 'achievements',
      'low_engagement': 'health_alerts',
      'critical_alert': 'health_alerts',
      'welcome': 'system',
      'feedback_request': 'communication'
    };
    this.category = categoryMap[this.type] || 'system';
  }

  next();
});

// Instance method to mark as read
notificationSchema.methods.markAsRead = function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    this.status = 'read';
    this.analytics.impressions += 1;
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to dismiss notification
notificationSchema.methods.dismiss = function() {
  this.isDismissed = true;
  this.dismissedAt = new Date();
  this.status = 'dismissed';
  return this.save();
};

// Instance method to track click/engagement
notificationSchema.methods.trackEngagement = function(type = 'click') {
  if (type === 'click') {
    this.analytics.clicks += 1;
  }
  this.analytics.impressions += 1;

  // Calculate engagement score
  const clickRate = this.analytics.impressions > 0
    ? (this.analytics.clicks / this.analytics.impressions) * 100
    : 0;
  this.analytics.engagementScore = Math.min(Math.round(clickRate), 100);

  return this.save();
};

// Instance method to update delivery status
notificationSchema.methods.updateDeliveryStatus = function(channel, status, details = {}) {
  const channelIndex = this.channels.findIndex(c => c.type === channel);

  if (channelIndex !== -1) {
    this.channels[channelIndex].status = status;

    if (status === 'sent') {
      this.channels[channelIndex].sentAt = new Date();
    } else if (status === 'delivered') {
      this.channels[channelIndex].deliveredAt = new Date();
    } else if (status === 'failed') {
      this.channels[channelIndex].failureReason = details.reason;
      this.channels[channelIndex].retryCount += 1;
    }

    return this.save();
  }

  return Promise.resolve(this);
};

// Static method to find unread notifications for user
notificationSchema.statics.findUnreadForUser = function(userId, options = {}) {
  const query = {
    recipient: userId,
    isRead: false,
    isDismissed: false,
    status: { $in: ['pending', 'sent', 'delivered'] }
  };

  if (options.category) {
    query.category = options.category;
  }

  if (options.priority) {
    query.priority = options.priority;
  }

  return this.find(query)
    .populate('sender', 'firstName lastName role')
    .sort({ priority: -1, createdAt: -1 })
    .limit(options.limit || 50);
};

// Static method to find notifications by type
notificationSchema.statics.findByType = function(userId, type, options = {}) {
  const query = {
    recipient: userId,
    type: type
  };

  if (options.unreadOnly) {
    query.isRead = false;
    query.isDismissed = false;
  }

  return this.find(query)
    .populate('sender', 'firstName lastName role')
    .sort({ createdAt: -1 })
    .limit(options.limit || 20);
};

// Static method to create bulk notifications
notificationSchema.statics.createBulkNotifications = function(notifications) {
  const batchId = new mongoose.Types.ObjectId().toString();

  const bulkNotifications = notifications.map(notification => ({
    ...notification,
    batchId,
    isBulkNotification: true
  }));

  return this.insertMany(bulkNotifications);
};

// Static method to get notification statistics
notificationSchema.statics.getStatistics = function(userId, dateRange = {}) {
  const matchStage = { recipient: mongoose.Types.ObjectId(userId) };

  if (dateRange.start && dateRange.end) {
    matchStage.createdAt = {
      $gte: new Date(dateRange.start),
      $lte: new Date(dateRange.end)
    };
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
        urgent: { $sum: { $cond: [{ $eq: ['$isUrgent', true] }, 1, 0] } },
        byCategory: {
          $push: {
            category: '$category',
            priority: '$priority',
            isRead: '$isRead'
          }
        }
      }
    }
  ]);
};

// Indexes for performance
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, category: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, priority: 1, isRead: 1 });
notificationSchema.index({ batchId: 1 });
notificationSchema.index({ scheduledFor: 1, status: 1 });
notificationSchema.index({ 'channels.type': 1, 'channels.status': 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', notificationSchema);