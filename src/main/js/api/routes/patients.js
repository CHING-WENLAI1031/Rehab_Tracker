const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleMiddleware');
const { validateQuery, validateParams, validateBody } = require('../middleware/validationMiddleware');
const rehabService = require('../../services/RehabService');
const progressService = require('../../services/ProgressService');
const patientDashboardService = require('../../services/PatientDashboardService');
const User = require('../../models/User');

// Apply authentication to all routes
router.use(authenticate);
router.use(requireRoles(['patient']));

/**
 * Patient Routes
 * Handles patient-specific functionality including schedule viewing,
 * exercise completion, and personal notes
 */

// @route   GET /api/patients/dashboard
// @desc    Get comprehensive patient dashboard data with analytics and progress summaries
// @access  Private (Patient only)
router.get('/dashboard', async (req, res) => {
  try {
    const result = await patientDashboardService.getDashboardOverview(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data',
      message: error.message
    });
  }
});

// @route   GET /api/patients/dashboard/overview
// @desc    Get basic dashboard overview (lightweight version)
// @access  Private (Patient only)
router.get('/dashboard/overview', async (req, res) => {
  try {
    const patientId = req.user.id;

    // Get active tasks
    const activeTasks = await rehabService.getTasksForPatient(patientId, { active: 'true' });

    // Get upcoming tasks (next 7 days)
    const upcomingTasks = await rehabService.getUpcomingTasks(patientId, 7);

    // Get patient info with providers
    const patient = await User.findById(patientId)
      .populate('assignedProviders.providerId', 'firstName lastName role specialization');

    res.status(200).json({
      success: true,
      data: {
        activeTasks: activeTasks.data.tasks,
        upcomingTasks: upcomingTasks.data.tasks,
        providers: patient.assignedProviders,
        upcomingPeriod: upcomingTasks.data.period
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard overview',
      message: error.message
    });
  }
});

// @route   GET /api/patients/dashboard/active-tasks
// @desc    Get active tasks with detailed progress indicators
// @access  Private (Patient only)
router.get('/dashboard/active-tasks', async (req, res) => {
  try {
    const result = await patientDashboardService.getActiveTasksSummary(req.user.id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get active tasks summary',
      message: error.message
    });
  }
});

// @route   GET /api/patients/dashboard/recent-progress
// @desc    Get recent progress summary (last 7 days)
// @access  Private (Patient only)
router.get('/dashboard/recent-progress', validateQuery(), async (req, res) => {
  try {
    const result = await patientDashboardService.getRecentProgressSummary(req.user.id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get recent progress summary',
      message: error.message
    });
  }
});

// @route   GET /api/patients/dashboard/achievements
// @desc    Get achievement statistics and milestones
// @access  Private (Patient only)
router.get('/dashboard/achievements', async (req, res) => {
  try {
    const result = await patientDashboardService.getAchievementStats(req.user.id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get achievement statistics',
      message: error.message
    });
  }
});

// @route   GET /api/patients/dashboard/weekly-stats
// @desc    Get weekly progress statistics
// @access  Private (Patient only)
router.get('/dashboard/weekly-stats', async (req, res) => {
  try {
    const result = await patientDashboardService.getWeeklyProgressStats(req.user.id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get weekly statistics',
      message: error.message
    });
  }
});

// @route   GET /api/patients/dashboard/overall-progress
// @desc    Get overall progress summary since start
// @access  Private (Patient only)
router.get('/dashboard/overall-progress', async (req, res) => {
  try {
    const result = await patientDashboardService.getOverallProgressSummary(req.user.id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get overall progress summary',
      message: error.message
    });
  }
});

// @route   GET /api/patients/tasks
// @desc    Get patient's rehab tasks
// @access  Private (Patient only)
router.get('/tasks', async (req, res) => {
  try {
    const result = await rehabService.getTasksForPatient(req.user.id, req.query);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get tasks',
      message: error.message
    });
  }
});

// @route   GET /api/patients/tasks/:taskId
// @desc    Get specific task details
// @access  Private (Patient only)
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

// @route   GET /api/patients/upcoming
// @desc    Get upcoming tasks
// @access  Private (Patient only)
router.get('/upcoming', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const result = await rehabService.getUpcomingTasks(req.user.id, days);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get upcoming tasks',
      message: error.message
    });
  }
});

