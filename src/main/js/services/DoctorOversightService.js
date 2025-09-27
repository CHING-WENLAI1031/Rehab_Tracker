const User = require('../models/User');
const RehabTask = require('../models/RehabTask');
const Progress = require('../models/Progress');
const Comment = require('../models/Comment');
const Surgery = require('../models/Surgery');
const mongoose = require('mongoose');

/**
 * Doctor Oversight Service
 * Provides comprehensive monitoring, reporting, and oversight capabilities for doctors
 * to track patient progress across multiple physiotherapists and treatment plans
 */

class DoctorOversightService {
  /**
   * Get comprehensive doctor oversight dashboard
   * @param {String} doctorId - Doctor ID
   * @returns {Promise<Object>} Oversight dashboard data
   */
  async getOversightDashboard(doctorId) {
    try {
      const [
        patientPopulation,
        treatmentOutcomes,
        physiotherapistMetrics,
        criticalAlerts,
        performanceMetrics,
        recentActivities
      ] = await Promise.all([
        this.getPatientPopulationOverview(doctorId),
        this.getTreatmentOutcomes(doctorId),
        this.getPhysiotherapistMetrics(doctorId),
        this.getCriticalAlerts(doctorId),
        this.getPerformanceMetrics(doctorId),
        this.getRecentActivities(doctorId)
      ]);

      return {
        success: true,
        data: {
          patientPopulation,
          treatmentOutcomes,
          physiotherapistMetrics,
          criticalAlerts,
          performanceMetrics,
          recentActivities,
          lastUpdated: new Date()
        }
      };
    } catch (error) {
      throw new Error(`Failed to get oversight dashboard: ${error.message}`);
    }
  }

  /**
   * Get patient population overview for doctor
   * @param {String} doctorId - Doctor ID
   * @returns {Promise<Object>} Patient population data
   */
  async getPatientPopulationOverview(doctorId) {
    try {
      // Get all patients under this doctor's care
      const patients = await User.find({
        role: 'patient',
        'assignedProviders.providerId': doctorId,
        isActive: true
      }).populate('assignedProviders.providerId', 'firstName lastName role');

      // Get patient demographics and statistics
      const totalPatients = patients.length;
      const demographics = this.calculateDemographics(patients);

      // Get patients by treatment phase
      const patientsByPhase = await this.categorizePatientsByTreatmentPhase(patients, doctorId);

      // Get risk stratification
      const riskStratification = await this.stratifyPatientsByRisk(patients, doctorId);

      // Get recent admissions/discharges
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentAdmissions = patients.filter(p => new Date(p.createdAt) >= thirtyDaysAgo);

      return {
        totalPatients,
        demographics,
        patientsByPhase,
        riskStratification,
        recentAdmissions: recentAdmissions.length,
        averageActiveTasksPerPatient: await this.calculateAverageActiveTasksPerPatient(patients, doctorId),
        patientDistributionByProvider: await this.getPatientDistributionByProvider(patients, doctorId)
      };
    } catch (error) {
      throw new Error(`Failed to get patient population overview: ${error.message}`);
    }
  }

  /**
   * Get treatment outcomes analytics
   * @param {String} doctorId - Doctor ID
   * @returns {Promise<Object>} Treatment outcomes data
   */
  async getTreatmentOutcomes(doctorId) {
    try {
      const patients = await User.find({
        role: 'patient',
        'assignedProviders.providerId': doctorId
      }).select('_id');

      const patientIds = patients.map(p => p._id);

      // Get all progress data for analysis
      const allProgress = await Progress.find({
        patient: { $in: patientIds }
      }).populate('patient', 'firstName lastName').sort({ sessionDate: 1 });

      // Calculate improvement metrics
      const improvementMetrics = this.calculateImprovementMetrics(allProgress);

      // Get completion rates
      const completionRates = await this.calculateCompletionRates(patientIds, doctorId);

      // Get treatment duration analytics
      const durationAnalytics = await this.calculateTreatmentDurationAnalytics(patientIds, doctorId);

      // Get comparative outcomes by category
      const outcomesByCategory = await this.getOutcomesByCategory(patientIds);

      // Get patient satisfaction metrics (if available)
      const satisfactionMetrics = await this.calculatePatientSatisfactionMetrics(patientIds);

      return {
        improvementMetrics,
        completionRates,
        durationAnalytics,
        outcomesByCategory,
        satisfactionMetrics,
        benchmarkComparisons: this.generateBenchmarkComparisons(improvementMetrics, completionRates)
      };
    } catch (error) {
      throw new Error(`Failed to get treatment outcomes: ${error.message}`);
    }
  }

