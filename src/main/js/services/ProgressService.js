const Progress = require('../models/Progress');
const RehabTask = require('../models/RehabTask');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * Progress Service
 * Handles progress tracking, session logging, analytics, and patient achievements
 */

class ProgressService {
  /**
   * Record a new exercise session
   * @param {String} patientId - Patient ID
   * @param {Object} sessionData - Session recording data
   * @returns {Promise<Object>} Created progress record
   */
  async recordSession(patientId, sessionData) {
    try {
      const {
        rehabTaskId,
        sessionDuration,
        completionStatus,
        completionPercentage,
        performance,
        assessments,
        notes,
        sessionDate,
        sessionContext
      } = sessionData;

      // Validate required fields
      if (!rehabTaskId || !sessionDuration || !completionStatus || !assessments) {
        throw new Error('Missing required fields: rehabTaskId, sessionDuration, completionStatus, assessments');
      }

      // Verify the rehab task exists and patient has access
      const task = await RehabTask.findById(rehabTaskId);
      if (!task) {
        throw new Error('Rehabilitation task not found');
      }

      if (task.assignedTo.toString() !== patientId.toString()) {
        throw new Error('You can only record progress for your own tasks');
      }

      // Validate assessments have required fields
      const requiredAssessments = ['painBefore', 'painDuring', 'painAfter', 'mobilityBefore', 'mobilityAfter', 'energyBefore', 'energyAfter'];
      for (const field of requiredAssessments) {
        if (assessments[field] === undefined || assessments[field] === null) {
          throw new Error(`Missing required assessment: ${field}`);
        }
      }

      // Create progress record
      const progressData = {
        patient: patientId,
        rehabTask: rehabTaskId,
        recordedBy: patientId,
        sessionDate: sessionDate ? new Date(sessionDate) : new Date(),
        sessionDuration: {
          planned: task.parameters?.duration?.value || 30,
          actual: sessionDuration
        },
        completionStatus,
        completionPercentage: completionPercentage || this.calculateCompletionPercentage(completionStatus),
        performance: performance || {
          effortLevel: 5,
          difficultyLevel: 5,
          formQuality: 'good',
          sets: []
        },
        assessments,
        sessionContext: sessionContext || {
          location: 'home',
          supervision: 'independent'
        },
        notes: {
          patientNotes: notes || '',
          observerNotes: '',
          recommendations: ''
        }
      };

      const progress = new Progress(progressData);
      await progress.save();

      // Update task completion count
      await RehabTask.findByIdAndUpdate(rehabTaskId, {
        $inc: { 'schedule.completedSessions': 1 }
      });

      // Populate for response
      await progress.populate([
        { path: 'patient', select: 'firstName lastName' },
        { path: 'rehabTask', select: 'title category' }
      ]);

      return {
        success: true,
        message: 'Session recorded successfully',
        data: {
          progress: progress.toJSON()
        }
      };

    } catch (error) {
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(e => e.message);
        throw new Error(`Validation failed: ${messages.join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Get progress history for a patient
   * @param {String} patientId - Patient ID
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Progress history
   */
  async getProgressHistory(patientId, filters = {}) {
    try {
      const query = { patient: patientId };

      // Apply filters
      if (filters.rehabTaskId) {
        query.rehabTask = filters.rehabTaskId;
      }

      if (filters.startDate) {
        query.sessionDate = { $gte: new Date(filters.startDate) };
      }

      if (filters.endDate) {
        query.sessionDate = query.sessionDate || {};
        query.sessionDate.$lte = new Date(filters.endDate);
      }

      if (filters.completionStatus) {
        query.completionStatus = filters.completionStatus;
      }

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 20;
      const skip = (page - 1) * limit;

      // Sort by session date (most recent first)
      const sort = { sessionDate: -1 };

      const [progressRecords, total] = await Promise.all([
        Progress.find(query)
          .populate('rehabTask', 'title category')
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Progress.countDocuments(query)
      ]);

      return {
        success: true,
        data: {
          progressRecords,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get progress analytics for a patient
   * @param {String} patientId - Patient ID
   * @param {Object} options - Analytics options
   * @returns {Promise<Object>} Progress analytics
   */
  async getProgressAnalytics(patientId, options = {}) {
    try {
      const { timeRange = 30, rehabTaskId } = options;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeRange);

      const matchQuery = {
        patient: new mongoose.Types.ObjectId(patientId),
        sessionDate: { $gte: startDate }
      };

      if (rehabTaskId) {
        matchQuery.rehabTask = new mongoose.Types.ObjectId(rehabTaskId);
      }

      // Overall statistics
      const overallStats = await Progress.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            averageCompletion: { $avg: '$completionPercentage' },
            averagePainBefore: { $avg: '$assessments.painBefore' },
            averagePainAfter: { $avg: '$assessments.painAfter' },
            averageMobilityBefore: { $avg: '$assessments.mobilityBefore' },
            averageMobilityAfter: { $avg: '$assessments.mobilityAfter' },
            averageEffort: { $avg: '$performance.effortLevel' },
            averageDifficulty: { $avg: '$performance.difficultyLevel' },
            completedSessions: {
              $sum: { $cond: [{ $eq: ['$completionStatus', 'completed'] }, 1, 0] }
            },
            skippedSessions: {
              $sum: { $cond: [{ $eq: ['$completionStatus', 'skipped'] }, 1, 0] }
            }
          }
        }
      ]);

      // Pain trend over time
      const painTrend = await Progress.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$sessionDate'
              }
            },
            averagePainBefore: { $avg: '$assessments.painBefore' },
            averagePainAfter: { $avg: '$assessments.painAfter' },
            painImprovement: {
              $avg: {
                $subtract: ['$assessments.painBefore', '$assessments.painAfter']
              }
            }
          }
        },
        { $sort: { '_id': 1 } }
      ]);

      // Completion rate by task
      const taskProgress = await Progress.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$rehabTask',
            totalSessions: { $sum: 1 },
            completedSessions: {
              $sum: { $cond: [{ $eq: ['$completionStatus', 'completed'] }, 1, 0] }
            },
            averageCompletion: { $avg: '$completionPercentage' },
            averagePainReduction: {
              $avg: {
                $subtract: ['$assessments.painBefore', '$assessments.painAfter']
              }
            }
          }
        },
        {
          $lookup: {
            from: 'rehabtasks',
            localField: '_id',
            foreignField: '_id',
            as: 'task'
          }
        },
        { $unwind: '$task' },
        {
          $addFields: {
            completionRate: {
              $multiply: [
                { $divide: ['$completedSessions', '$totalSessions'] },
                100
              ]
            }
          }
        }
      ]);

      return {
        success: true,
        data: {
          timeRange,
          summary: overallStats[0] || {
            totalSessions: 0,
            averageCompletion: 0,
            averagePainBefore: 0,
            averagePainAfter: 0,
            averageMobilityBefore: 0,
            averageMobilityAfter: 0,
            averageEffort: 0,
            averageDifficulty: 0,
            completedSessions: 0,
            skippedSessions: 0
          },
          painTrend,
          taskProgress
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get progress for a specific task
   * @param {String} patientId - Patient ID
   * @param {String} rehabTaskId - Rehab task ID
   * @returns {Promise<Object>} Task-specific progress
   */
  async getTaskProgress(patientId, rehabTaskId) {
    try {
      // Verify access to task
      const task = await RehabTask.findById(rehabTaskId);
      if (!task) {
        throw new Error('Task not found');
      }

      if (task.assignedTo.toString() !== patientId.toString()) {
        throw new Error('Access denied. You can only view progress for your own tasks');
      }

      // Get all progress records for this task
      const progressRecords = await Progress.find({
        patient: patientId,
        rehabTask: rehabTaskId
      }).sort({ sessionDate: -1 });

      // Calculate task-specific metrics
      const metrics = this.calculateTaskMetrics(progressRecords, task);

      return {
        success: true,
        data: {
          task: {
            _id: task._id,
            title: task.title,
            category: task.category,
            schedule: task.schedule
          },
          progressRecords,
          metrics
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Update an existing progress record
   * @param {String} progressId - Progress record ID
   * @param {String} patientId - Patient ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated progress record
   */
  async updateProgress(progressId, patientId, updateData) {
    try {
      const progress = await Progress.findById(progressId);

      if (!progress) {
        throw new Error('Progress record not found');
      }

      if (progress.patient.toString() !== patientId.toString()) {
        throw new Error('You can only update your own progress records');
      }

      // Prevent updating certain fields
      const restrictedFields = ['patient', 'rehabTask', '_id', 'createdAt'];
      restrictedFields.forEach(field => {
        delete updateData[field];
      });

      // Update progress record
      Object.assign(progress, updateData);
      await progress.save();

      await progress.populate([
        { path: 'patient', select: 'firstName lastName' },
        { path: 'rehabTask', select: 'title category' }
      ]);

      return {
        success: true,
        message: 'Progress record updated successfully',
        data: {
          progress: progress.toJSON()
        }
      };

    } catch (error) {
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(e => e.message);
        throw new Error(`Validation failed: ${messages.join(', ')}`);
      }
      throw error;
    }
  }

  /**
   * Delete a progress record
   * @param {String} progressId - Progress record ID
   * @param {String} patientId - Patient ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteProgress(progressId, patientId) {
    try {
      const progress = await Progress.findById(progressId);

      if (!progress) {
        throw new Error('Progress record not found');
      }

      if (progress.patient.toString() !== patientId.toString()) {
        throw new Error('You can only delete your own progress records');
      }

      // Update task completion count
      await RehabTask.findByIdAndUpdate(progress.rehabTask, {
        $inc: { 'schedule.completedSessions': -1 }
      });

      await Progress.findByIdAndDelete(progressId);

      return {
        success: true,
        message: 'Progress record deleted successfully'
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get progress for healthcare providers (physiotherapists/doctors)
   * @param {String} providerId - Provider ID
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Patient progress data
   */
  async getPatientProgressForProvider(providerId, filters = {}) {
    try {
      // Get provider's assigned patients
      const provider = await User.findById(providerId).populate('assignedPatients');
      const patientIds = provider.assignedPatients.map(p => p._id);

      const query = { patient: { $in: patientIds } };

      // Apply filters
      if (filters.patientId) {
        query.patient = filters.patientId;
      }

      if (filters.rehabTaskId) {
        query.rehabTask = filters.rehabTaskId;
      }

      if (filters.startDate) {
        query.sessionDate = { $gte: new Date(filters.startDate) };
      }

      if (filters.endDate) {
        query.sessionDate = query.sessionDate || {};
        query.sessionDate.$lte = new Date(filters.endDate);
      }

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 20;
      const skip = (page - 1) * limit;

      const [progressRecords, total] = await Promise.all([
        Progress.find(query)
          .populate('patient', 'firstName lastName')
          .populate('rehabTask', 'title category')
          .sort({ sessionDate: -1 })
          .skip(skip)
          .limit(limit),
        Progress.countDocuments(query)
      ]);

      return {
        success: true,
        data: {
          progressRecords,
          pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total,
            limit
          }
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Calculate completion percentage based on status
   * @param {String} completionStatus - Completion status
   * @returns {Number} Completion percentage
   */
  calculateCompletionPercentage(completionStatus) {
    switch (completionStatus) {
      case 'completed': return 100;
      case 'partially_completed': return 50;
      case 'skipped': return 0;
      case 'unable_to_complete': return 0;
      default: return 0;
    }
  }

  /**
   * Calculate task-specific metrics
   * @param {Array} progressRecords - Progress records for the task
   * @param {Object} task - Rehab task object
   * @returns {Object} Task metrics
   */
  calculateTaskMetrics(progressRecords, task) {
    if (!progressRecords.length) {
      return {
        totalSessions: 0,
        completedSessions: 0,
        completionRate: 0,
        averagePainReduction: 0,
        adherenceRate: 0,
        currentStreak: 0,
        longestStreak: 0
      };
    }

    const totalSessions = progressRecords.length;
    const completedSessions = progressRecords.filter(p => p.completionStatus === 'completed').length;
    const completionRate = (completedSessions / totalSessions) * 100;

    // Calculate pain reduction
    const painReductions = progressRecords
      .filter(p => p.assessments.painBefore !== undefined && p.assessments.painAfter !== undefined)
      .map(p => p.assessments.painBefore - p.assessments.painAfter);

    const averagePainReduction = painReductions.length
      ? painReductions.reduce((sum, reduction) => sum + reduction, 0) / painReductions.length
      : 0;

    // Calculate adherence rate (based on expected sessions vs actual)
    const daysSinceStart = Math.ceil((new Date() - new Date(task.schedule.startDate)) / (1000 * 60 * 60 * 24));
    const expectedSessions = Math.min(daysSinceStart, task.schedule.totalSessions || daysSinceStart);
    const adherenceRate = expectedSessions > 0 ? (totalSessions / expectedSessions) * 100 : 0;

    // Calculate streaks
    const { currentStreak, longestStreak } = this.calculateStreaks(progressRecords);

    return {
      totalSessions,
      completedSessions,
      completionRate: Math.round(completionRate * 100) / 100,
      averagePainReduction: Math.round(averagePainReduction * 100) / 100,
      adherenceRate: Math.round(adherenceRate * 100) / 100,
      currentStreak,
      longestStreak
    };
  }

  /**
   * Calculate current and longest completion streaks
   * @param {Array} progressRecords - Progress records (sorted by date desc)
   * @returns {Object} Streak information
   */
  calculateStreaks(progressRecords) {
    if (!progressRecords.length) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // Sort by date ascending for streak calculation
    const sortedRecords = [...progressRecords].sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate));

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < sortedRecords.length; i++) {
      if (sortedRecords[i].completionStatus === 'completed') {
        tempStreak++;
        if (i === sortedRecords.length - 1) {
          currentStreak = tempStreak;
        }
      } else {
        if (i === sortedRecords.length - 1) {
          currentStreak = 0;
        }
        tempStreak = 0;
      }

      longestStreak = Math.max(longestStreak, tempStreak);
    }

    return { currentStreak, longestStreak };
  }
}

module.exports = new ProgressService();