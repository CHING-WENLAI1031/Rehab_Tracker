const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleMiddleware');
const rehabService = require('../../services/RehabService');
const progressService = require('../../services/ProgressService');
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
// @desc    Get physiotherapist dashboard data
// @access  Private (Physiotherapist only)
router.get('/dashboard', async (req, res) => {
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
router.get('/patients/:patientId', async (req, res) => {
  try {
    // TODO: Implement get patient details logic
    res.status(200).json({
      success: true,
      message: 'Get patient details endpoint - Coming soon',
      data: {
        endpoint: `GET /api/physiotherapists/patients/${req.params.patientId}`,
        status: 'Not implemented yet'
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
router.post('/feedback', async (req, res) => {
  try {
    // TODO: Implement add feedback logic
    res.status(201).json({
      success: true,
      message: 'Add feedback endpoint - Coming soon',
      data: {
        endpoint: 'POST /api/physiotherapists/feedback',
        status: 'Not implemented yet'
      }
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