  /**
   * Get physiotherapist performance metrics
   * @param {String} doctorId - Doctor ID
   * @returns {Promise<Object>} Physiotherapist metrics data
   */
  async getPhysiotherapistMetrics(doctorId) {
    try {
      // Get all physiotherapists working with this doctor's patients
      const physiotherapists = await User.find({
        role: 'physiotherapist',
        isActive: true
      });

      const physiotherapistMetrics = await Promise.all(
        physiotherapists.map(async (pt) => {
          // Get shared patients
          const sharedPatients = await User.find({
            role: 'patient',
            'assignedProviders.providerId': { $all: [doctorId, pt._id] }
          });

          if (sharedPatients.length === 0) return null;

          const sharedPatientIds = sharedPatients.map(p => p._id);

          const [
            activeTasks,
            completedTasks,
            patientOutcomes,
            adherenceRates,
            responseTime
          ] = await Promise.all([
            RehabTask.countDocuments({
              assignedBy: pt._id,
              assignedTo: { $in: sharedPatientIds },
              status: 'active'
            }),
            RehabTask.countDocuments({
              assignedBy: pt._id,
              assignedTo: { $in: sharedPatientIds },
              status: 'completed'
            }),
            this.calculatePhysiotherapistPatientOutcomes(pt._id, sharedPatientIds),
            this.calculatePhysiotherapistAdherenceRates(pt._id, sharedPatientIds),
            this.calculatePhysiotherapistResponseTime(pt._id, sharedPatientIds)
          ]);

          return {
            physiotherapist: {
              id: pt._id,
              name: `${pt.firstName} ${pt.lastName}`,
              email: pt.email,
              specialization: pt.specialization
            },
            sharedPatients: sharedPatients.length,
            activeTasks,
            completedTasks,
            patientOutcomes,
            adherenceRates,
            responseTime,
            performanceScore: this.calculatePhysiotherapistScore(
              patientOutcomes,
              adherenceRates,
              activeTasks + completedTasks,
              responseTime
            )
          };
        })
      );

      // Filter out null results and sort by performance
      const validMetrics = physiotherapistMetrics
        .filter(m => m !== null)
        .sort((a, b) => b.performanceScore - a.performanceScore);

      return {
        totalPhysiotherapists: validMetrics.length,
        metrics: validMetrics,
        teamAverages: this.calculateTeamAverages(validMetrics),
        topPerformers: validMetrics.slice(0, 3),
        needsAttention: validMetrics.filter(m => m.performanceScore < 70)
      };
    } catch (error) {
      throw new Error(`Failed to get physiotherapist metrics: ${error.message}`);
    }
  }

