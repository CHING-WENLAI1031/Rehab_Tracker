const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleMiddleware');
const { validateQuery, validateParams, validateBody } = require('../middleware/validationMiddleware');
const commentService = require('../../services/CommentService');

router.use(authenticate);

/**
 * Comment Routes
 * Handles threaded discussions, reactions, and collaboration across all user roles
 */

// @route   POST /api/comments
// @desc    Create a new comment
// @access  Private (All authenticated users)
router.post('/', validateBody([
  'targetType',
  'content',
  'relatedPatient',
  'commentType'
]), async (req, res) => {
  try {
    const result = await commentService.createComment(req.user.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to create comment',
      message: error.message
    });
  }
});

// @route   GET /api/comments/:targetType/:targetId
// @desc    Get threaded comments for a target
// @access  Private (All authenticated users)
router.get('/:targetType/:targetId', validateParams(['targetType', 'targetId']), async (req, res) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sortBy || 'createdAt',
      sortOrder: req.query.sortOrder || 'desc',
      includeReplies: req.query.includeReplies !== 'false',
      status: req.query.status || 'active',
      visibility: req.query.visibility
    };

    const result = await commentService.getThreadedComments(
      req.params.targetType,
      req.params.targetId,
      req.user.id,
      options
    );

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get comments',
      message: error.message
    });
  }
});

// @route   GET /api/comments/:commentId
// @desc    Get specific comment with thread context
// @access  Private (All authenticated users)
router.get('/:commentId', validateParams(['commentId']), async (req, res) => {
  try {
    const result = await commentService.getCommentById(req.params.commentId, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Comment not found',
      message: error.message
    });
  }
});

// @route   PUT /api/comments/:commentId
// @desc    Edit a comment
// @access  Private (Comment author or authorized roles)
router.put('/:commentId', validateParams(['commentId']), validateBody(['content']), async (req, res) => {
  try {
    const result = await commentService.editComment(
      req.params.commentId,
      req.user.id,
      req.body.content,
      req.body.editReason
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to edit comment',
      message: error.message
    });
  }
});

// @route   DELETE /api/comments/:commentId
// @desc    Delete a comment and handle thread cleanup
// @access  Private (Comment author or authorized roles)
router.delete('/:commentId', validateParams(['commentId']), async (req, res) => {
  try {
    const result = await commentService.deleteComment(req.params.commentId, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to delete comment',
      message: error.message
    });
  }
});

// @route   POST /api/comments/:commentId/reply
// @desc    Reply to a comment
// @access  Private (All authenticated users)
router.post('/:commentId/reply', validateParams(['commentId']), validateBody([
  'content',
  'commentType'
]), async (req, res) => {
  try {
    const result = await commentService.replyToComment(
      req.params.commentId,
      req.user.id,
      req.body
    );
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to reply to comment',
      message: error.message
    });
  }
});

// @route   POST /api/comments/:commentId/reactions
// @desc    Add or update reaction to a comment
// @access  Private (All authenticated users)
router.post('/:commentId/reactions', validateParams(['commentId']), validateBody(['type']), async (req, res) => {
  try {
    const result = await commentService.addReaction(
      req.params.commentId,
      req.user.id,
      req.body.type
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to add reaction',
      message: error.message
    });
  }
});

// @route   DELETE /api/comments/:commentId/reactions
// @desc    Remove reaction from a comment
// @access  Private (All authenticated users)
router.delete('/:commentId/reactions', validateParams(['commentId']), async (req, res) => {
  try {
    const result = await commentService.removeReaction(req.params.commentId, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to remove reaction',
      message: error.message
    });
  }
});

// @route   POST /api/comments/:commentId/read
// @desc    Mark comment as read
// @access  Private (All authenticated users)
router.post('/:commentId/read', validateParams(['commentId']), async (req, res) => {
  try {
    const result = await commentService.markAsRead(req.params.commentId, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to mark comment as read',
      message: error.message
    });
  }
});

