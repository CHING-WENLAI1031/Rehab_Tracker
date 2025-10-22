const Comment = require('../models/Comment');
const User = require('../models/User');
const RehabTask = require('../models/RehabTask');
const Progress = require('../models/Progress');
const mongoose = require('mongoose');

/**
 * Advanced Comment Service
 * Handles threaded discussions, collaboration features, and communication management
 */

class CommentService {
  constructor() {
    this.notificationService = null;
  }

  /**
   * Set notification service for sending notifications
   * @param {NotificationService} notificationService
   */
  setNotificationService(notificationService) {
    this.notificationService = notificationService;
  }

  /**
   * Create a new comment or reply
   * @param {String} authorId - Author user ID
   * @param {Object} commentData - Comment data
   * @returns {Promise<Object>} Created comment with thread info
   */
  async createComment(authorId, commentData) {
    try {
      const {
        targetType,
        targetId,
        relatedPatient,
        content,
        commentType,
        priority,
        requiresResponse,
        responseDeadline,
        visibility,
        parentComment,
        replyTo,
        attachments,
        mentions
      } = commentData;

      // Validate author exists and has permission
      const author = await User.findById(authorId);
      if (!author) {
        throw new Error('Author not found');
      }

      // Validate related patient access
      await this.validatePatientAccess(authorId, relatedPatient);

      // If this is a reply, validate parent comment exists
      let isReply = false;
      let parentCommentDoc = null;
      if (parentComment) {
        parentCommentDoc = await Comment.findById(parentComment);
        if (!parentCommentDoc) {
          throw new Error('Parent comment not found');
        }
        isReply = true;
      }

      // Create the comment
      const comment = new Comment({
        author: authorId,
        targetType,
        targetId,
        relatedPatient,
        content: await this.sanitizeAndFormatContent(content),
        commentType: commentType || 'note',
        priority: priority || 'normal',
        requiresResponse: requiresResponse || false,
        responseDeadline,
        visibility: visibility || 'patient_visible',
        parentComment,
        isReply,
        replyTo,
        visibleTo: await this.calculateVisibility(visibility, relatedPatient, authorId),
        mentions: await this.processMentions(mentions || []),
        attachments: attachments || []
      });

      const savedComment = await comment.save();

      // Populate the saved comment for response
      const populatedComment = await Comment.findById(savedComment._id)
        .populate('author', 'firstName lastName role profilePicture')
        .populate('replyTo', 'firstName lastName role')
        .populate('mentions.user', 'firstName lastName role')
        .populate('reactions.user', 'firstName lastName');

      // Update thread statistics if this is a reply
      if (isReply && parentCommentDoc) {
        await this.updateThreadStatistics(parentComment);
      }

      // Send notifications for mentions, replies, etc.
      await this.sendCommentNotifications(populatedComment);

      // Return with thread context
      const threadInfo = await this.getThreadInfo(savedComment._id);

      return {
        success: true,
        data: {
          comment: populatedComment,
          threadInfo,
          notifications: {
            sent: true,
            recipients: await this.getNotificationRecipients(populatedComment)
          }
        }
      };
    } catch (error) {
      throw new Error(`Failed to create comment: ${error.message}`);
    }
  }

  /**
   * Get threaded comments for a target (task, progress, patient)
   * @param {String} targetType - Type of target
   * @param {String} targetId - Target ID
   * @param {String} userId - Requesting user ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Threaded comments data
   */
  async getThreadedComments(targetType, targetId, userId, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        commentType,
        priority,
        status = 'active'
      } = options;

      // Validate user access to target
      await this.validateTargetAccess(userId, targetType, targetId);

      // Build query
      const query = {
        targetType,
        targetId,
        status,
        $or: [
          { visibility: 'all_visible' },
          { 'visibleTo.user': userId },
          { author: userId }
        ]
      };

      if (commentType) query.commentType = commentType;
      if (priority) query.priority = priority;

      // Get root comments (not replies)
      const rootCommentsQuery = { ...query, isReply: false };

      const rootComments = await Comment.find(rootCommentsQuery)
        .populate('author', 'firstName lastName role profilePicture')
        .populate('replyTo', 'firstName lastName role')
        .populate('mentions.user', 'firstName lastName role')
        .populate('reactions.user', 'firstName lastName')
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip((page - 1) * limit)
        .limit(limit);

      // Get replies for each root comment
      const threadsWithReplies = await Promise.all(
        rootComments.map(async (rootComment) => {
          const replies = await this.getCommentReplies(rootComment._id, userId);
          const unreadCount = await this.getUnreadCount(rootComment._id, userId);

          return {
            ...rootComment.toObject(),
            replies,
            replyCount: replies.length,
            unreadCount,
            hasUnread: unreadCount > 0,
            threadSummary: await this.getThreadSummary(rootComment._id)
          };
        })
      );

      // Get total counts
      const totalComments = await Comment.countDocuments(rootCommentsQuery);
      const totalPages = Math.ceil(totalComments / limit);

      // Get discussion analytics
      const analytics = await this.getDiscussionAnalytics(targetType, targetId, userId);