  /**
   * Get critical alerts requiring doctor attention
   * @param {String} doctorId - Doctor ID
   * @returns {Promise<Object>} Critical alerts data
   */
  async getCriticalAlerts(doctorId) {
    try {
      const patients = await User.find({
        role: 'patient',
        'assignedProviders.providerId': doctorId
      }).select('_id firstName lastName');

      const patientIds = patients.map(p => p._id);

      // Critical alerts detection
      const [
        patientsWithPoorOutcomes,
        patientsWithHighPain,
        patientsWithNoProgress,
        overdueTasks,
        missedAppointments
      ] = await Promise.all([
        this.identifyPatientsWithPoorOutcomes(patientIds),
        this.identifyPatientsWithHighPainLevels(patientIds),
        this.identifyPatientsWithNoRecentProgress(patientIds),
        this.identifyOverdueTasks(patientIds, doctorId),
        this.identifyMissedAppointments(patientIds)
      ]);

      const alerts = [
        ...patientsWithPoorOutcomes.map(p => ({
          type: 'poor_outcomes',
          priority: 'critical',
          patient: p,
          message: 'Patient showing poor treatment outcomes',
          actionRequired: 'Review treatment plan'
        })),
        ...patientsWithHighPain.map(p => ({
          type: 'high_pain',
          priority: 'high',
          patient: p.patient,
          message: `Consistently high pain levels reported (avg: ${p.avgPain})`,
          actionRequired: 'Consider pain management intervention'
        })),
        ...patientsWithNoProgress.map(p => ({
          type: 'no_progress',
          priority: 'medium',
          patient: p,
          message: 'No progress sessions recorded in 2+ weeks',
          actionRequired: 'Check patient engagement'
        })),
        ...overdueTasks.map(task => ({
          type: 'overdue_tasks',
          priority: 'high',
          patient: task.assignedTo,
          message: `Task "${task.title}" overdue by ${this.calculateDaysOverdue(task.schedule.endDate)} days`,
          actionRequired: 'Review task timeline'
        }))
      ].sort((a, b) => {
        const priority = { critical: 3, high: 2, medium: 1 };
        return priority[b.priority] - priority[a.priority];
      });

      return {
        totalAlerts: alerts.length,
        criticalCount: alerts.filter(a => a.priority === 'critical').length,
        highCount: alerts.filter(a => a.priority === 'high').length,
        mediumCount: alerts.filter(a => a.priority === 'medium').length,
        alerts: alerts.slice(0, 20), // Top 20 most critical
        alertsByType: this.groupAlertsByType(alerts),
        trendAnalysis: await this.calculateAlertTrends(doctorId)
      };
    } catch (error) {
      throw new Error(`Failed to get critical alerts: ${error.message}`);
    }
  }

  /**
   * Get performance metrics and KPIs
   * @param {String} doctorId - Doctor ID
   * @returns {Promise<Object>} Performance metrics data
   */
  async getPerformanceMetrics(doctorId) {
    try {
      const patients = await User.find({
        role: 'patient',
        'assignedProviders.providerId': doctorId
      }).select('_id');

      const patientIds = patients.map(p => p._id);

      const [
        overallPatientSatisfaction,
        averageRecoveryTime,
        treatmentSuccessRate,
        readmissionRate,
        costEffectiveness,
        qualityMetrics
      ] = await Promise.all([
        this.calculateOverallPatientSatisfaction(patientIds),
        this.calculateAverageRecoveryTime(patientIds, doctorId),
        this.calculateTreatmentSuccessRate(patientIds, doctorId),
        this.calculateReadmissionRate(patientIds),
        this.calculateCostEffectiveness(patientIds, doctorId),
        this.calculateQualityMetrics(patientIds, doctorId)
      ]);

      // Compare with historical data and benchmarks
      const historicalComparison = await this.getHistoricalComparison(doctorId);
      const benchmarkComparison = this.getBenchmarkComparison({
        patientSatisfaction: overallPatientSatisfaction,
        recoveryTime: averageRecoveryTime,
        successRate: treatmentSuccessRate
      });

      return {
        currentPeriod: {
          overallPatientSatisfaction,
          averageRecoveryTime,
          treatmentSuccessRate,
          readmissionRate,
          costEffectiveness,
          qualityMetrics
        },
        historicalComparison,
        benchmarkComparison,
        performanceScore: this.calculateOverallPerformanceScore({
          patientSatisfaction: overallPatientSatisfaction,
          successRate: treatmentSuccessRate,
          recoveryTime: averageRecoveryTime
        }),
        recommendations: this.generatePerformanceRecommendations({
          overallPatientSatisfaction,
          treatmentSuccessRate,
          readmissionRate
        })
      };
    } catch (error) {
      throw new Error(`Failed to get performance metrics: ${error.message}`);
    }
  }

