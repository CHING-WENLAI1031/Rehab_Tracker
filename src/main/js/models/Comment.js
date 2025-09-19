const mongoose = require('mongoose');

/**
 * Comment Schema for feedback and communication
 * Supports comments on tasks, progress entries, and general patient care
 */
const commentSchema = new mongoose.Schema({
  // Author Information
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Comment author is required']
  },

  // Target Information (what is being commented on)
  targetType: {
    type: String,
    required: [true, 'Target type is required'],
    enum: {
      values: ['rehabTask', 'progress', 'patient', 'general'],
      message: 'Invalid target type'
    }
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: function() {
      return this.targetType !== 'general';
    }
  },

  // For patient-related comments
  relatedPatient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Related patient is required']
  },

  // Comment Content
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    trim: true,
    minlength: [1, 'Comment cannot be empty'],
    maxlength: [2000, 'Comment cannot exceed 2000 characters']
  },

  // Comment Type and Category
  commentType: {
    type: String,
    required: [true, 'Comment type is required'],
    enum: {
      values: [
        'feedback',
        'instruction',
        'concern',
        'encouragement',
        'question',
        'observation',
        'recommendation',
        'note',
        'warning',
        'celebration'
      ],
      message: 'Invalid comment type'
    }
  },

  // Priority and Urgency
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  requiresResponse: {
    type: Boolean,
    default: false
  },
  responseDeadline: {
    type: Date,
    validate: {
      validator: function(v) {
        return !v || v > new Date();
      },
      message: 'Response deadline must be in the future'
    }
  },

  // Visibility and Permissions
  visibility: {
    type: String,
    enum: ['private', 'patient_visible', 'team_visible', 'all_visible'],
    default: 'patient_visible'
  },

  // Who can see this comment
  visibleTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['patient', 'physiotherapist', 'doctor']
    }
  }],

  // Thread and Reply System
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  isReply: {
    type: Boolean,
    default: false
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Status and Interaction
  status: {
    type: String,
    enum: ['active', 'resolved', 'archived', 'flagged'],
    default: 'active'
  },

  // Read Status
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Reactions and Engagement
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['like', 'helpful', 'thanks', 'concern', 'question'],
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Tags for categorization
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],

  // Attachments
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'document', 'video', 'audio'],
      required: true
    },
    filename: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    size: Number, // in bytes
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Mentions (@username functionality)
  mentions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notified: {
      type: Boolean,
      default: false
    }
  }],

  // Moderation and Quality
  flagged: {
    isFlagged: {
      type: Boolean,
      default: false
    },
    flaggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    flaggedAt: Date,
    reason: String
  },

  // Edit History
  edited: {
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: Date,
    originalContent: String,
    editReason: String
  },

  // Scheduled Comments
  scheduled: {
    isScheduled: {
      type: Boolean,
      default: false
    },
    publishAt: Date,
    published: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for reply count
commentSchema.virtual('replyCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment',
  count: true
});

// Virtual for unread status for a specific user
commentSchema.virtual('isUnreadFor').get(function() {
  return function(userId) {
    return !this.readBy.some(read => read.user.toString() === userId.toString());
  };
});

// Virtual for reaction counts
commentSchema.virtual('reactionCounts').get(function() {
  const counts = {};
  this.reactions.forEach(reaction => {
    counts[reaction.type] = (counts[reaction.type] || 0) + 1;
  });
  return counts;
});

// Pre-save middleware
commentSchema.pre('save', function(next) {
  // Set isReply based on parentComment
  this.isReply = !!this.parentComment;

  // Auto-tag based on comment type
  if (!this.tags.includes(this.commentType)) {
    this.tags.push(this.commentType);
  }

  // Set published status for scheduled comments
  if (this.scheduled.isScheduled && !this.scheduled.published) {
    const now = new Date();
    if (this.scheduled.publishAt && this.scheduled.publishAt <= now) {
      this.scheduled.published = true;
    }
  }

  next();
});

// Instance method to mark as read by user
commentSchema.methods.markAsRead = function(userId) {
  const existingRead = this.readBy.find(read =>
    read.user.toString() === userId.toString()
  );

  if (!existingRead) {
    this.readBy.push({ user: userId });
    return this.save();
  }

  return Promise.resolve(this);
};

// Instance method to add reaction
commentSchema.methods.addReaction = function(userId, reactionType) {
  // Remove existing reaction from this user
  this.reactions = this.reactions.filter(r =>
    r.user.toString() !== userId.toString()
  );

  // Add new reaction
  this.reactions.push({ user: userId, type: reactionType });

  return this.save();
};

// Instance method to remove reaction
commentSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(r =>
    r.user.toString() !== userId.toString()
  );

  return this.save();
};

// Static method to find comments for a target
commentSchema.statics.findForTarget = function(targetType, targetId, options = {}) {
  const query = { targetType, targetId };

  if (options.includeReplies === false) {
    query.parentComment = null;
  }

  return this.find(query)
    .populate('author', 'firstName lastName role avatar')
    .populate('replyTo', 'firstName lastName')
    .populate('parentComment')
    .sort({ createdAt: options.sortOrder || -1 });
};

// Static method to find unread comments for user
commentSchema.statics.findUnreadForUser = function(userId) {
  return this.find({
    $and: [
      { 'visibleTo.user': userId },
      { 'readBy.user': { $ne: userId } },
      { status: 'active' },
      { 'scheduled.published': true }
    ]
  })
  .populate('author', 'firstName lastName role')
  .populate('relatedPatient', 'firstName lastName')
  .sort({ createdAt: -1 });
};

// Static method to find comments requiring response
commentSchema.statics.findRequiringResponse = function(options = {}) {
  const query = {
    requiresResponse: true,
    status: 'active'
  };

  if (options.overdue) {
    query.responseDeadline = { $lt: new Date() };
  }

  return this.find(query)
    .populate('author', 'firstName lastName role')
    .populate('relatedPatient', 'firstName lastName')
    .sort({ responseDeadline: 1, createdAt: -1 });
};

// Indexes for performance
commentSchema.index({ targetType: 1, targetId: 1 });
commentSchema.index({ relatedPatient: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ 'visibleTo.user': 1 });
commentSchema.index({ 'readBy.user': 1 });
commentSchema.index({ requiresResponse: 1, responseDeadline: 1 });
commentSchema.index({ status: 1 });
commentSchema.index({ parentComment: 1 });

module.exports = mongoose.model('Comment', commentSchema);