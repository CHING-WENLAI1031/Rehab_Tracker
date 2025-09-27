const User = require('../models/User');
const RehabTask = require('../models/RehabTask');
const Progress = require('../models/Progress');
const Comment = require('../models/Comment');
const mongoose = require('mongoose');

/**
 * Physiotherapist Workflow Service
 * Handles patient management, task assignment workflows, and physiotherapist-specific analytics
 */

class PhysiotherapistWorkflowService {
  /**
   * Get comprehensive physiotherapist dashboard with patient management overview
   * @param {String} physiotherapistId - Physiotherapist ID
   * @returns {Promise<Object>} Dashboard data with patient management info
   */
  async getWorkflowDashboard(physiotherapistId) {
    try {
      const [
        patientOverview,
        taskMetrics,
        recentActivity,
        upcomingDeadlines,
        patientAlerts,
        workloadAnalytics
      ] = await Promise.all([
        this.getPatientOverview(physiotherapistId),
        this.getTaskMetrics(physiotherapistId),
        this.getRecentActivity(physiotherapistId),
        this.getUpcomingDeadlines(physiotherapistId),
        this.getPatientAlerts(physiotherapistId),
        this.getWorkloadAnalytics(physiotherapistId)
      ]);

      return {
        success: true,
        data: {
          patientOverview,
          taskMetrics,
          recentActivity,
          upcomingDeadlines,
          patientAlerts,
          workloadAnalytics,
          lastUpdated: new Date()
        }
      };
    } catch (error) {
      throw new Error(`Failed to get workflow dashboard: ${error.message}`);
    }
  }

  /**
   * Get patient overview for physiotherapist
   * @param {String} physiotherapistId - Physiotherapist ID
   * @returns {Promise<Object>} Patient overview data
   */
  async getPatientOverview(physiotherapistId) {
    try {
      // Get all patients assigned to this physiotherapist
      const patients = await User.find({
        role: 'patient',
        'assignedProviders.providerId': physiotherapistId,
        isActive: true
      }).select('firstName lastName email dateOfBirth assignedProviders createdAt');

      // Get patient progress summaries
      const patientsWithProgress = await Promise.all(
        patients.map(async (patient) => {
          const [activeTasks, recentProgress, adherenceRate] = await Promise.all([
            RehabTask.countDocuments({
              assignedTo: patient._id,
              assignedBy: physiotherapistId,
              status: 'active'
            }),
            Progress.find({
              patient: patient._id,
              sessionDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
            }).countDocuments(),
            this.calculatePatientAdherence(patient._id, physiotherapistId)
          ]);

          return {
            ...patient.toObject(),
            metrics: {
              activeTasks,
              recentSessions: recentProgress,
              adherenceRate: Math.round(adherenceRate),
              riskLevel: this.assessPatientRisk(adherenceRate, activeTasks, recentProgress)
            }
          };
        })
      );

      // Categorize patients by risk level
      const patientsByRisk = {
        high: patientsWithProgress.filter(p => p.metrics.riskLevel === 'high'),
        medium: patientsWithProgress.filter(p => p.metrics.riskLevel === 'medium'),
        low: patientsWithProgress.filter(p => p.metrics.riskLevel === 'low')
      };

      return {
        totalPatients: patients.length,
        activePatients: patientsWithProgress.filter(p => p.metrics.recentSessions > 0).length,
        patients: patientsWithProgress,
        riskDistribution: {
          high: patientsByRisk.high.length,
          medium: patientsByRisk.medium.length,
          low: patientsByRisk.low.length
        },
        patientsByRisk
      };
    } catch (error) {
      throw new Error(`Failed to get patient overview: ${error.message}`);
    }
  }

  /**
   * Get task metrics for physiotherapist
   * @param {String} physiotherapistId - Physiotherapist ID
   * @returns {Promise<Object>} Task metrics data
   */
  async getTaskMetrics(physiotherapistId) {
    try {
      const [
        totalTasks,
        activeTasks,
        completedTasks,
        overdueTasks,
        tasksByCategory,
        avgCompletionTime
      ] = await Promise.all([
        RehabTask.countDocuments({ assignedBy: physiotherapistId }),
        RehabTask.countDocuments({ assignedBy: physiotherapistId, status: 'active' }),
        RehabTask.countDocuments({ assignedBy: physiotherapistId, status: 'completed' }),
        RehabTask.countDocuments({
          assignedBy: physiotherapistId,
          status: 'active',
          'schedule.endDate': { $lt: new Date() }
        }),
        this.getTaskCategoryBreakdown(physiotherapistId),
        this.calculateAverageTaskCompletionTime(physiotherapistId)
      ]);

      return {
        totalTasks,
        activeTasks,
        completedTasks,
        overdueTasks,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        tasksByCategory,
        avgCompletionTime,
        tasksNeedingAttention: overdueTasks,
        recentCreatedTasks: await this.getRecentTaskCount(physiotherapistId, 7)
      };
    } catch (error) {
      throw new Error(`Failed to get task metrics: ${error.message}`);
    }
  }