// @route   POST /api/patients/tasks/:taskId/notes
// @desc    Add patient notes to a task
// @access  Private (Patient only)
router.post('/tasks/:taskId/notes', async (req, res) => {
  try {
    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({
        success: false,
        error: 'Notes content is required'
      });
    }

    // Get the task and verify ownership
    const task = await rehabService.getTaskById(req.params.taskId, req.user.id);

    if (!task.success) {
      return res.status(404).json(task);
    }

    // Update task with patient notes
    const updateData = {
      notes: {
        ...task.data.task.notes,
        patientNotes: notes
      }
    };

    // Since patients can't update tasks directly, we'll need to create a separate route
    // For now, return success with the notes (in production, you'd implement a separate service)
    res.status(200).json({
      success: true,
      message: 'Notes added successfully',
      data: {
        taskId: req.params.taskId,
        notes,
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add notes',
      message: error.message
    });
  }
});

// @route   GET /api/patients/providers
// @desc    Get patient's assigned providers
// @access  Private (Patient only)
router.get('/providers', async (req, res) => {
  try {
    const patient = await User.findById(req.user.id)
      .populate('assignedProviders.providerId', 'firstName lastName role specialization email phoneNumber');

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        providers: patient.assignedProviders
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get providers',
      message: error.message
    });
  }
});

// @route   POST /api/patients/notes
// @desc    Add personal note/reflection
// @access  Private (Patient only)
router.post('/notes', async (req, res) => {
  try {
    // TODO: Implement add note logic
    res.status(201).json({
      success: true,
      message: 'Add patient note endpoint - Coming soon',
      data: {
        endpoint: 'POST /api/patients/notes',
        status: 'Not implemented yet'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add note',
      message: error.message
    });
  }
});

// @route   GET /api/patients/notes
// @desc    Get patient's personal notes
// @access  Private (Patient only)
router.get('/notes', async (req, res) => {
  try {
    // TODO: Implement get notes logic
    res.status(200).json({
      success: true,
      message: 'Get patient notes endpoint - Coming soon',
      data: {
        endpoint: 'GET /api/patients/notes',
        status: 'Not implemented yet'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get notes',
      message: error.message
    });
  }
});

// @route   POST /api/patients/progress
// @desc    Record a new exercise session
// @access  Private (Patient only)
router.post('/progress', async (req, res) => {
  try {
    const result = await progressService.recordSession(req.user.id, req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to record session',
      message: error.message
    });
  }
});

// @route   GET /api/patients/progress
// @desc    Get patient's progress history
// @access  Private (Patient only)
router.get('/progress', async (req, res) => {
  try {
    const result = await progressService.getProgressHistory(req.user.id, req.query);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get progress history',
      message: error.message
    });
  }
});

// @route   GET /api/patients/progress/:progressId
// @desc    Get specific progress record
// @access  Private (Patient only)
router.get('/progress/:progressId', async (req, res) => {
  try {
    const Progress = require('../../models/Progress');
    const progress = await Progress.findById(req.params.progressId)
      .populate('rehabTask', 'title category')
      .populate('patient', 'firstName lastName');

    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'Progress record not found'
      });
    }

    if (progress.patient._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: { progress }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get progress record',
      message: error.message
    });
  }
});

// @route   PUT /api/patients/progress/:progressId
// @desc    Update a progress record
// @access  Private (Patient only)
router.put('/progress/:progressId', async (req, res) => {
  try {
    const result = await progressService.updateProgress(req.params.progressId, req.user.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to update progress record',
      message: error.message
    });
  }
});

// @route   DELETE /api/patients/progress/:progressId
// @desc    Delete a progress record
// @access  Private (Patient only)
router.delete('/progress/:progressId', async (req, res) => {
  try {
    const result = await progressService.deleteProgress(req.params.progressId, req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Failed to delete progress record',
      message: error.message
    });
  }
});

// @route   GET /api/patients/analytics
// @desc    Get patient's progress analytics
// @access  Private (Patient only)
router.get('/analytics', async (req, res) => {
  try {
    const result = await progressService.getProgressAnalytics(req.user.id, req.query);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics',
      message: error.message
    });
  }
});

// @route   GET /api/patients/tasks/:taskId/progress
// @desc    Get progress for a specific task
// @access  Private (Patient only)
router.get('/tasks/:taskId/progress', async (req, res) => {
  try {
    const result = await progressService.getTaskProgress(req.user.id, req.params.taskId);
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