  /**
   * Get recent activities and updates
   * @param {String} doctorId - Doctor ID
   * @param {Number} limit - Number of activities to return
   * @returns {Promise<Object>} Recent activities data
   */
  async getRecentActivities(doctorId, limit = 50) {
    try {
      const patients = await User.find({
        role: 'patient',
        'assignedProviders.providerId': doctorId
      }).select('_id');

      const patientIds = patients.map(p => p._id);

      // Get recent progress updates
      const recentProgress = await Progress.find({
        patient: { $in: patientIds }
      })
        .populate('patient', 'firstName lastName')
        .populate('rehabTask', 'title category assignedBy')
        .populate('rehabTask.assignedBy', 'firstName lastName role')
        .sort({ sessionDate: -1 })
        .limit(20);

      // Get recent task creations/updates
      const recentTasks = await RehabTask.find({
        assignedTo: { $in: patientIds }
      })
        .populate('assignedTo', 'firstName lastName')
        .populate('assignedBy', 'firstName lastName role')
        .sort({ updatedAt: -1 })
        .limit(15);

      // Get recent comments
      const recentComments = await Comment.find({
        patient: { $in: patientIds }
      })
        .populate('patient', 'firstName lastName')
        .populate('author', 'firstName lastName role')
        .sort({ createdAt: -1 })
        .limit(15);

      // Combine and format activities
      const activities = [
        ...recentProgress.map(progress => ({
          type: 'progress_update',
          timestamp: progress.sessionDate,
          description: `${progress.patient.firstName} ${progress.patient.lastName} completed "${progress.rehabTask.title}"`,
          details: {
            completionStatus: progress.completionStatus,
            painReduction: progress.assessments.painBefore - progress.assessments.painAfter,
            sessionDuration: progress.sessionDuration
          },
          relatedData: progress,
          priority: this.assessActivityPriority('progress_update', progress)
        })),
        ...recentTasks.map(task => ({
          type: 'task_assignment',
          timestamp: task.createdAt,
          description: `New task "${task.title}" assigned to ${task.assignedTo.firstName} ${task.assignedTo.lastName} by ${task.assignedBy.firstName} ${task.assignedBy.lastName}`,
          details: {
            category: task.category,
            status: task.status,
            dueDate: task.schedule.endDate
          },
          relatedData: task,
          priority: this.assessActivityPriority('task_assignment', task)
        })),
        ...recentComments.map(comment => ({
          type: 'comment_added',
          timestamp: comment.createdAt,
          description: `${comment.author.firstName} ${comment.author.lastName} (${comment.author.role}) added a comment for ${comment.patient.firstName} ${comment.patient.lastName}`,
          details: {
            commentType: comment.type,
            visibility: comment.visibility
          },
          relatedData: comment,
          priority: this.assessActivityPriority('comment_added', comment)
        }))
      ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);

      return {
        totalActivities: activities.length,
        activities,
        summary: {
          progressUpdates: recentProgress.length,
          taskAssignments: recentTasks.length,
          comments: recentComments.length,
          highPriorityActivities: activities.filter(a => a.priority === 'high').length
        }
      };
    } catch (error) {
      throw new Error(`Failed to get recent activities: ${error.message}`);
    }
  }

  /**
   * Get comprehensive patient report for doctor review
   * @param {String} doctorId - Doctor ID
   * @param {String} patientId - Patient ID
   * @returns {Promise<Object>} Patient report data
   */
  async getPatientReport(doctorId, patientId) {
    try {
      // Verify doctor has access to this patient
      const patient = await User.findOne({
        _id: patientId,
        role: 'patient',
        'assignedProviders.providerId': doctorId
      }).populate('assignedProviders.providerId', 'firstName lastName role specialization');

      if (!patient) {
        throw new Error('Patient not found or access denied');
      }

      const [
        treatmentHistory,
        progressAnalytics,
        currentStatus,
        riskAssessment,
        providerCollaboration,
        recommendations
      ] = await Promise.all([
        this.getPatientTreatmentHistory(patientId, doctorId),
        this.getPatientProgressAnalytics(patientId),
        this.getPatientCurrentStatus(patientId, doctorId),
        this.assessPatientRisk(patientId),
        this.getProviderCollaboration(patientId, doctorId),
        this.generatePatientRecommendations(patientId, doctorId)
      ]);

      return {
        success: true,
        data: {
          patient: {
            ...patient.toObject(),
            riskLevel: riskAssessment.level,
            riskFactors: riskAssessment.factors
          },
          treatmentHistory,
          progressAnalytics,
          currentStatus,
          riskAssessment,
          providerCollaboration,
          recommendations,
          reportGenerated: new Date()
        }
      };
    } catch (error) {
      throw new Error(`Failed to generate patient report: ${error.message}`);
    }
  }