      return {
        success: true,
        data: {
          threads: threadsWithReplies,
          pagination: {
            currentPage: page,
            totalPages,
            totalComments,
            hasNext: page < totalPages,
            hasPrev: page > 1
          },
          analytics,
          filters: {
            applied: { commentType, priority, status },
            available: await this.getAvailableFilters(targetType, targetId, userId)
          }
        }
      };
    } catch (error) {
      throw new Error(`Failed to get threaded comments: ${error.message}`);
    }
  }

  /**
   * Get replies for a specific comment
   * @param {String} parentCommentId - Parent comment ID
   * @param {String} userId - Requesting user ID
   * @returns {Promise<Array>} Array of reply comments
   */
  async getCommentReplies(parentCommentId, userId) {
    try {
      const replies = await Comment.find({
        parentComment: parentCommentId,
        isReply: true,
        status: 'active',
        $or: [
          { visibility: 'all_visible' },
          { 'visibleTo.user': userId },
          { author: userId }
        ]
      })
        .populate('author', 'firstName lastName role profilePicture')
        .populate('replyTo', 'firstName lastName role')
        .populate('mentions.user', 'firstName lastName role')
        .populate('reactions.user', 'firstName lastName')
        .sort({ createdAt: 1 }); // Replies in chronological order

      return replies;
    } catch (error) {
      throw new Error(`Failed to get comment replies: ${error.message}`);
    }
  }

  /**
   * Add reaction to a comment (like, helpful, concern, etc.)
   * @param {String} commentId - Comment ID
   * @param {String} userId - User ID
   * @param {String} reactionType - Type of reaction
   * @returns {Promise<Object>} Updated comment with reactions
   */
  async addReaction(commentId, userId, reactionType) {
    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      // Validate user has access to comment
      await this.validateCommentAccess(userId, commentId);

      // Remove existing reaction from this user if any
      comment.reactions = comment.reactions.filter(
        r => r.user.toString() !== userId.toString()
      );

      // Add new reaction
      comment.reactions.push({
        user: userId,
        type: reactionType,
        createdAt: new Date()
      });

      await comment.save();

      // Get updated comment with populated data
      const updatedComment = await Comment.findById(commentId)
        .populate('reactions.user', 'firstName lastName');

      // Get reaction summary
      const reactionSummary = this.summarizeReactions(updatedComment.reactions);

      return {
        success: true,
        data: {
          comment: updatedComment,
          reactionSummary,
          userReaction: reactionType
        }
      };
    } catch (error) {
      throw new Error(`Failed to add reaction: ${error.message}`);
    }
  }

  /**
   * Mark comment as read by user
   * @param {String} commentId - Comment ID
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Success confirmation
   */
  async markAsRead(commentId, userId) {
    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      // Check if already read
      const alreadyRead = comment.readBy.some(
        read => read.user.toString() === userId.toString()
      );

      if (!alreadyRead) {
        comment.readBy.push({
          user: userId,
          readAt: new Date()
        });
        await comment.save();
      }

      return {
        success: true,
        data: {
          commentId,
          markedAsRead: !alreadyRead,
          readAt: new Date()
        }
      };
    } catch (error) {
      throw new Error(`Failed to mark comment as read: ${error.message}`);
    }
  }

  /**
   * Update comment content and properties
   * @param {String} commentId - Comment ID
   * @param {String} userId - User ID (must be author)
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated comment
   */
  async updateComment(commentId, userId, updateData) {
    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      // Only author can edit their comments
      if (comment.author.toString() !== userId.toString()) {
        throw new Error('Only the comment author can edit this comment');
      }

      // Validate update data
      const allowedUpdates = ['content', 'commentType', 'priority', 'requiresResponse', 'responseDeadline', 'visibility'];
      const updates = {};

      Object.keys(updateData).forEach(key => {
        if (allowedUpdates.includes(key)) {
          updates[key] = updateData[key];
        }
      });

      // Special handling for content
      if (updates.content) {
        updates.content = await this.sanitizeAndFormatContent(updates.content);
        updates.lastEditedAt = new Date();
        updates.editedBy = userId;
      }

      // Update visibility permissions if needed
      if (updates.visibility) {
        updates.visibleTo = await this.calculateVisibility(updates.visibility, comment.relatedPatient, userId);
      }

      Object.assign(comment, updates);
      await comment.save();

      const updatedComment = await Comment.findById(commentId)
        .populate('author', 'firstName lastName role profilePicture')
        .populate('editedBy', 'firstName lastName');

      return {
        success: true,
        data: {
          comment: updatedComment,
          updatedFields: Object.keys(updates),
          lastEditedAt: updates.lastEditedAt || null
        }
      };
    } catch (error) {
      throw new Error(`Failed to update comment: ${error.message}`);
    }
  }

  /**
   * Delete comment and handle thread cleanup
   * @param {String} commentId - Comment ID
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteComment(commentId, userId) {
    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      // Check permissions (author or admin)
      const user = await User.findById(userId);
      const canDelete = comment.author.toString() === userId.toString() ||
                       user.role === 'doctor' ||
                       user.role === 'admin';

      if (!canDelete) {
        throw new Error('Insufficient permissions to delete this comment');
      }

      // Handle thread cleanup
      if (!comment.isReply) {
        // Root comment - handle all replies
        const replies = await Comment.find({ parentComment: commentId });

        if (replies.length > 0) {
          // Soft delete to preserve thread structure
          comment.status = 'archived';
          comment.content = '[Comment deleted]';
          comment.deletedAt = new Date();
          comment.deletedBy = userId;
          await comment.save();
        } else {
          // No replies, can hard delete
          await Comment.findByIdAndDelete(commentId);
        }
      } else {
        // Reply comment - can safely delete
        await Comment.findByIdAndDelete(commentId);

        // Update parent thread statistics
        if (comment.parentComment) {
          await this.updateThreadStatistics(comment.parentComment);
        }
      }

      return {
        success: true,
        data: {
          commentId,
          deletionType: comment.isReply ? 'hard_delete' : (replies?.length > 0 ? 'soft_delete' : 'hard_delete'),
          threadImpact: !comment.isReply ? 'thread_archived' : 'reply_removed'
        }
      };
    } catch (error) {
      throw new Error(`Failed to delete comment: ${error.message}`);
    }
  }

  /**
   * Get discussion analytics for a target
   * @param {String} targetType - Target type
   * @param {String} targetId - Target ID
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Discussion analytics
   */
  async getDiscussionAnalytics(targetType, targetId, userId) {
    try {
      const baseQuery = { targetType, targetId, status: 'active' };

      const [
        totalComments,
        totalThreads,
        activeParticipants,
        unreadCount,
        priorityDistribution,
        typeDistribution,
        recentActivity
      ] = await Promise.all([
        Comment.countDocuments(baseQuery),
        Comment.countDocuments({ ...baseQuery, isReply: false }),
        this.getActiveParticipants(targetType, targetId),
        this.getUserUnreadCount(targetType, targetId, userId),
        this.getPriorityDistribution(targetType, targetId),
        this.getTypeDistribution(targetType, targetId),
        this.getRecentActivityMetrics(targetType, targetId)
      ]);

      return {
        totalComments,
        totalThreads,
        activeParticipants: activeParticipants.length,
        participantList: activeParticipants,
        unreadCount,
        priorityDistribution,
        typeDistribution,
        recentActivity,
        engagementScore: this.calculateEngagementScore(totalComments, activeParticipants.length, recentActivity)
      };
    } catch (error) {
      throw new Error(`Failed to get discussion analytics: ${error.message}`);
    }
  }

  // Helper methods

  async validatePatientAccess(userId, patientId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    if (user.role === 'patient' && userId.toString() !== patientId.toString()) {
      throw new Error('Patients can only comment on their own records');
    }

    if (user.role === 'physiotherapist' || user.role === 'doctor') {
      const patient = await User.findById(patientId);
      const hasAccess = patient?.assignedProviders?.some(
        provider => provider.providerId.toString() === userId.toString()
      );

      if (!hasAccess) {
        throw new Error('Provider does not have access to this patient');
      }
    }
  }

  async validateTargetAccess(userId, targetType, targetId) {
    switch (targetType) {
      case 'rehabTask':
        const task = await RehabTask.findById(targetId);
        if (!task) throw new Error('Rehab task not found');
        await this.validatePatientAccess(userId, task.assignedTo);
        break;

      case 'progress':
        const progress = await Progress.findById(targetId);
        if (!progress) throw new Error('Progress record not found');
        await this.validatePatientAccess(userId, progress.patient);
        break;

      case 'patient':
        await this.validatePatientAccess(userId, targetId);
        break;
    }
  }

  async validateCommentAccess(userId, commentId) {
    const comment = await Comment.findById(commentId);
    if (!comment) throw new Error('Comment not found');

    const hasAccess = comment.visibility === 'all_visible' ||
                     comment.author.toString() === userId.toString() ||
                     comment.visibleTo.some(v => v.user.toString() === userId.toString());

    if (!hasAccess) {
      throw new Error('Access denied to this comment');
    }
  }

  async sanitizeAndFormatContent(content) {
    // Basic sanitization and formatting
    return content
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocols
      .substring(0, 2000); // Enforce length limit
  }

  async calculateVisibility(visibility, patientId, authorId) {
    const visibleTo = [];

    switch (visibility) {
      case 'patient_visible':
        visibleTo.push({ user: patientId, role: 'patient' });
        break;
      case 'team_visible':
        // Add all healthcare providers assigned to patient
        const patient = await User.findById(patientId).populate('assignedProviders.providerId');
        patient?.assignedProviders?.forEach(provider => {
          visibleTo.push({
            user: provider.providerId._id,
            role: provider.providerId.role
          });
        });
        break;
      case 'all_visible':
        // No specific restrictions
        break;
      case 'private':
        visibleTo.push({ user: authorId, role: 'author' });
        break;
    }

    return visibleTo;
  }

  async processMentions(mentions) {
    const processedMentions = [];

    for (const mention of mentions) {
      const user = await User.findById(mention.userId);
      if (user) {
        processedMentions.push({
          user: user._id,
          mentionedAt: new Date(),
          notified: false
        });
      }
    }

    return processedMentions;
  }

  async sendCommentNotifications(comment) {
    if (!this.notificationService) {
      return { sent: false, count: 0, reason: 'Notification service not available' };
    }

    const notifications = [];
    let sentCount = 0;

    try {
      // Send mention notifications
      if (comment.mentions && comment.mentions.length > 0) {
        for (const mention of comment.mentions) {
          const mentionNotification = await this.notificationService.createNotification({
            recipient: mention.user,
            sender: comment.author._id,
            type: 'comment_mention',
            templateId: 'comment_mention',
            templateVariables: {
              senderName: `${comment.author.firstName} ${comment.author.lastName}`
            },
            relatedEntity: {
              entityType: 'comment',
              entityId: comment._id
            },
            actionUrl: `/comments/${comment._id}`,
            priority: 'high',
            channels: [
              { type: 'in_app', status: 'pending' },
              { type: 'push', status: 'pending' }
            ]
          });

          if (mentionNotification.success) {
            notifications.push(mentionNotification.data.notification);
            sentCount++;
          }
        }
      }

      // Send reply notifications
      if (comment.isReply && comment.replyTo && comment.replyTo._id !== comment.author._id) {
        const replyNotification = await this.notificationService.createNotification({
          recipient: comment.replyTo._id,
          sender: comment.author._id,
          type: 'comment_reply',
          templateId: 'comment_reply',
          templateVariables: {
            senderName: `${comment.author.firstName} ${comment.author.lastName}`
          },
          relatedEntity: {
            entityType: 'comment',
            entityId: comment._id
          },
          actionUrl: `/comments/${comment._id}`,
          priority: 'normal',
          channels: [
            { type: 'in_app', status: 'pending' },
            { type: 'push', status: 'pending' }
          ]
        });

        if (replyNotification.success) {
          notifications.push(replyNotification.data.notification);
          sentCount++;
        }
      }

      return {
        sent: true,
        count: sentCount,
        notifications
      };

    } catch (error) {
      console.error('Error sending comment notifications:', error);
      return {
        sent: false,
        count: sentCount,
        error: error.message,
        notifications
      };
    }
  }

  async getNotificationRecipients(comment) {
    const recipients = [];

    // Add mentioned users
    comment.mentions?.forEach(mention => {
      recipients.push({
        user: mention.user,
        reason: 'mentioned',
        priority: 'high'
      });
    });

    // Add reply recipients
    if (comment.isReply && comment.replyTo) {
      recipients.push({
        user: comment.replyTo,
        reason: 'reply',
        priority: 'medium'
      });
    }

    return recipients;
  }

  async getThreadInfo(commentId) {
    const comment = await Comment.findById(commentId);

    if (comment.isReply) {
      const parentComment = await Comment.findById(comment.parentComment);
      const siblingCount = await Comment.countDocuments({
        parentComment: comment.parentComment,
        isReply: true
      });

      return {
        isPartOfThread: true,
        threadRoot: parentComment._id,
        totalReplies: siblingCount,
        threadDepth: 1 // Current implementation supports 1-level threading
      };
    } else {
      const replyCount = await Comment.countDocuments({
        parentComment: commentId,
        isReply: true
      });

      return {
        isThreadRoot: true,
        replyCount,
        threadDepth: 0
      };
    }
  }

  async updateThreadStatistics(parentCommentId) {
    const replyCount = await Comment.countDocuments({
      parentComment: parentCommentId,
      isReply: true,
      status: 'active'
    });

    const lastReply = await Comment.findOne({
      parentComment: parentCommentId,
      isReply: true,
      status: 'active'
    }).sort({ createdAt: -1 });

    await Comment.findByIdAndUpdate(parentCommentId, {
      'threadStats.replyCount': replyCount,
      'threadStats.lastReplyAt': lastReply?.createdAt || null,
      'threadStats.lastActivity': new Date()
    });
  }

  async getUnreadCount(commentId, userId) {
    return Comment.countDocuments({
      $or: [
        { _id: commentId },
        { parentComment: commentId }
      ],
      'readBy.user': { $ne: userId },
      status: 'active'
    });
  }

  async getThreadSummary(commentId) {
    const replies = await Comment.find({
      parentComment: commentId,
      isReply: true,
      status: 'active'
    }).populate('author', 'firstName lastName role');

    const participants = [...new Set(replies.map(r => r.author._id.toString()))];
    const lastActivity = replies.length > 0 ?
      Math.max(...replies.map(r => r.createdAt.getTime())) : null;

    return {
      replyCount: replies.length,
      participantCount: participants.length,
      lastActivity: lastActivity ? new Date(lastActivity) : null,
      hasHighPriority: replies.some(r => r.priority === 'high' || r.priority === 'urgent')
    };
  }

  summarizeReactions(reactions) {
    const summary = {};
    reactions.forEach(reaction => {
      summary[reaction.type] = (summary[reaction.type] || 0) + 1;
    });
    return summary;
  }

  async getActiveParticipants(targetType, targetId) {
    const participants = await Comment.aggregate([
      { $match: { targetType, targetId, status: 'active' } },
      { $group: { _id: '$author' } },
      { $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }},
      { $unwind: '$user' },
      { $project: {
        _id: '$user._id',
        firstName: '$user.firstName',
        lastName: '$user.lastName',
        role: '$user.role'
      }}
    ]);

    return participants;
  }

  async getUserUnreadCount(targetType, targetId, userId) {
    return Comment.countDocuments({
      targetType,
      targetId,
      status: 'active',
      'readBy.user': { $ne: userId },
      author: { $ne: userId } // Don't count own comments as unread
    });
  }

  async getPriorityDistribution(targetType, targetId) {
    const distribution = await Comment.aggregate([
      { $match: { targetType, targetId, status: 'active' } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    return distribution.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
  }

  async getTypeDistribution(targetType, targetId) {
    const distribution = await Comment.aggregate([
      { $match: { targetType, targetId, status: 'active' } },
      { $group: { _id: '$commentType', count: { $sum: 1 } } }
    ]);

    return distribution.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
  }

  async getRecentActivityMetrics(targetType, targetId) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentComments = await Comment.countDocuments({
      targetType,
      targetId,
      createdAt: { $gte: sevenDaysAgo },
      status: 'active'
    });

    return {
      commentsLast7Days: recentComments,
      averagePerDay: Math.round(recentComments / 7 * 10) / 10
    };
  }

  calculateEngagementScore(totalComments, participantCount, recentActivity) {
    if (totalComments === 0) return 0;

    const diversityScore = participantCount > 0 ? Math.min(participantCount / 3, 1) * 30 : 0;
    const volumeScore = Math.min(totalComments / 10, 1) * 40;
    const recentScore = Math.min(recentActivity.commentsLast7Days / 5, 1) * 30;

    return Math.round(diversityScore + volumeScore + recentScore);
  }

  async getAvailableFilters(targetType, targetId, userId) {
    const [priorities, types] = await Promise.all([
      Comment.distinct('priority', { targetType, targetId, status: 'active' }),
      Comment.distinct('commentType', { targetType, targetId, status: 'active' })
    ]);

    return { priorities, types };
  }

  /**
   * Reply to a comment
   * @param {String} parentCommentId - Parent comment ID
   * @param {String} authorId - Reply author ID
   * @param {Object} replyData - Reply data
   * @returns {Promise<Object>} Reply with thread context
   */
  async replyToComment(parentCommentId, authorId, replyData) {
    try {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        throw new Error('Parent comment not found');
      }

      await this.validateTargetAccess(authorId, parentComment.targetType, parentComment.targetId);

      const replyComment = new Comment({
        author: authorId,
        content: await this.sanitizeAndFormatContent(replyData.content),
        commentType: replyData.commentType || 'general',
        targetType: parentComment.targetType,
        targetId: parentComment.targetId,
        relatedPatient: parentComment.relatedPatient,
        isReply: true,
        parentComment: parentCommentId,
        replyTo: parentComment.author,
        priority: replyData.priority || 'normal',
        visibility: replyData.visibility || 'all_visible',
        visibleTo: await this.calculateVisibility(replyData.visibility || 'all_visible', parentComment.relatedPatient, authorId),
        mentions: replyData.mentions ? await this.processMentions(replyData.mentions) : [],
        tags: replyData.tags || []
      });

      const savedReply = await replyComment.save();
      const populatedReply = await Comment.findById(savedReply._id)
        .populate('author', 'firstName lastName role')
        .populate('replyTo', 'firstName lastName role')
        .populate('mentions.user', 'firstName lastName role');

      // Update parent comment thread statistics
      await this.updateThreadStatistics(parentCommentId);

      const threadInfo = await this.getThreadInfo(savedReply._id);
      const notifications = await this.sendCommentNotifications(populatedReply);

      return {
        success: true,
        data: {
          comment: populatedReply,
          threadInfo,
          notifications
        }
      };
    } catch (error) {
      throw new Error(`Failed to reply to comment: ${error.message}`);
    }
  }

  /**
   * Flag a comment for moderation
   * @param {String} commentId - Comment ID
   * @param {String} flaggerId - User flagging the comment
   * @param {String} reason - Flagging reason
   * @returns {Promise<Object>} Flagging confirmation
   */
  async flagComment(commentId, flaggerId, reason) {
    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      const existingFlag = comment.flags?.find(
        flag => flag.flagger.toString() === flaggerId.toString()
      );

      if (existingFlag) {
        throw new Error('You have already flagged this comment');
      }

      const flag = {
        flagger: flaggerId,
        reason: reason,
        flaggedAt: new Date(),
        status: 'pending'
      };

      comment.flags = comment.flags || [];
      comment.flags.push(flag);

      // Auto-moderate if too many flags
      if (comment.flags.length >= 3) {
        comment.status = 'flagged';
        comment.moderation = {
          status: 'under_review',
          reviewedAt: null,
          reviewedBy: null,
          action: null
        };
      }

      await comment.save();

      return {
        success: true,
        data: {
          commentId,
          flagCount: comment.flags.length,
          status: comment.status,
          moderationStatus: comment.moderation?.status || 'none'
        }
      };
    } catch (error) {
      throw new Error(`Failed to flag comment: ${error.message}`);
    }
  }

  /**
   * Get a specific comment by ID with context
   * @param {String} commentId - Comment ID
   * @param {String} userId - Requesting user ID
   * @returns {Promise<Object>} Comment with thread context
   */
  async getCommentById(commentId, userId) {
    try {
      await this.validateCommentAccess(userId, commentId);

      const comment = await Comment.findById(commentId)
        .populate('author', 'firstName lastName role profileImage')
        .populate('replyTo', 'firstName lastName role')
        .populate('mentions.user', 'firstName lastName role')
        .populate('reactions.user', 'firstName lastName role');

      if (!comment) {
        throw new Error('Comment not found');
      }

      const threadInfo = await this.getThreadInfo(commentId);
      const userReaction = comment.reactions?.find(r => r.user._id.toString() === userId.toString());
      const isRead = comment.readBy?.some(r => r.user.toString() === userId.toString());

      // Mark as read if not already
      if (!isRead) {
        await this.markAsRead(commentId, userId);
      }

      // Get thread context if it's a reply
      let threadContext = null;
      if (comment.isReply && comment.parentComment) {
        const parentComment = await Comment.findById(comment.parentComment)
          .populate('author', 'firstName lastName role')
          .select('_id author content createdAt commentType priority');

        threadContext = {
          parentComment,
          threadInfo
        };
      }

      return {
        success: true,
        data: {
          comment: {
            ...comment.toObject(),
            userReaction: userReaction?.type || null,
            isRead: true,
            reactionSummary: this.summarizeReactions(comment.reactions || [])
          },
          threadContext
        }
      };
    } catch (error) {
      throw new Error(`Failed to get comment: ${error.message}`);
    }
  }

  /**
   * Get unread comments for a user
   * @param {String} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Unread comments
   */
  async getUnreadComments(userId, options = {}) {
    try {
      const {
        limit = 50,
        targetType,
        priority,
        commentType
      } = options;

      // Build query for accessible comments
      const query = {
        'readBy.user': { $ne: userId },
        author: { $ne: userId }, // Don't include own comments
        status: 'active',
        $or: [
          { visibility: 'all_visible' },
          { 'visibleTo.user': userId }
        ]
      };

      if (targetType) query.targetType = targetType;
      if (priority) query.priority = priority;
      if (commentType) query.commentType = commentType;

      const comments = await Comment.find(query)
        .populate('author', 'firstName lastName role')
        .populate('replyTo', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .limit(limit);

      const grouped = comments.reduce((acc, comment) => {
        if (!acc[comment.targetType]) {
          acc[comment.targetType] = [];
        }
        acc[comment.targetType].push(comment);
        return acc;
      }, {});

      const totalUnread = await Comment.countDocuments(query);

      return {
        success: true,
        data: {
          comments,
          groupedByTarget: grouped,
          totalUnread,
          hasMore: totalUnread > limit
        }
      };
    } catch (error) {
      throw new Error(`Failed to get unread comments: ${error.message}`);
    }
  }

  /**
   * Get comments requiring response from healthcare providers
   * @param {String} providerId - Provider ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Comments requiring response
   */
  async getCommentsRequiringResponse(providerId, options = {}) {
    try {
      const {
        overdue = false,
        priority,
        limit = 50
      } = options;

      const provider = await User.findById(providerId);
      if (!provider || !['physiotherapist', 'doctor'].includes(provider.role)) {
        throw new Error('User is not a healthcare provider');
      }

      // Get accessible patients
      let accessiblePatients = [];
      if (provider.role === 'physiotherapist') {
        accessiblePatients = provider.assignedPatients || [];
      } else if (provider.role === 'doctor') {
        // Doctors have access to all patients
        const allPatients = await User.find({ role: 'patient' }).select('_id');
        accessiblePatients = allPatients.map(p => p._id);
      }

      const query = {
        relatedPatient: { $in: accessiblePatients },
        status: 'active',
        commentType: { $in: ['question', 'concern', 'pain_report', 'issue'] },
        author: { $ne: providerId }, // Not provider's own comments
        $or: [
          // No replies from healthcare providers
          { 'responseStatus.hasProviderResponse': { $ne: true } },
          // Or marked as requiring follow-up
          { 'responseStatus.requiresFollowUp': true }
        ]
      };

      if (priority) query.priority = priority;

      // Add overdue filter
      if (overdue) {
        const overdueTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
        query.createdAt = { $lt: overdueTime };
      }

      const comments = await Comment.find(query)
        .populate('author', 'firstName lastName role')
        .populate('relatedPatient', 'firstName lastName')
        .sort({ priority: -1, createdAt: 1 })
        .limit(limit);

      // Calculate urgency scores
      const commentsWithUrgency = comments.map(comment => {
        let urgencyScore = 0;

        // Priority scoring
        const priorityScores = { urgent: 100, high: 75, normal: 50, low: 25 };
        urgencyScore += priorityScores[comment.priority] || 0;

        // Time factor
        const hoursOld = (Date.now() - comment.createdAt) / (1000 * 60 * 60);
        urgencyScore += Math.min(hoursOld * 2, 50);

        // Comment type factor
        if (comment.commentType === 'pain_report') urgencyScore += 25;
        if (comment.commentType === 'concern') urgencyScore += 15;

        return {
          ...comment.toObject(),
          urgencyScore: Math.round(urgencyScore),
          isOverdue: hoursOld > 24
        };
      });

      return {
        success: true,
        data: {
          comments: commentsWithUrgency.sort((a, b) => b.urgencyScore - a.urgencyScore),
          totalRequiringResponse: await Comment.countDocuments(query),
          overdueCount: await Comment.countDocuments({ ...query, createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
        }
      };
    } catch (error) {
      throw new Error(`Failed to get comments requiring response: ${error.message}`);
    }
  }

  /**
   * Search comments by content and metadata
   * @param {String} userId - User ID
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async searchComments(userId, options = {}) {
    try {
      const {
        query: searchQuery,
        targetType,
        commentType,
        author,
        tags,
        dateFrom,
        dateTo,
        page = 1,
        limit = 20,
        sortBy = 'relevance'
      } = options;

      const user = await User.findById(userId);
      let searchCriteria = {
        status: 'active',
        $or: [
          { visibility: 'all_visible' },
          { 'visibleTo.user': userId }
        ]
      };

      // Role-based access restrictions
      if (user.role === 'patient') {
        searchCriteria.relatedPatient = userId;
      } else if (user.role === 'physiotherapist') {
        searchCriteria.relatedPatient = { $in: user.assignedPatients || [] };
      }

      // Text search
      if (searchQuery) {
        searchCriteria.$text = { $search: searchQuery };
      }

      // Additional filters
      if (targetType) searchCriteria.targetType = targetType;
      if (commentType) searchCriteria.commentType = commentType;
      if (author) searchCriteria.author = author;
      if (tags) searchCriteria.tags = { $in: Array.isArray(tags) ? tags : [tags] };

      // Date range
      if (dateFrom || dateTo) {
        searchCriteria.createdAt = {};
        if (dateFrom) searchCriteria.createdAt.$gte = new Date(dateFrom);
        if (dateTo) searchCriteria.createdAt.$lte = new Date(dateTo);
      }

      // Sorting
      let sortOptions = {};
      switch (sortBy) {
        case 'relevance':
          sortOptions = searchQuery ? { score: { $meta: 'textScore' } } : { createdAt: -1 };
          break;
        case 'recent':
          sortOptions = { createdAt: -1 };
          break;
        case 'oldest':
          sortOptions = { createdAt: 1 };
          break;
        case 'priority':
          sortOptions = { priority: -1, createdAt: -1 };
          break;
      }

      const skip = (page - 1) * limit;
      const comments = await Comment.find(searchCriteria, searchQuery ? { score: { $meta: 'textScore' } } : {})
        .populate('author', 'firstName lastName role')
        .populate('replyTo', 'firstName lastName role')
        .populate('relatedPatient', 'firstName lastName')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      const total = await Comment.countDocuments(searchCriteria);

      return {
        success: true,
        data: {
          comments,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            hasNext: page * limit < total,
            hasPrev: page > 1
          },
          searchMeta: {
            query: searchQuery,
            filters: { targetType, commentType, author, tags, dateFrom, dateTo },
            sortBy
          }
        }
      };
    } catch (error) {
      throw new Error(`Failed to search comments: ${error.message}`);
    }
  }

  /**
   * Mark multiple comments as read
   * @param {Array} commentIds - Array of comment IDs
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Bulk operation result
   */
  async bulkMarkAsRead(commentIds, userId) {
    try {
      if (!Array.isArray(commentIds) || commentIds.length === 0) {
        throw new Error('Comment IDs array is required');
      }

      // Validate access to all comments
      const comments = await Comment.find({
        _id: { $in: commentIds },
        $or: [
          { visibility: 'all_visible' },
          { 'visibleTo.user': userId }
        ]
      });

      const accessibleIds = comments.map(c => c._id.toString());
      const inaccessibleIds = commentIds.filter(id => !accessibleIds.includes(id.toString()));

      // Bulk update only accessible comments
      const result = await Comment.updateMany(
        {
          _id: { $in: accessibleIds },
          'readBy.user': { $ne: userId }
        },
        {
          $push: {
            readBy: {
              user: userId,
              readAt: new Date()
            }
          }
        }
      );

      return {
        success: true,
        data: {
          totalRequested: commentIds.length,
          markedAsRead: result.modifiedCount,
          alreadyRead: accessibleIds.length - result.modifiedCount,
          inaccessible: inaccessibleIds.length,
          inaccessibleIds
        }
      };
    } catch (error) {
      throw new Error(`Failed to bulk mark comments as read: ${error.message}`);
    }
  }

  /**
   * Get comments by a specific user (for moderation/analysis)
   * @param {String} targetUserId - User whose comments to retrieve
   * @param {String} requestingUserId - User making the request
   * @param {Object} options - Query options
   * @returns {Promise<Object>} User's comments
   */
  async getCommentsByUser(targetUserId, requestingUserId, options = {}) {
    try {
      const requestingUser = await User.findById(requestingUserId);
      if (!requestingUser || !['physiotherapist', 'doctor'].includes(requestingUser.role)) {
        throw new Error('Insufficient permissions to view user comments');
      }

      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        status,
        commentType
      } = options;

      const query = {
        author: targetUserId,
        $or: [
          { visibility: 'all_visible' },
          { 'visibleTo.user': requestingUserId }
        ]
      };

      if (status) query.status = status;
      if (commentType) query.commentType = commentType;

      // Role-based access restrictions
      if (requestingUser.role === 'physiotherapist') {
        query.relatedPatient = { $in: requestingUser.assignedPatients || [] };
      }

      const sortOptions = {};
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const skip = (page - 1) * limit;
      const comments = await Comment.find(query)
        .populate('author', 'firstName lastName role')
        .populate('relatedPatient', 'firstName lastName')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      const total = await Comment.countDocuments(query);

      // Calculate user statistics
      const stats = await this.getUserCommentStatistics(targetUserId, requestingUserId);

      return {
        success: true,
        data: {
          comments,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            hasNext: page * limit < total,
            hasPrev: page > 1
          },
          userStatistics: stats
        }
      };
    } catch (error) {
      throw new Error(`Failed to get comments by user: ${error.message}`);
    }
  }

  /**
   * Mark a comment as resolved
   * @param {String} commentId - Comment ID
   * @param {String} resolverId - User resolving the comment
   * @returns {Promise<Object>} Resolution confirmation
   */
  async resolveComment(commentId, resolverId) {
    try {
      const resolver = await User.findById(resolverId);
      if (!resolver || !['physiotherapist', 'doctor'].includes(resolver.role)) {
        throw new Error('Only healthcare providers can resolve comments');
      }

      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      // Validate access
      await this.validateTargetAccess(resolverId, comment.targetType, comment.targetId);

      comment.resolution = {
        resolved: true,
        resolvedBy: resolverId,
        resolvedAt: new Date(),
        resolution_type: comment.commentType === 'question' ? 'answered' : 'addressed'
      };

      comment.responseStatus = {
        ...comment.responseStatus,
        hasProviderResponse: true,
        requiresFollowUp: false,
        lastResponseAt: new Date()
      };

      await comment.save();

      // Also resolve related replies if they're questions/concerns
      await Comment.updateMany(
        {
          parentComment: commentId,
          commentType: { $in: ['question', 'concern'] },
          'resolution.resolved': { $ne: true }
        },
        {
          $set: {
            'resolution.resolved': true,
            'resolution.resolvedBy': resolverId,
            'resolution.resolvedAt': new Date(),
            'resolution.resolution_type': 'parent_resolved'
          }
        }
      );

      const populatedComment = await Comment.findById(commentId)
        .populate('author', 'firstName lastName role')
        .populate('resolution.resolvedBy', 'firstName lastName role');

      return {
        success: true,
        data: {
          comment: populatedComment,
          resolvedReplies: await Comment.countDocuments({
            parentComment: commentId,
            'resolution.resolved': true,
            'resolution.resolution_type': 'parent_resolved'
          })
        }
      };
    } catch (error) {
      throw new Error(`Failed to resolve comment: ${error.message}`);
    }
  }

  /**
   * Get user comment statistics for provider oversight
   * @param {String} targetUserId - Target user ID
   * @param {String} requestingUserId - Requesting user ID
   * @returns {Promise<Object>} User statistics
   */
  async getUserCommentStatistics(targetUserId, requestingUserId) {
    try {
      const requestingUser = await User.findById(requestingUserId);
      let accessQuery = { author: targetUserId };

      // Apply role-based restrictions
      if (requestingUser.role === 'physiotherapist') {
        accessQuery.relatedPatient = { $in: requestingUser.assignedPatients || [] };
      }

      const [
        totalComments,
        commentsByType,
        commentsByPriority,
        recentActivity,
        flaggedComments,
        resolvedComments
      ] = await Promise.all([
        Comment.countDocuments({ ...accessQuery, status: 'active' }),
        Comment.aggregate([
          { $match: { ...accessQuery, status: 'active' } },
          { $group: { _id: '$commentType', count: { $sum: 1 } } }
        ]),
        Comment.aggregate([
          { $match: { ...accessQuery, status: 'active' } },
          { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]),
        Comment.countDocuments({
          ...accessQuery,
          status: 'active',
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }),
        Comment.countDocuments({ ...accessQuery, status: 'flagged' }),
        Comment.countDocuments({ ...accessQuery, 'resolution.resolved': true })
      ]);

      return {
        totalComments,
        commentsByType: commentsByType.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        commentsByPriority: commentsByPriority.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {}),
        recentActivity: recentActivity,
        flaggedComments,
        resolvedComments,
        engagementLevel: this.calculateUserEngagementLevel(totalComments, recentActivity)
      };
    } catch (error) {
      throw new Error(`Failed to get user comment statistics: ${error.message}`);
    }
  }

  /**
   * Calculate user engagement level
   * @param {Number} totalComments - Total comments
   * @param {Number} recentActivity - Recent activity count
   * @returns {String} Engagement level
   */
  calculateUserEngagementLevel(totalComments, recentActivity) {
    if (totalComments === 0) return 'none';
    if (recentActivity >= 5) return 'high';
    if (recentActivity >= 2) return 'moderate';
    if (totalComments >= 10) return 'regular';
    return 'low';
  }
}

module.exports = new CommentService();