  /**
   * Get recent activity for physiotherapist
   * @param {String} physiotherapistId - Physiotherapist ID
   * @returns {Promise<Object>} Recent activity data
   */
  async getRecentActivity(physiotherapistId, limit = 20) {
    try {
      // Get recent tasks created
      const recentTasks = await RehabTask.find({ assignedBy: physiotherapistId })
        .populate('assignedTo', 'firstName lastName')
        .sort({ createdAt: -1 })
        .limit(5);

      // Get recent progress updates from assigned patients
      const assignedPatients = await User.find({
        role: 'patient',
        'assignedProviders.providerId': physiotherapistId
      }).select('_id');

      const patientIds = assignedPatients.map(p => p._id);

      const recentProgress = await Progress.find({
        patient: { $in: patientIds }
      })
        .populate('patient', 'firstName lastName')
        .populate('rehabTask', 'title')
        .sort({ sessionDate: -1 })
        .limit(10);

      // Get recent comments
      const recentComments = await Comment.find({
        author: physiotherapistId
      })
        .populate('patient', 'firstName lastName')
        .populate('rehabTask', 'title')
        .sort({ createdAt: -1 })
        .limit(5);

      // Combine and sort all activities
      const activities = [
        ...recentTasks.map(task => ({
          type: 'task_created',
          timestamp: task.createdAt,
          description: `Created task "${task.title}" for ${task.assignedTo.firstName} ${task.assignedTo.lastName}`,
          relatedData: task
        })),
        ...recentProgress.map(progress => ({
          type: 'patient_progress',
          timestamp: progress.sessionDate,
          description: `${progress.patient.firstName} ${progress.patient.lastName} completed "${progress.rehabTask.title}"`,
          relatedData: progress
        })),
        ...recentComments.map(comment => ({
          type: 'comment_added',
          timestamp: comment.createdAt,
          description: `Added comment for ${comment.patient.firstName} ${comment.patient.lastName}`,
          relatedData: comment
        }))
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);

      return {
        totalActivities: activities.length,
        activities,
        summary: {
          tasksCreatedToday: await this.getRecentTaskCount(physiotherapistId, 1),
          progressUpdatesReceived: recentProgress.length,
          commentsAdded: recentComments.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to get recent activity: ${error.message}`);
    }
  }

  /**
   * Get upcoming deadlines and schedule conflicts
   * @param {String} physiotherapistId - Physiotherapist ID
   * @returns {Promise<Object>} Upcoming deadlines data
   */
  async getUpcomingDeadlines(physiotherapistId, days = 14) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + days);

      const upcomingTasks = await RehabTask.find({
        assignedBy: physiotherapistId,
        status: 'active',
        'schedule.endDate': {
          $gte: new Date(),
          $lte: cutoffDate
        }
      })
        .populate('assignedTo', 'firstName lastName')
        .sort({ 'schedule.endDate': 1 });

      // Group by urgency
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const deadlineGroups = {
        overdue: upcomingTasks.filter(task => new Date(task.schedule.endDate) < now),
        today: upcomingTasks.filter(task => {
          const endDate = new Date(task.schedule.endDate);
          return endDate >= now && endDate < tomorrow;
        }),
        thisWeek: upcomingTasks.filter(task => {
          const endDate = new Date(task.schedule.endDate);
          return endDate >= tomorrow && endDate <= nextWeek;
        }),
        upcoming: upcomingTasks.filter(task => new Date(task.schedule.endDate) > nextWeek)
      };

      return {
        totalUpcoming: upcomingTasks.length,
        deadlineGroups,
        urgentCount: deadlineGroups.overdue.length + deadlineGroups.today.length,
        nextDeadline: upcomingTasks[0] || null,
        patientsWithDeadlines: [...new Set(upcomingTasks.map(t => t.assignedTo._id.toString()))].length
      };
    } catch (error) {
      throw new Error(`Failed to get upcoming deadlines: ${error.message}`);
    }
  }

  /**
   * Get patient alerts and notifications
   * @param {String} physiotherapistId - Physiotherapist ID
   * @returns {Promise<Object>} Patient alerts data
   */
  async getPatientAlerts(physiotherapistId) {
    try {
      const assignedPatients = await User.find({
        role: 'patient',
        'assignedProviders.providerId': physiotherapistId
      }).select('_id firstName lastName');

      const patientIds = assignedPatients.map(p => p._id);

      // Check for patients with no recent activity
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const inactivePatients = [];

      for (const patient of assignedPatients) {
        const recentProgress = await Progress.countDocuments({
          patient: patient._id,
          sessionDate: { $gte: sevenDaysAgo }
        });

        if (recentProgress === 0) {
          inactivePatients.push(patient);
        }
      }

      // Check for patients with poor adherence
      const lowAdherencePatients = [];
      for (const patient of assignedPatients) {
        const adherence = await this.calculatePatientAdherence(patient._id, physiotherapistId);
        if (adherence < 60) { // Less than 60% adherence
          lowAdherencePatients.push({
            ...patient.toObject(),
            adherenceRate: Math.round(adherence)
          });
        }
      }

      // Check for patients reporting high pain levels
      const highPainPatients = await Progress.find({
        patient: { $in: patientIds },
        sessionDate: { $gte: sevenDaysAgo },
        $or: [
          { 'assessments.painBefore': { $gte: 7 } },
          { 'assessments.painDuring': { $gte: 7 } },
          { 'assessments.painAfter': { $gte: 7 } }
        ]
      })
        .populate('patient', 'firstName lastName')
        .populate('rehabTask', 'title');

      // Check for overdue task completions
      const overdueTasks = await RehabTask.find({
        assignedBy: physiotherapistId,
        status: 'active',
        'schedule.endDate': { $lt: new Date() }
      })
        .populate('assignedTo', 'firstName lastName')
        .sort({ 'schedule.endDate': 1 });

      return {
        totalAlerts: inactivePatients.length + lowAdherencePatients.length + highPainPatients.length + overdueTasks.length,
        alerts: {
          inactivePatients: {
            count: inactivePatients.length,
            patients: inactivePatients
          },
          lowAdherence: {
            count: lowAdherencePatients.length,
            patients: lowAdherencePatients
          },
          highPainReports: {
            count: highPainPatients.length,
            reports: highPainPatients
          },
          overdueTasks: {
            count: overdueTasks.length,
            tasks: overdueTasks
          }
        },
        priorityLevel: this.calculateAlertPriority(inactivePatients.length, lowAdherencePatients.length, highPainPatients.length, overdueTasks.length)
      };
    } catch (error) {
      throw new Error(`Failed to get patient alerts: ${error.message}`);
    }
  }

  /**
   * Get workload analytics for physiotherapist
   * @param {String} physiotherapistId - Physiotherapist ID
   * @returns {Promise<Object>} Workload analytics data
   */
  async getWorkloadAnalytics(physiotherapistId) {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalPatients,
        totalActiveTasks,
        monthlyTasksCreated,
        avgTasksPerPatient,
        timeDistribution
      ] = await Promise.all([
        User.countDocuments({
          role: 'patient',
          'assignedProviders.providerId': physiotherapistId,
          isActive: true
        }),
        RehabTask.countDocuments({
          assignedBy: physiotherapistId,
          status: 'active'
        }),
        RehabTask.countDocuments({
          assignedBy: physiotherapistId,
          createdAt: { $gte: thirtyDaysAgo }
        }),
        this.calculateAverageTasksPerPatient(physiotherapistId),
        this.getTaskTimeDistribution(physiotherapistId)
      ]);

      const workloadScore = this.calculateWorkloadScore(totalPatients, totalActiveTasks, monthlyTasksCreated);

      return {
        totalPatients,
        totalActiveTasks,
        monthlyTasksCreated,
        avgTasksPerPatient: Math.round(avgTasksPerPatient * 10) / 10,
        workloadScore,
        workloadLevel: this.getWorkloadLevel(workloadScore),
        timeDistribution,
        recommendations: this.getWorkloadRecommendations(workloadScore, totalPatients, totalActiveTasks)
      };
    } catch (error) {
      throw new Error(`Failed to get workload analytics: ${error.message}`);
    }
  }

  /**
   * Get patient management details for a specific patient
   * @param {String} physiotherapistId - Physiotherapist ID
   * @param {String} patientId - Patient ID
   * @returns {Promise<Object>} Patient management data
   */
  async getPatientManagementDetails(physiotherapistId, patientId) {
    try {
      // Verify physiotherapist has access to this patient
      const patient = await User.findOne({
        _id: patientId,
        role: 'patient',
        'assignedProviders.providerId': physiotherapistId
      }).populate('assignedProviders.providerId', 'firstName lastName role');

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      const [
        activeTasks,
        completedTasks,
        progressHistory,
        recentComments,
        adherenceRate,
        improvementTrends
      ] = await Promise.all([
        RehabTask.find({
          assignedTo: patientId,
          assignedBy: physiotherapistId,
          status: 'active'
        }).sort({ createdAt: -1 }),
        RehabTask.find({
          assignedTo: patientId,
          assignedBy: physiotherapistId,
          status: 'completed'
        }).sort({ updatedAt: -1 }),
        Progress.find({ patient: patientId })
          .populate('rehabTask', 'title category')
          .sort({ sessionDate: -1 })
          .limit(20),
        Comment.find({
          patient: patientId,
          $or: [
            { author: physiotherapistId },
            { visibility: { $in: ['healthcare_team', 'all_assigned'] } }
          ]
        })
          .populate('author', 'firstName lastName role')
          .sort({ createdAt: -1 })
          .limit(10),
        this.calculatePatientAdherence(patientId, physiotherapistId),
        this.calculateImprovementTrends(patientId)
      ]);

      return {
        success: true,
        data: {
          patient: {
            ...patient.toObject(),
            adherenceRate: Math.round(adherenceRate),
            riskLevel: this.assessPatientRisk(adherenceRate, activeTasks.length, progressHistory.length)
          },
          tasks: {
            active: activeTasks,
            completed: completedTasks,
            totalCount: activeTasks.length + completedTasks.length
          },
          progressHistory,
          recentComments,
          improvementTrends,
          recommendations: this.generatePatientRecommendations(patient, adherenceRate, progressHistory, activeTasks)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get patient management details: ${error.message}`);
    }
  }

  // Helper methods

  async calculatePatientAdherence(patientId, physiotherapistId, days = 30) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalTasks, completedSessions] = await Promise.all([
      RehabTask.countDocuments({
        assignedTo: patientId,
        assignedBy: physiotherapistId,
        createdAt: { $gte: cutoffDate },
        status: { $in: ['active', 'completed'] }
      }),
      Progress.countDocuments({
        patient: patientId,
        sessionDate: { $gte: cutoffDate },
        completionStatus: 'completed'
      })
    ]);