// @route   POST /api/comments/:commentId/flag
// @desc    Flag a comment for moderation
// @access  Private (All authenticated users)
router.post('/:commentId/flag', validateParams(['commentId']), validateBody(['reason']), async (req, res) => {
  try {
    const result = await commentService.flagComment(
      req.params.commentId,
      req.user.id,
      req.body.reason
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to flag comment',
      message: error.message
    });
  }
});

// @route   GET /api/comments/unread
// @desc    Get unread comments for current user
// @access  Private (All authenticated users)
router.get('/unread', async (req, res) => {
  try {
    const options = {
      limit: parseInt(req.query.limit) || 50,
      targetType: req.query.targetType,
      priority: req.query.priority,
      commentType: req.query.commentType
    };

    const result = await commentService.getUnreadComments(req.user.id, options);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get unread comments',
      message: error.message
    });
  }
});

// @route   GET /api/comments/requiring-response
// @desc    Get comments requiring response
// @access  Private (Healthcare providers only)
router.get('/requiring-response', requireRoles(['physiotherapist', 'doctor']), async (req, res) => {
  try {
    const options = {
      overdue: req.query.overdue === 'true',
      priority: req.query.priority,
      limit: parseInt(req.query.limit) || 50
    };

    const result = await commentService.getCommentsRequiringResponse(req.user.id, options);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get comments requiring response',
      message: error.message
    });
  }
});

// @route   GET /api/comments/analytics/:targetType/:targetId
// @desc    Get discussion analytics for a target
// @access  Private (Healthcare providers only)
router.get('/analytics/:targetType/:targetId',
  requireRoles(['physiotherapist', 'doctor']),
  validateParams(['targetType', 'targetId']),
  async (req, res) => {
    try {
      const result = await commentService.getDiscussionAnalytics(
        req.params.targetType,
        req.params.targetId,
        req.user.id
      );
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get discussion analytics',
        message: error.message
      });
    }
  }
);

// @route   GET /api/comments/search
// @desc    Search comments by content and metadata
// @access  Private (All authenticated users)
router.get('/search', validateQuery(), async (req, res) => {
  try {
    const options = {
      query: req.query.q,
      targetType: req.query.targetType,
      commentType: req.query.commentType,
      author: req.query.author,
      tags: req.query.tags,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sortBy || 'relevance'
    };

    const result = await commentService.searchComments(req.user.id, options);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to search comments',
      message: error.message
    });
  }
});

// @route   POST /api/comments/bulk-read
// @desc    Mark multiple comments as read
// @access  Private (All authenticated users)
router.post('/bulk-read', validateBody(['commentIds']), async (req, res) => {
  try {
    const result = await commentService.bulkMarkAsRead(req.body.commentIds, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to mark comments as read',
      message: error.message
    });
  }
});

// @route   GET /api/comments/user/:userId
// @desc    Get comments by a specific user (for moderation)
// @access  Private (Healthcare providers only)
router.get('/user/:userId',
  requireRoles(['physiotherapist', 'doctor']),
  validateParams(['userId']),
  async (req, res) => {
    try {
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc',
        status: req.query.status,
        commentType: req.query.commentType
      };

      const result = await commentService.getCommentsByUser(
        req.params.userId,
        req.user.id,
        options
      );
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get user comments',
        message: error.message
      });
    }
  }
);

// @route   PUT /api/comments/:commentId/resolve
// @desc    Mark a comment as resolved
// @access  Private (Healthcare providers only)
router.put('/:commentId/resolve',
  requireRoles(['physiotherapist', 'doctor']),
  validateParams(['commentId']),
  async (req, res) => {
    try {
      const result = await commentService.resolveComment(req.params.commentId, req.user.id);
      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        error: 'Failed to resolve comment',
        message: error.message
      });
    }
  }
);

module.exports = router;