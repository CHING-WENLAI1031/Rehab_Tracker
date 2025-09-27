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
    // Implementation would integrate with notification service
    // For now, return placeholder
    return { sent: true, count: 0 };
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
}

module.exports = new CommentService();