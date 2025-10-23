const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/authMiddleware');
const { requireRoles } = require('../middleware/roleMiddleware');
const { validateQuery, validateParams, validateBody } = require('../middleware/validationMiddleware');
const doctorOversightService = require('../../services/DoctorOversightService');
const Surgery = require('../../models/Surgery');
const Comment = require('../../models/Comment');

// Apply authentication and doctor role requirement to all routes
router.use(authenticate);
router.use(requireRoles(['doctor']));

/**
 * Doctor Routes
 * Handles doctor-specific functionality including patient monitoring,
 * medical annotations, and surgery record management
 */

// @route   GET /api/doctors/dashboard
// @desc    Get doctor dashboard data
// @access  Private (Doctor only)
router.get('/dashboard', async (req, res) => {
  try {
    const result = await doctorOversightService.getOversightDashboard(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard data',
      message: error.message
    });
  }
});

// @route   GET /api/doctors/patients
// @desc    Get overview of all patients under care
// @access  Private (Doctor only)
router.get('/patients', async (req, res) => {
  try {
    const result = await doctorOversightService.getPatientPopulationOverview(req.user.id);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get patients overview',
      message: error.message
    });
  }
});

// @route   GET /api/doctors/patients/:patientId/recovery
// @desc    Get detailed recovery progress for specific patient
// @access  Private (Doctor only)
router.get('/patients/:patientId/recovery', validateParams(['patientId']), async (req, res) => {
  try {
    const result = await doctorOversightService.getPatientReport(req.user.id, req.params.patientId);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get recovery progress',
      message: error.message
    });
  }
});

// @route   POST /api/doctors/annotations
// @desc    Add medical annotation for patient
// @access  Private (Doctor only)
router.post('/annotations', validateBody([
  'patientId',
  'content',
  'category'
]), async (req, res) => {
  try {
    // Medical annotations are stored as comments with special type
    const annotation = new Comment({
      author: req.user.id,
      content: req.body.content,
      commentType: 'medical_annotation',
      targetType: 'patient',
      targetId: req.body.patientId,
      relatedPatient: req.body.patientId,
      visibility: req.body.visibility || 'team_visible',
      visibleTo: req.body.visibleTo || [],
      priority: req.body.priority || 'high',
      tags: req.body.tags || [],
      metadata: {
        category: req.body.category,
        clinicalSignificance: req.body.clinicalSignificance || 'moderate',
        requiresFollowUp: req.body.requiresFollowUp || false
      }
    });

    const savedAnnotation = await annotation.save();
    const populatedAnnotation = await Comment.findById(savedAnnotation._id)
      .populate('author', 'firstName lastName role specialization')
      .populate('relatedPatient', 'firstName lastName');

    res.status(201).json({
      success: true,
      data: {
        annotation: populatedAnnotation
      },
      message: 'Medical annotation added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add annotation',
      message: error.message
    });
  }
});

// @route   POST /api/doctors/surgery-records
// @desc    Input detailed surgery record
// @access  Private (Doctor only)
router.post('/surgery-records', validateBody([
  'patient',
  'surgeryType',
  'surgeryDate',
  'diagnosis'
]), async (req, res) => {
  try {
    const surgery = new Surgery({
      patient: req.body.patient,
      performingDoctor: req.user.id,
      surgeryType: req.body.surgeryType,
      surgeryDate: req.body.surgeryDate,
      diagnosis: req.body.diagnosis,
      procedure: req.body.procedure || {},
      complications: req.body.complications || [],
      medications: req.body.medications || [],
      postOpInstructions: req.body.postOpInstructions || '',
      expectedRecoveryTime: req.body.expectedRecoveryTime || {},
      followUpSchedule: req.body.followUpSchedule || [],
      notes: req.body.notes || '',
      status: 'completed'
    });

    const savedSurgery = await surgery.save();
    const populatedSurgery = await Surgery.findById(savedSurgery._id)
      .populate('patient', 'firstName lastName dateOfBirth gender')
      .populate('performingDoctor', 'firstName lastName specialization')
      .populate('assistingSurgeons', 'firstName lastName specialization');

    res.status(201).json({
      success: true,
      data: {
        surgery: populatedSurgery
      },
      message: 'Surgery record created successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add surgery record',
      message: error.message
    });
  }
});