    if (totalTasks === 0) return 100;
    return (completedSessions / totalTasks) * 100;
  }

  assessPatientRisk(adherenceRate, activeTasks, recentSessions) {
    if (adherenceRate < 50 || (activeTasks > 0 && recentSessions === 0)) return 'high';
    if (adherenceRate < 75 || recentSessions < 2) return 'medium';
    return 'low';
  }

  async getTaskCategoryBreakdown(physiotherapistId) {
    const tasks = await RehabTask.find({ assignedBy: physiotherapistId });
    return tasks.reduce((breakdown, task) => {
      const category = task.category || 'other';
      breakdown[category] = (breakdown[category] || 0) + 1;
      return breakdown;
    }, {});
  }

  async calculateAverageTaskCompletionTime(physiotherapistId) {
    const completedTasks = await RehabTask.find({
      assignedBy: physiotherapistId,
      status: 'completed'
    });

    if (completedTasks.length === 0) return 0;

    const totalTime = completedTasks.reduce((sum, task) => {
      const completion = new Date(task.updatedAt) - new Date(task.createdAt);
      return sum + completion;
    }, 0);

    return Math.round(totalTime / completedTasks.length / (1000 * 60 * 60 * 24)); // Days
  }

  async getRecentTaskCount(physiotherapistId, days) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return RehabTask.countDocuments({
      assignedBy: physiotherapistId,
      createdAt: { $gte: cutoffDate }
    });
  }

  calculateAlertPriority(inactive, lowAdherence, highPain, overdue) {
    const score = inactive * 1 + lowAdherence * 2 + highPain * 3 + overdue * 2;
    if (score >= 10) return 'critical';
    if (score >= 5) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  async calculateAverageTasksPerPatient(physiotherapistId) {
    const [totalTasks, totalPatients] = await Promise.all([
      RehabTask.countDocuments({ assignedBy: physiotherapistId }),
      User.countDocuments({
        role: 'patient',
        'assignedProviders.providerId': physiotherapistId
      })
    ]);

    return totalPatients > 0 ? totalTasks / totalPatients : 0;
  }

  async getTaskTimeDistribution(physiotherapistId) {
    const tasks = await RehabTask.find({ assignedBy: physiotherapistId });

    const distribution = {
      '0-30min': 0,
      '30-60min': 0,
      '60-90min': 0,
      '90min+': 0
    };

    // This would need actual duration data from task definitions
    // For now, return a placeholder distribution
    return distribution;
  }

  calculateWorkloadScore(patients, activeTasks, monthlyTasks) {
    // Simple scoring algorithm - can be enhanced based on requirements
    const patientScore = patients * 5;
    const taskScore = activeTasks * 2;
    const velocityScore = monthlyTasks * 1;

    return patientScore + taskScore + velocityScore;
  }

  getWorkloadLevel(score) {
    if (score >= 150) return 'very_high';
    if (score >= 100) return 'high';
    if (score >= 50) return 'medium';
    if (score >= 20) return 'low';
    return 'very_low';
  }

  getWorkloadRecommendations(score, patients, activeTasks) {
    const recommendations = [];

    if (score >= 150) {
      recommendations.push('Consider redistributing some patients to other physiotherapists');
      recommendations.push('Focus on completing overdue tasks to reduce backlog');
    }

    if (activeTasks > patients * 3) {
      recommendations.push('Review task assignment strategy - many tasks per patient');
    }

    if (score < 20) {
      recommendations.push('Capacity available for additional patients or tasks');
    }

    return recommendations;
  }

  async calculateImprovementTrends(patientId) {
    const progressData = await Progress.find({ patient: patientId })
      .sort({ sessionDate: 1 })
      .limit(50);

    if (progressData.length < 5) {
      return { hasData: false, message: 'Insufficient data for trend analysis' };
    }

    const recent = progressData.slice(-10);
    const older = progressData.slice(0, 10);

    const recentAvgPain = recent.reduce((sum, p) => sum + p.assessments.painAfter, 0) / recent.length;
    const olderAvgPain = older.reduce((sum, p) => sum + p.assessments.painAfter, 0) / older.length;

    const recentAvgMobility = recent.reduce((sum, p) => sum + p.assessments.mobilityAfter, 0) / recent.length;
    const olderAvgMobility = older.reduce((sum, p) => sum + p.assessments.mobilityAfter, 0) / older.length;

    return {
      hasData: true,
      painTrend: olderAvgPain - recentAvgPain, // Positive is improvement (less pain)
      mobilityTrend: recentAvgMobility - olderAvgMobility, // Positive is improvement
      overallTrend: this.calculateOverallTrend(recentAvgPain - olderAvgPain, recentAvgMobility - olderAvgMobility)
    };
  }

  calculateOverallTrend(painImprovement, mobilityImprovement) {
    const score = painImprovement + mobilityImprovement;
    if (score > 1) return 'improving';
    if (score < -1) return 'declining';
    return 'stable';
  }

  generatePatientRecommendations(patient, adherenceRate, progressHistory, activeTasks) {
    const recommendations = [];

    if (adherenceRate < 60) {
      recommendations.push({
        type: 'adherence',
        priority: 'high',
        message: 'Low adherence rate - consider simplifying task schedule or increasing support'
      });
    }

    if (activeTasks.length > 5) {
      recommendations.push({
        type: 'workload',
        priority: 'medium',
        message: 'High number of active tasks - consider prioritizing most important exercises'
      });
    }

    if (progressHistory.length > 0) {
      const recentProgress = progressHistory.slice(0, 5);
      const avgPain = recentProgress.reduce((sum, p) => sum + p.assessments.painAfter, 0) / recentProgress.length;

      if (avgPain > 7) {
        recommendations.push({
          type: 'pain_management',
          priority: 'high',
          message: 'High pain levels reported - review current treatment plan'
        });
      }
    }

    return recommendations;
  }
}

module.exports = new PhysiotherapistWorkflowService();