const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleMiddleware');
const { validateQuery, validateParams, validateBody } = require('../middleware/validationMiddleware');
const rehabService = require('../../services/RehabService');
const progressService = require('../../services/ProgressService');
const physiotherapistWorkflowService = require('../../services/PhysiotherapistWorkflowService');
const User = require('../../models/User');

// Apply authentication to all routes
router.use(authenticate);
router.use(requireRoles(['physiotherapist']));

/**
 * Physiotherapist Routes
 * Handles physiotherapist-specific functionality including patient management,
 * schedule creation/modification, and feedback comments
 */

// @route   GET /api/physiotherapists/dashboard
// @desc    Get comprehensive physiotherapist workflow dashboard
// @access  Private (Physiotherapist only)
router.get('/dashboard', async (req, res) => {
  try {
    const result = await physiotherapistWorkflowService.getWorkflowDashboard(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get workflow dashboard',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/dashboard/overview
// @desc    Get basic dashboard overview (lightweight version)
// @access  Private (Physiotherapist only)
router.get('/dashboard/overview', async (req, res) => {
  try {
    const physiotherapistId = req.user.id;

    // Get task statistics
    const stats = await rehabService.getTaskStatistics(physiotherapistId);

    // Get assigned patients count
    const physiotherapist = await User.findById(physiotherapistId).populate('assignedPatients');
    const patientCount = physiotherapist.assignedPatients.length;

    // Get recent tasks
    const recentTasks = await rehabService.getTasksByPhysiotherapist(physiotherapistId, {
      limit: 5,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    });

    res.status(200).json({
      success: true,
      data: {
        statistics: stats.data,
        patientCount,
        recentTasks: recentTasks.data.tasks
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/patients/overview
// @desc    Get patient overview with risk assessment and analytics
// @access  Private (Physiotherapist only)
router.get('/patients/overview', async (req, res) => {
  try {
    const result = await physiotherapistWorkflowService.getPatientOverview(req.user.id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get patient overview',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/alerts
// @desc    Get patient alerts and notifications
// @access  Private (Physiotherapist only)
router.get('/alerts', async (req, res) => {
  try {
    const result = await physiotherapistWorkflowService.getPatientAlerts(req.user.id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get patient alerts',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/deadlines
// @desc    Get upcoming deadlines and schedule conflicts
// @access  Private (Physiotherapist only)
router.get('/deadlines', validateQuery(), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 14;
    const result = await physiotherapistWorkflowService.getUpcomingDeadlines(req.user.id, days);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get upcoming deadlines',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/workload
// @desc    Get workload analytics and capacity planning
// @access  Private (Physiotherapist only)
router.get('/workload', async (req, res) => {
  try {
    const result = await physiotherapistWorkflowService.getWorkloadAnalytics(req.user.id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get workload analytics',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/activity
// @desc    Get recent activity feed
// @access  Private (Physiotherapist only)
router.get('/activity', validateQuery(), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const result = await physiotherapistWorkflowService.getRecentActivity(req.user.id, limit);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get recent activity',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/patients/:patientId/management
// @desc    Get detailed patient management information
// @access  Private (Physiotherapist only)
router.get('/patients/:patientId/management', validateParams(['patientId']), async (req, res) => {
  try {
    const result = await physiotherapistWorkflowService.getPatientManagementDetails(req.user.id, req.params.patientId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get patient management details',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/patients
// @desc    Get list of assigned patients
// @access  Private (Physiotherapist only)
router.get('/patients', async (req, res) => {
  try {
    const physiotherapist = await User.findById(req.user.id)
      .populate('assignedPatients', 'firstName lastName email phoneNumber lastLogin');

    if (!physiotherapist) {
      return res.status(404).json({
        success: false,
        error: 'Physiotherapist not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        patients: physiotherapist.assignedPatients
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get patients',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/patients/:patientId
// @desc    Get specific patient details and progress
// @access  Private (Physiotherapist only)
router.get('/patients/:patientId', validateParams(['patientId']), async (req, res) => {
  try {
    // Verify patient is assigned to this physiotherapist
    const physiotherapist = await User.findById(req.user.id);
    if (!physiotherapist.assignedPatients.some(p => p.toString() === req.params.patientId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Patient is not assigned to you'
      });
    }

    // Get patient details
    const patient = await User.findById(req.params.patientId)
      .populate('assignedProviders.providerId', 'firstName lastName role specialization')
      .select('-password -tokens');

    if (!patient || patient.role !== 'patient') {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    // Get active and recent tasks
    const [activeTasks, recentTasks, recentProgress] = await Promise.all([
      rehabService.getTasksForPatient(req.params.patientId, { active: 'true', limit: 10 }),
      rehabService.getTasksForPatient(req.params.patientId, { limit: 5, sortBy: 'updatedAt', sortOrder: 'desc' }),
      progressService.getProgressHistory(req.params.patientId, { limit: 10 })
    ]);

    // Get progress analytics
    const analytics = await progressService.getProgressAnalytics(req.params.patientId, {});

    res.status(200).json({
      success: true,
      data: {
        patient,
        activeTasks: activeTasks.data?.tasks || [],
        recentTasks: recentTasks.data?.tasks || [],
        recentProgress: recentProgress.data?.sessions || [],
        analytics: analytics.data || {}
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get patient details',
      message: error.message
    });
  }
});

// @route   POST /api/physiotherapists/tasks
// @desc    Create rehab task for patient
// @access  Private (Physiotherapist only)
router.post('/tasks', async (req, res) => {
  try {
    const result = await rehabService.createTask(req.user.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to create task',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/tasks
// @desc    Get all tasks created by physiotherapist
// @access  Private (Physiotherapist only)
router.get('/tasks', async (req, res) => {
  try {
    const result = await rehabService.getTasksByPhysiotherapist(req.user.id, req.query);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get tasks',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/tasks/:taskId
// @desc    Get specific task details
// @access  Private (Physiotherapist only)
router.get('/tasks/:taskId', async (req, res) => {
  try {
    const result = await rehabService.getTaskById(req.params.taskId, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get task',
      message: error.message
    });
  }
});

// @route   PUT /api/physiotherapists/tasks/:taskId
// @desc    Update existing rehab task
// @access  Private (Physiotherapist only)
router.put('/tasks/:taskId', async (req, res) => {
  try {
    const result = await rehabService.updateTask(req.params.taskId, req.user.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to update task',
      message: error.message
    });
  }
});

// @route   DELETE /api/physiotherapists/tasks/:taskId
// @desc    Delete rehab task
// @access  Private (Physiotherapist only)
router.delete('/tasks/:taskId', async (req, res) => {
  try {
    const result = await rehabService.deleteTask(req.params.taskId, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to delete task',
      message: error.message
    });
  }
});

// @route   POST /api/physiotherapists/tasks/:taskId/activate
// @desc    Activate a draft task
// @access  Private (Physiotherapist only)
router.post('/tasks/:taskId/activate', async (req, res) => {
  try {
    const result = await rehabService.activateTask(req.params.taskId, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to activate task',
      message: error.message
    });
  }
});

// @route   POST /api/physiotherapists/feedback
// @desc    Add feedback comment for patient
// @access  Private (Physiotherapist only)
router.post('/feedback', validateBody([
  'patientId',
  'content'
]), async (req, res) => {
  try {
    // Verify patient is assigned to this physiotherapist
    const physiotherapist = await User.findById(req.user.id);
    if (!physiotherapist.assignedPatients.some(p => p.toString() === req.body.patientId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Patient is not assigned to you'
      });
    }

    const Comment = require('../../models/Comment');

    // Create feedback comment
    const feedback = new Comment({
      author: req.user.id,
      content: req.body.content,
      commentType: req.body.commentType || 'feedback',
      targetType: req.body.targetType || 'patient',
      targetId: req.body.targetId || req.body.patientId,
      relatedPatient: req.body.patientId,
      visibility: req.body.visibility || 'patient_visible',
      visibleTo: [
        {
          user: req.body.patientId,
          role: 'patient'
        },
        {
          user: req.user.id,
          role: 'physiotherapist'
        }
      ],
      priority: req.body.priority || 'normal',
      tags: req.body.tags || [],
      metadata: {
        feedbackType: req.body.feedbackType || 'general',
        category: req.body.category || 'progress_review',
        requiresResponse: req.body.requiresResponse || false
      }
    });

    const savedFeedback = await feedback.save();
    const populatedFeedback = await Comment.findById(savedFeedback._id)
      .populate('author', 'firstName lastName role specialization')
      .populate('relatedPatient', 'firstName lastName');

    // Create notification for patient
    const notificationService = req.app.get('notificationService');
    if (notificationService) {
      await notificationService.createNotification({
        recipient: req.body.patientId,
        sender: req.user.id,
        type: 'feedback_request',
        category: 'communication',
        title: 'New Feedback from Your Physiotherapist',
        message: `Your physiotherapist has provided feedback on your progress`,
        priority: 'normal',
        actionUrl: `/feedback/${savedFeedback._id}`,
        actionText: 'View Feedback',
        relatedEntity: {
          entityType: 'comment',
          entityId: savedFeedback._id
        }
      });
    }

    res.status(201).json({
      success: true,
      data: {
        feedback: populatedFeedback
      },
      message: 'Feedback added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add feedback',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/analytics
// @desc    Get analytics data for assigned patients
// @access  Private (Physiotherapist only)
router.get('/analytics', async (req, res) => {
  try {
    const result = await rehabService.getTaskStatistics(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/search
// @desc    Search tasks
// @access  Private (Physiotherapist only)
router.get('/search', async (req, res) => {
  try {
    const result = await rehabService.searchTasks(req.query, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to search tasks',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/progress
// @desc    Get progress data for assigned patients
// @access  Private (Physiotherapist only)
router.get('/progress', async (req, res) => {
  try {
    const result = await progressService.getPatientProgressForProvider(req.user.id, req.query);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get patient progress',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/patients/:patientId/progress
// @desc    Get specific patient's progress
// @access  Private (Physiotherapist only)
router.get('/patients/:patientId/progress', async (req, res) => {
  try {
    const filters = { patientId: req.params.patientId, ...req.query };
    const result = await progressService.getPatientProgressForProvider(req.user.id, filters);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get patient progress',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/patients/:patientId/analytics
// @desc    Get analytics for a specific patient
// @access  Private (Physiotherapist only)
router.get('/patients/:patientId/analytics', async (req, res) => {
  try {
    // Verify patient is assigned to this physiotherapist
    const physiotherapist = await User.findById(req.user.id);
    if (!physiotherapist.assignedPatients.includes(req.params.patientId)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Patient is not assigned to you'
      });
    }

    const result = await progressService.getProgressAnalytics(req.params.patientId, req.query);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get patient analytics',
      message: error.message
    });
  }
});

// @route   GET /api/physiotherapists/tasks/:taskId/progress
// @desc    Get progress for a specific task
// @access  Private (Physiotherapist only)
router.get('/tasks/:taskId/progress', async (req, res) => {
  try {
    // First verify the task belongs to this physiotherapist
    const task = await rehabService.getTaskById(req.params.taskId, req.user.id);
    if (!task.success) {
      return res.status(404).json(task);
    }

    const result = await progressService.getTaskProgress(task.data.task.assignedTo._id, req.params.taskId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get task progress',
      message: error.message
    });
  }
});

module.exports = router;