// @route   GET /api/doctors/surgery-records/:patientId
// @desc    Get surgery records for specific patient
// @access  Private (Doctor only)
router.get('/surgery-records/:patientId', validateParams(['patientId']), async (req, res) => {
  try {
    const surgeries = await Surgery.find({
      patient: req.params.patientId
    })
      .populate('patient', 'firstName lastName dateOfBirth gender')
      .populate('performingDoctor', 'firstName lastName specialization')
      .populate('assistingSurgeons', 'firstName lastName specialization')
      .sort({ surgeryDate: -1 });

    res.status(200).json({
      success: true,
      data: {
        surgeries,
        totalRecords: surgeries.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get surgery records',
      message: error.message
    });
  }
});

// @route   PUT /api/doctors/surgery-records/:recordId
// @desc    Update existing surgery record
// @access  Private (Doctor only)
router.put('/surgery-records/:recordId', validateParams(['recordId']), async (req, res) => {
  try {
    const surgery = await Surgery.findById(req.params.recordId);

    if (!surgery) {
      return res.status(404).json({
        success: false,
        error: 'Surgery record not found'
      });
    }

    // Only the performing doctor can update the record
    if (surgery.performingDoctor.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'Only the performing doctor can update this record'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'diagnosis', 'procedure', 'complications', 'medications',
      'postOpInstructions', 'expectedRecoveryTime', 'followUpSchedule',
      'notes', 'status', 'outcomes'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        surgery[field] = req.body[field];
      }
    });

    const updatedSurgery = await surgery.save();
    const populatedSurgery = await Surgery.findById(updatedSurgery._id)
      .populate('patient', 'firstName lastName')
      .populate('performingDoctor', 'firstName lastName specialization');

    res.status(200).json({
      success: true,
      data: {
        surgery: populatedSurgery
      },
      message: 'Surgery record updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update surgery record',
      message: error.message
    });
  }
});

// @route   POST /api/doctors/recommendations
// @desc    Provide medical recommendations for patient
// @access  Private (Doctor only)
router.post('/recommendations', validateBody([
  'patientId',
  'content',
  'category'
]), async (req, res) => {
  try {
    // Recommendations are stored as comments with special type
    const recommendation = new Comment({
      author: req.user.id,
      content: req.body.content,
      commentType: 'clinical_recommendation',
      targetType: 'patient',
      targetId: req.body.patientId,
      relatedPatient: req.body.patientId,
      visibility: req.body.visibility || 'all_visible',
      visibleTo: req.body.visibleTo || [],
      priority: req.body.priority || 'high',
      tags: req.body.tags || [],
      metadata: {
        category: req.body.category,
        recommendationType: req.body.recommendationType || 'treatment',
        urgency: req.body.urgency || 'routine',
        expiresAt: req.body.expiresAt || null,
        requiresAcknowledgment: req.body.requiresAcknowledgment || true
      }
    });

    const savedRecommendation = await recommendation.save();
    const populatedRecommendation = await Comment.findById(savedRecommendation._id)
      .populate('author', 'firstName lastName role specialization')
      .populate('relatedPatient', 'firstName lastName');

    // Create notification for patient and assigned physiotherapists
    const notificationService = req.app.get('notificationService');
    if (notificationService) {
      await notificationService.createNotification({
        recipient: req.body.patientId,
        sender: req.user.id,
        type: 'critical_alert',
        category: 'health_alerts',
        title: 'New Medical Recommendation',
        message: `Your doctor has provided a new recommendation regarding ${req.body.category}`,
        priority: req.body.priority || 'high',
        actionUrl: `/recommendations/${savedRecommendation._id}`,
        actionText: 'View Recommendation',
        relatedEntity: {
          entityType: 'comment',
          entityId: savedRecommendation._id
        }
      });
    }

    res.status(201).json({
      success: true,
      data: {
        recommendation: populatedRecommendation
      },
      message: 'Medical recommendation added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add recommendation',
      message: error.message
    });
  }
});

// @route   GET /api/doctors/analytics/overview
// @desc    Get comprehensive analytics overview
// @access  Private (Doctor only)
router.get('/analytics/overview', async (req, res) => {
  try {
    const [
      performanceMetrics,
      treatmentOutcomes,
      physiotherapistMetrics,
      criticalAlerts
    ] = await Promise.all([
      doctorOversightService.getPerformanceMetrics(req.user.id),
      doctorOversightService.getTreatmentOutcomes(req.user.id),
      doctorOversightService.getPhysiotherapistMetrics(req.user.id),
      doctorOversightService.getCriticalAlerts(req.user.id)
    ]);

    res.status(200).json({
      success: true,
      data: {
        performanceMetrics,
        treatmentOutcomes,
        physiotherapistMetrics,
        criticalAlerts,
        generatedAt: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get analytics overview',
      message: error.message
    });
  }
});

module.exports = router;