  // Helper methods for calculations and analysis

  calculateDemographics(patients) {
    const ageGroups = { '18-30': 0, '31-50': 0, '51-70': 0, '70+': 0 };
    const genderDistribution = { male: 0, female: 0, other: 0, unspecified: 0 };

    patients.forEach(patient => {
      // Age calculation
      if (patient.dateOfBirth) {
        const age = Math.floor((Date.now() - patient.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        if (age <= 30) ageGroups['18-30']++;
        else if (age <= 50) ageGroups['31-50']++;
        else if (age <= 70) ageGroups['51-70']++;
        else ageGroups['70+']++;
      }

      // Gender distribution
      const gender = patient.gender || 'unspecified';
      genderDistribution[gender] = (genderDistribution[gender] || 0) + 1;
    });

    return { ageGroups, genderDistribution };
  }

  async categorizePatientsByTreatmentPhase(patients, doctorId) {
    const phases = {
      'initial_assessment': 0,
      'active_treatment': 0,
      'maintenance': 0,
      'discharge_ready': 0
    };

    for (const patient of patients) {
      const activeTasks = await RehabTask.countDocuments({
        assignedTo: patient._id,
        status: 'active'
      });

      const recentProgress = await Progress.countDocuments({
        patient: patient._id,
        sessionDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      });

      // Simple phase classification logic
      if (activeTasks === 0 && recentProgress === 0) {
        phases.initial_assessment++;
      } else if (activeTasks > 3 || recentProgress > 5) {
        phases.active_treatment++;
      } else if (activeTasks <= 2 && recentProgress > 0) {
        phases.maintenance++;
      } else {
        phases.discharge_ready++;
      }
    }

    return phases;
  }

  async stratifyPatientsByRisk(patients, doctorId) {
    const risk = { low: 0, medium: 0, high: 0 };

    for (const patient of patients) {
      const riskLevel = await this.assessPatientRisk(patient._id);
      risk[riskLevel.level]++;
    }

    return risk;
  }

  async calculateAverageActiveTasksPerPatient(patients, doctorId) {
    if (patients.length === 0) return 0;

    const totalTasks = await RehabTask.countDocuments({
      assignedTo: { $in: patients.map(p => p._id) },
      status: 'active'
    });

    return Math.round((totalTasks / patients.length) * 10) / 10;
  }

  async getPatientDistributionByProvider(patients, doctorId) {
    const distribution = {};

    for (const patient of patients) {
      for (const provider of patient.assignedProviders) {
        if (provider.providerId.toString() !== doctorId.toString()) {
          const providerId = provider.providerId.toString();
          const providerInfo = await User.findById(providerId).select('firstName lastName role');

          if (providerInfo && providerInfo.role === 'physiotherapist') {
            const key = `${providerInfo.firstName} ${providerInfo.lastName}`;
            distribution[key] = (distribution[key] || 0) + 1;
          }
        }
      }
    }

    return distribution;
  }

  calculateImprovementMetrics(progressData) {
    if (progressData.length === 0) {
      return { hasData: false, message: 'No progress data available' };
    }

    const improvementScores = progressData.map(p => {
      const painImprovement = p.assessments.painBefore - p.assessments.painAfter;
      const mobilityImprovement = p.assessments.mobilityAfter - p.assessments.mobilityBefore;
      const energyImprovement = p.assessments.energyAfter - p.assessments.energyBefore;

      return { painImprovement, mobilityImprovement, energyImprovement };
    });

    const avgPainImprovement = improvementScores.reduce((sum, s) => sum + s.painImprovement, 0) / improvementScores.length;
    const avgMobilityImprovement = improvementScores.reduce((sum, s) => sum + s.mobilityImprovement, 0) / improvementScores.length;
    const avgEnergyImprovement = improvementScores.reduce((sum, s) => sum + s.energyImprovement, 0) / improvementScores.length;

    return {
      hasData: true,
      avgPainImprovement: Math.round(avgPainImprovement * 10) / 10,
      avgMobilityImprovement: Math.round(avgMobilityImprovement * 10) / 10,
      avgEnergyImprovement: Math.round(avgEnergyImprovement * 10) / 10,
      patientsImproving: progressData.filter(p =>
        (p.assessments.painBefore - p.assessments.painAfter) > 0
      ).length,
      totalPatients: new Set(progressData.map(p => p.patient._id.toString())).size
    };
  }

  async calculateCompletionRates(patientIds, doctorId) {
    const [totalTasks, completedTasks, partiallyCompleted] = await Promise.all([
      RehabTask.countDocuments({ assignedTo: { $in: patientIds } }),
      RehabTask.countDocuments({ assignedTo: { $in: patientIds }, status: 'completed' }),
      Progress.countDocuments({
        patient: { $in: patientIds },
        completionStatus: 'partially_completed'
      })
    ]);

    return {
      totalTasks,
      completedTasks,
      partiallyCompleted,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      partialCompletionRate: totalTasks > 0 ? Math.round((partiallyCompleted / totalTasks) * 100) : 0
    };
  }

  async calculateTreatmentDurationAnalytics(patientIds, doctorId) {
    const completedTasks = await RehabTask.find({
      assignedTo: { $in: patientIds },
      status: 'completed'
    });

    if (completedTasks.length === 0) {
      return { hasData: false, message: 'No completed tasks available' };
    }

    const durations = completedTasks.map(task => {
      const start = new Date(task.schedule.startDate);
      const end = new Date(task.updatedAt);
      return Math.ceil((end - start) / (1000 * 60 * 60 * 24)); // Days
    });

    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const medianDuration = this.calculateMedian(durations);

    return {
      hasData: true,
      averageDuration: Math.round(avgDuration),
      medianDuration,
      shortestDuration: Math.min(...durations),
      longestDuration: Math.max(...durations),
      durationDistribution: this.createDurationDistribution(durations)
    };
  }

  async getOutcomesByCategory(patientIds) {
    const progressByCategory = await Progress.find({
      patient: { $in: patientIds }
    })
      .populate('rehabTask', 'category')
      .lean();

    const categoryOutcomes = {};

    progressByCategory.forEach(progress => {
      const category = progress.rehabTask.category || 'other';
      if (!categoryOutcomes[category]) {
        categoryOutcomes[category] = {
          sessions: 0,
          avgPainImprovement: 0,
          avgMobilityImprovement: 0,
          completionRate: 0,
          painImprovements: [],
          mobilityImprovements: []
        };
      }

      categoryOutcomes[category].sessions++;
      const painImprovement = progress.assessments.painBefore - progress.assessments.painAfter;
      const mobilityImprovement = progress.assessments.mobilityAfter - progress.assessments.mobilityBefore;

      categoryOutcomes[category].painImprovements.push(painImprovement);
      categoryOutcomes[category].mobilityImprovements.push(mobilityImprovement);

      if (progress.completionStatus === 'completed') {
        categoryOutcomes[category].completionRate++;
      }
    });

    // Calculate averages
    Object.keys(categoryOutcomes).forEach(category => {
      const data = categoryOutcomes[category];
      data.avgPainImprovement = Math.round((data.painImprovements.reduce((a, b) => a + b, 0) / data.painImprovements.length) * 10) / 10;
      data.avgMobilityImprovement = Math.round((data.mobilityImprovements.reduce((a, b) => a + b, 0) / data.mobilityImprovements.length) * 10) / 10;
      data.completionRate = Math.round((data.completionRate / data.sessions) * 100);

      // Clean up temporary arrays
      delete data.painImprovements;
      delete data.mobilityImprovements;
    });

    return categoryOutcomes;
  }

  async calculatePatientSatisfactionMetrics(patientIds) {
    // This would integrate with patient satisfaction surveys
    // For now, return placeholder data
    return {
      hasData: false,
      message: 'Patient satisfaction data not available',
      avgRating: 0,
      responseRate: 0
    };
  }

  generateBenchmarkComparisons(improvementMetrics, completionRates) {
    // Industry benchmarks (placeholder values)
    const benchmarks = {
      avgPainImprovement: 2.5,
      completionRate: 75,
      patientSatisfaction: 4.2
    };

    return {
      painImprovement: {
        current: improvementMetrics.avgPainImprovement,
        benchmark: benchmarks.avgPainImprovement,
        performance: improvementMetrics.avgPainImprovement >= benchmarks.avgPainImprovement ? 'above' : 'below'
      },
      completionRate: {
        current: completionRates.completionRate,
        benchmark: benchmarks.completionRate,
        performance: completionRates.completionRate >= benchmarks.completionRate ? 'above' : 'below'
      }
    };
  }

  // Additional helper methods would continue here...
  // This is a comprehensive framework that can be extended based on specific requirements

  calculateMedian(numbers) {
    const sorted = numbers.slice().sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  }

  createDurationDistribution(durations) {
    const ranges = {
      '1-7 days': 0,
      '8-14 days': 0,
      '15-30 days': 0,
      '31-60 days': 0,
      '60+ days': 0
    };

    durations.forEach(duration => {
      if (duration <= 7) ranges['1-7 days']++;
      else if (duration <= 14) ranges['8-14 days']++;
      else if (duration <= 30) ranges['15-30 days']++;
      else if (duration <= 60) ranges['31-60 days']++;
      else ranges['60+ days']++;
    });

    return ranges;
  }

  assessActivityPriority(type, data) {
    switch (type) {
      case 'progress_update':
        if (data.assessments.painAfter > 7) return 'high';
        if (data.completionStatus === 'unable_to_complete') return 'high';
        return 'medium';
      case 'task_assignment':
        if (data.status === 'overdue') return 'high';
        return 'medium';
      case 'comment_added':
        if (data.type === 'concern') return 'high';
        return 'low';
      default:
        return 'medium';
    }
  }

  calculateDaysOverdue(endDate) {
    const now = new Date();
    const end = new Date(endDate);
    return Math.ceil((now - end) / (1000 * 60 * 60 * 24));
  }

  groupAlertsByType(alerts) {
    return alerts.reduce((groups, alert) => {
      const type = alert.type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(alert);
      return groups;
    }, {});
  }

  // Placeholder methods that would be implemented based on specific business requirements
  async calculatePhysiotherapistPatientOutcomes(ptId, patientIds) {
    // Implementation for calculating outcomes specific to this physiotherapist
    return { avgImprovement: 0, successRate: 0 };
  }

  async calculatePhysiotherapistAdherenceRates(ptId, patientIds) {
    // Implementation for calculating adherence rates
    return { avgAdherence: 0 };
  }

  async calculatePhysiotherapistResponseTime(ptId, patientIds) {
    // Implementation for calculating response times
    return { avgResponseHours: 0 };
  }

  calculatePhysiotherapistScore(outcomes, adherence, totalTasks, responseTime) {
    // Implementation for scoring algorithm
    return Math.min(100, Math.max(0, 75)); // Placeholder
  }

  calculateTeamAverages(metrics) {
    // Implementation for team average calculations
    return { avgScore: 0, avgPatients: 0 };
  }

  async identifyPatientsWithPoorOutcomes(patientIds) {
    // Implementation for identifying poor outcomes
    return [];
  }

  async identifyPatientsWithHighPainLevels(patientIds) {
    // Implementation for identifying high pain levels
    return [];
  }

  async identifyPatientsWithNoRecentProgress(patientIds) {
    // Implementation for identifying inactive patients
    return [];
  }

  async identifyOverdueTasks(patientIds, doctorId) {
    // Implementation for identifying overdue tasks
    return [];
  }

  async identifyMissedAppointments(patientIds) {
    // Implementation for missed appointments
    return [];
  }

  async calculateAlertTrends(doctorId) {
    // Implementation for alert trend analysis
    return { trend: 'stable' };
  }

  async assessPatientRisk(patientId) {
    // Implementation for patient risk assessment
    return { level: 'low', factors: [] };
  }
}

module.exports = new DoctorOversightService();