const Progress = require('../models/Progress');
const RehabTask = require('../models/RehabTask');
const User = require('../models/User');
const Comment = require('../models/Comment');
const mongoose = require('mongoose');

/**
 * Patient Dashboard Service
 * Provides comprehensive dashboard data, analytics, and summaries for patients
 */

class PatientDashboardService {
  /**
   * Get comprehensive dashboard overview for patient
   * @param {String} patientId - Patient ID
   * @returns {Promise<Object>} Dashboard data with task overview and progress summaries
   */
  async getDashboardOverview(patientId) {
    try {
      // Get all data in parallel for better performance
      const [
        activeTasks,
        recentProgress,
        weeklyStats,
        achievementStats,
        upcomingTasks,
        recentComments,
        overallProgress
      ] = await Promise.all([
        this.getActiveTasksSummary(patientId),
        this.getRecentProgressSummary(patientId),
        this.getWeeklyProgressStats(patientId),
        this.getAchievementStats(patientId),
        this.getUpcomingTasksSummary(patientId),
        this.getRecentComments(patientId),
        this.getOverallProgressSummary(patientId)
      ]);

      return {
        success: true,
        data: {
          overview: {
            activeTasks: activeTasks.totalCount,
            completedTasksThisWeek: weeklyStats.completedTasks,
            averagePainReduction: overallProgress.averagePainReduction,
            streakDays: achievementStats.currentStreak
          },
          activeTasks,
          recentProgress,
          weeklyStats,
          achievements: achievementStats,
          upcomingTasks,
          recentComments,
          overallProgress,
          lastUpdated: new Date()
        }
      };
    } catch (error) {
      throw new Error(`Failed to get dashboard overview: ${error.message}`);
    }
  }

  /**
   * Get active tasks summary with progress indicators
   * @param {String} patientId - Patient ID
   * @returns {Promise<Object>} Active tasks with progress data
   */
  async getActiveTasksSummary(patientId) {
    try {
      const activeTasks = await RehabTask.find({
        assignedTo: patientId,
        status: 'active',
        'schedule.startDate': { $lte: new Date() },
        $or: [
          { 'schedule.endDate': { $gte: new Date() } },
          { 'schedule.endDate': null }
        ]
      })
      .populate('assignedBy', 'firstName lastName role')
      .sort({ 'schedule.startDate': -1 })
      .limit(10);

      // Get progress data for each task
      const tasksWithProgress = await Promise.all(
        activeTasks.map(async (task) => {
          const recentSessions = await Progress.find({
            patient: patientId,
            rehabTask: task._id
          })
          .sort({ sessionDate: -1 })
          .limit(5);

          const totalSessions = await Progress.countDocuments({
            patient: patientId,
            rehabTask: task._id
          });

          const completedSessions = await Progress.countDocuments({
            patient: patientId,
            rehabTask: task._id,
            completionStatus: 'completed'
          });

          // Calculate averages from recent sessions
          let avgPainReduction = 0;
          let avgMobilityImprovement = 0;
          if (recentSessions.length > 0) {
            avgPainReduction = recentSessions.reduce((sum, session) =>
              sum + (session.assessments.painBefore - session.assessments.painAfter), 0) / recentSessions.length;
            avgMobilityImprovement = recentSessions.reduce((sum, session) =>
              sum + (session.assessments.mobilityAfter - session.assessments.mobilityBefore), 0) / recentSessions.length;
          }

          return {
            ...task.toObject(),
            progress: {
              totalSessions,
              completedSessions,
              completionRate: totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0,
              avgPainReduction: Math.round(avgPainReduction * 10) / 10,
              avgMobilityImprovement: Math.round(avgMobilityImprovement * 10) / 10,
              lastSession: recentSessions[0]?.sessionDate || null,
              recentTrend: this.calculateProgressTrend(recentSessions)
            }
          };
        })
      );

      return {
        totalCount: activeTasks.length,
        tasks: tasksWithProgress,
        categories: this.groupTasksByCategory(tasksWithProgress)
      };
    } catch (error) {
      throw new Error(`Failed to get active tasks summary: ${error.message}`);
    }
  }

  /**
   * Get recent progress summary (last 7 days)
   * @param {String} patientId - Patient ID
   * @returns {Promise<Object>} Recent progress data
   */
  async getRecentProgressSummary(patientId) {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentProgress = await Progress.find({
        patient: patientId,
        sessionDate: { $gte: sevenDaysAgo }
      })
      .populate('rehabTask', 'title category')
      .sort({ sessionDate: -1 });

      // Calculate daily summaries
      const dailySummaries = {};
      recentProgress.forEach(session => {
        const dateKey = session.sessionDate.toISOString().split('T')[0];
        if (!dailySummaries[dateKey]) {
          dailySummaries[dateKey] = {
            date: dateKey,
            sessions: [],
            totalDuration: 0,
            avgPainBefore: 0,
            avgPainAfter: 0,
            avgMobility: 0,
            tasksCompleted: 0
          };
        }

        dailySummaries[dateKey].sessions.push(session);
        dailySummaries[dateKey].totalDuration += session.sessionDuration;
        if (session.completionStatus === 'completed') {
          dailySummaries[dateKey].tasksCompleted++;
        }
      });

      // Calculate averages for each day
      Object.keys(dailySummaries).forEach(date => {
        const sessions = dailySummaries[date].sessions;
        if (sessions.length > 0) {
          dailySummaries[date].avgPainBefore = sessions.reduce((sum, s) => sum + s.assessments.painBefore, 0) / sessions.length;
          dailySummaries[date].avgPainAfter = sessions.reduce((sum, s) => sum + s.assessments.painAfter, 0) / sessions.length;
          dailySummaries[date].avgMobility = sessions.reduce((sum, s) => sum + s.assessments.mobilityAfter, 0) / sessions.length;
        }
      });

      return {
        totalSessions: recentProgress.length,
        totalDuration: recentProgress.reduce((sum, session) => sum + session.sessionDuration, 0),
        completedSessions: recentProgress.filter(s => s.completionStatus === 'completed').length,
        avgPainReduction: this.calculateAverageMetric(recentProgress, 'painReduction'),
        avgMobilityImprovement: this.calculateAverageMetric(recentProgress, 'mobilityImprovement'),
        dailySummaries: Object.values(dailySummaries).sort((a, b) => new Date(b.date) - new Date(a.date)),
        mostActiveDay: this.findMostActiveDay(dailySummaries),
        progressTrend: this.calculateWeeklyTrend(recentProgress)
      };
    } catch (error) {
      throw new Error(`Failed to get recent progress summary: ${error.message}`);
    }
  }

  /**
   * Get weekly progress statistics
   * @param {String} patientId - Patient ID
   * @returns {Promise<Object>} Weekly stats
   */
  async getWeeklyProgressStats(patientId) {
    try {
      const now = new Date();
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      weekStart.setHours(0, 0, 0, 0);

      const weekProgress = await Progress.find({
        patient: patientId,
        sessionDate: { $gte: weekStart }
      }).populate('rehabTask', 'title category');

      const stats = {
        completedTasks: weekProgress.filter(p => p.completionStatus === 'completed').length,
        totalSessions: weekProgress.length,
        totalDuration: weekProgress.reduce((sum, p) => sum + p.sessionDuration, 0),
        uniqueTasksWorked: [...new Set(weekProgress.map(p => p.rehabTask._id.toString()))].length,
        averageSessionDuration: weekProgress.length > 0 ? weekProgress.reduce((sum, p) => sum + p.sessionDuration, 0) / weekProgress.length : 0,
        categoryBreakdown: this.getCategoryBreakdown(weekProgress),
        dailyCompletion: this.getDailyCompletionMap(weekProgress, weekStart)
      };

      return stats;
    } catch (error) {
      throw new Error(`Failed to get weekly progress stats: ${error.message}`);
    }
  }

  /**
   * Get achievement statistics and milestones
   * @param {String} patientId - Patient ID
   * @returns {Promise<Object>} Achievement data
   */
  async getAchievementStats(patientId) {
    try {
      const allProgress = await Progress.find({ patient: patientId })
        .sort({ sessionDate: 1 });

      const achievements = {
        totalSessions: allProgress.length,
        completedTasks: allProgress.filter(p => p.completionStatus === 'completed').length,
        currentStreak: this.calculateCurrentStreak(allProgress),
        longestStreak: this.calculateLongestStreak(allProgress),
        totalHours: Math.round(allProgress.reduce((sum, p) => sum + p.sessionDuration, 0) / 60),
        milestones: this.calculateMilestones(allProgress),
        badges: this.calculateBadges(allProgress),
        improvementMetrics: this.calculateImprovementMetrics(allProgress)
      };

      return achievements;
    } catch (error) {
      throw new Error(`Failed to get achievement stats: ${error.message}`);
    }
  }

  /**
   * Get upcoming tasks summary
   * @param {String} patientId - Patient ID
   * @param {Number} days - Number of days to look ahead (default: 7)
   * @returns {Promise<Object>} Upcoming tasks
   */
  async getUpcomingTasksSummary(patientId, days = 7) {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);

      const upcomingTasks = await RehabTask.find({
        assignedTo: patientId,
        status: 'active',
        'schedule.startDate': {
          $gte: today,
          $lte: futureDate
        }
      })
      .populate('assignedBy', 'firstName lastName role')
      .sort({ 'schedule.startDate': 1 });

      // Group by date
      const tasksByDate = {};
      upcomingTasks.forEach(task => {
        const dateKey = task.schedule.startDate.toISOString().split('T')[0];
        if (!tasksByDate[dateKey]) {
          tasksByDate[dateKey] = [];
        }
        tasksByDate[dateKey].push(task);
      });

      return {
        totalCount: upcomingTasks.length,
        tasks: upcomingTasks,
        tasksByDate,
        nextTask: upcomingTasks[0] || null,
        categoriesCount: this.countTasksByCategory(upcomingTasks)
      };
    } catch (error) {
      throw new Error(`Failed to get upcoming tasks summary: ${error.message}`);
    }
  }

  /**
   * Get recent comments and feedback
   * @param {String} patientId - Patient ID
   * @returns {Promise<Object>} Recent comments
   */
  async getRecentComments(patientId, limit = 5) {
    try {
      const recentComments = await Comment.find({
        patient: patientId,
        visibility: { $in: ['patient_only', 'all_assigned'] }
      })
      .populate('author', 'firstName lastName role')
      .populate('rehabTask', 'title')
      .sort({ createdAt: -1 })
      .limit(limit);

      return {
        totalCount: recentComments.length,
        comments: recentComments,
        unreadCount: recentComments.filter(c => !c.readBy.includes(patientId)).length,
        encouragementCount: recentComments.filter(c => c.type === 'achievement').length
      };
    } catch (error) {
      throw new Error(`Failed to get recent comments: ${error.message}`);
    }
  }

  /**
   * Get overall progress summary since start
   * @param {String} patientId - Patient ID
   * @returns {Promise<Object>} Overall progress data
   */
  async getOverallProgressSummary(patientId) {
    try {
      const firstProgress = await Progress.findOne({ patient: patientId })
        .sort({ sessionDate: 1 });

      const latestProgress = await Progress.findOne({ patient: patientId })
        .sort({ sessionDate: -1 });

      if (!firstProgress || !latestProgress) {
        return {
          hasData: false,
          message: 'No progress data available yet'
        };
      }

      const daysSinceStart = Math.ceil((latestProgress.sessionDate - firstProgress.sessionDate) / (1000 * 60 * 60 * 24));

      const allProgress = await Progress.find({ patient: patientId });

      // Calculate overall improvements
      const painImprovement = firstProgress.assessments.painBefore - latestProgress.assessments.painAfter;
      const mobilityImprovement = latestProgress.assessments.mobilityAfter - firstProgress.assessments.mobilityBefore;
      const energyImprovement = latestProgress.assessments.energyAfter - firstProgress.assessments.energyBefore;

      const averagePainReduction = allProgress.reduce((sum, p) =>
        sum + (p.assessments.painBefore - p.assessments.painAfter), 0) / allProgress.length;

      return {
        hasData: true,
        startDate: firstProgress.sessionDate,
        daysSinceStart,
        totalSessions: allProgress.length,
        averagePainReduction: Math.round(averagePainReduction * 10) / 10,
        overallImprovements: {
          pain: Math.round(painImprovement * 10) / 10,
          mobility: Math.round(mobilityImprovement * 10) / 10,
          energy: Math.round(energyImprovement * 10) / 10
        },
        consistencyScore: this.calculateConsistencyScore(allProgress, daysSinceStart),
        progressVelocity: this.calculateProgressVelocity(allProgress)
      };
    } catch (error) {
      throw new Error(`Failed to get overall progress summary: ${error.message}`);
    }
  }

  // Helper methods

  calculateProgressTrend(sessions) {
    if (sessions.length < 2) return 'insufficient_data';

    const recent = sessions.slice(0, Math.ceil(sessions.length / 2));
    const older = sessions.slice(Math.ceil(sessions.length / 2));

    const recentAvg = recent.reduce((sum, s) => sum + (s.assessments.painBefore - s.assessments.painAfter), 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + (s.assessments.painBefore - s.assessments.painAfter), 0) / older.length;

    if (recentAvg > olderAvg * 1.1) return 'improving';
    if (recentAvg < olderAvg * 0.9) return 'declining';
    return 'stable';
  }

  groupTasksByCategory(tasks) {
    return tasks.reduce((groups, task) => {
      const category = task.category || 'other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(task);
      return groups;
    }, {});
  }

  calculateAverageMetric(sessions, metric) {
    if (sessions.length === 0) return 0;

    let sum = 0;
    sessions.forEach(session => {
      switch (metric) {
        case 'painReduction':
          sum += session.assessments.painBefore - session.assessments.painAfter;
          break;
        case 'mobilityImprovement':
          sum += session.assessments.mobilityAfter - session.assessments.mobilityBefore;
          break;
      }
    });

    return Math.round((sum / sessions.length) * 10) / 10;
  }

  findMostActiveDay(dailySummaries) {
    let mostActive = null;
    let maxSessions = 0;

    Object.keys(dailySummaries).forEach(date => {
      if (dailySummaries[date].sessions.length > maxSessions) {
        maxSessions = dailySummaries[date].sessions.length;
        mostActive = date;
      }
    });

    return mostActive;
  }

  calculateWeeklyTrend(sessions) {
    if (sessions.length < 3) return 'insufficient_data';

    const painReductions = sessions.map(s => s.assessments.painBefore - s.assessments.painAfter);
    const isImproving = painReductions.slice(0, 3).reduce((a, b) => a + b) >
                      painReductions.slice(-3).reduce((a, b) => a + b);

    return isImproving ? 'improving' : 'stable';
  }

  getCategoryBreakdown(progress) {
    return progress.reduce((breakdown, p) => {
      const category = p.rehabTask.category || 'other';
      if (!breakdown[category]) breakdown[category] = 0;
      breakdown[category]++;
      return breakdown;
    }, {});
  }

  getDailyCompletionMap(progress, weekStart) {
    const dailyMap = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      dailyMap[dateKey] = progress.filter(p =>
        p.sessionDate.toISOString().split('T')[0] === dateKey
      ).length;
    }
    return dailyMap;
  }

  calculateCurrentStreak(progress) {
    if (progress.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) { // Check up to 365 days back
      const dateToCheck = new Date(currentDate);
      dateToCheck.setDate(currentDate.getDate() - i);

      const hasSession = progress.some(p => {
        const sessionDate = new Date(p.sessionDate);
        sessionDate.setHours(0, 0, 0, 0);
        return sessionDate.getTime() === dateToCheck.getTime();
      });

      if (hasSession) {
        streak++;
      } else if (i > 0) { // Don't break on today if no session yet
        break;
      }
    }

    return streak;
  }

  calculateLongestStreak(progress) {
    if (progress.length === 0) return 0;

    const dates = [...new Set(progress.map(p => p.sessionDate.toISOString().split('T')[0]))].sort();
    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i - 1]);
      const currDate = new Date(dates[i]);
      const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    return longestStreak;
  }

  calculateMilestones(progress) {
    const milestones = [];
    const sessionCount = progress.length;
    const completedCount = progress.filter(p => p.completionStatus === 'completed').length;

    // Session milestones
    [10, 25, 50, 100, 200, 500].forEach(milestone => {
      if (sessionCount >= milestone) {
        milestones.push({
          type: 'sessions',
          milestone,
          achieved: true,
          achievedDate: progress[milestone - 1]?.sessionDate
        });
      }
    });

    // Completion milestones
    [5, 20, 50, 100].forEach(milestone => {
      if (completedCount >= milestone) {
        milestones.push({
          type: 'completions',
          milestone,
          achieved: true
        });
      }
    });

    return milestones;
  }

  calculateBadges(progress) {
    const badges = [];
    const streak = this.calculateCurrentStreak(progress);
    const completionRate = progress.filter(p => p.completionStatus === 'completed').length / progress.length;

    if (streak >= 7) badges.push({ name: 'Week Warrior', description: '7-day streak' });
    if (streak >= 30) badges.push({ name: 'Month Master', description: '30-day streak' });
    if (completionRate >= 0.9) badges.push({ name: 'Perfectionist', description: '90%+ completion rate' });
    if (progress.length >= 100) badges.push({ name: 'Centurion', description: '100 sessions completed' });

    return badges;
  }

  calculateImprovementMetrics(progress) {
    if (progress.length < 2) return {};

    const first = progress[0];
    const latest = progress[progress.length - 1];

    return {
      painImprovement: first.assessments.painBefore - latest.assessments.painAfter,
      mobilityImprovement: latest.assessments.mobilityAfter - first.assessments.mobilityBefore,
      energyImprovement: latest.assessments.energyAfter - first.assessments.energyBefore
    };
  }

  countTasksByCategory(tasks) {
    return tasks.reduce((counts, task) => {
      const category = task.category || 'other';
      counts[category] = (counts[category] || 0) + 1;
      return counts;
    }, {});
  }

  calculateConsistencyScore(progress, totalDays) {
    const activeDays = new Set(progress.map(p => p.sessionDate.toISOString().split('T')[0])).size;
    return Math.round((activeDays / Math.max(totalDays, 1)) * 100);
  }

  calculateProgressVelocity(progress) {
    if (progress.length < 2) return 0;

    const recentSessions = progress.slice(-10);
    const olderSessions = progress.slice(0, 10);

    const recentAvgPainReduction = recentSessions.reduce((sum, p) =>
      sum + (p.assessments.painBefore - p.assessments.painAfter), 0) / recentSessions.length;

    const olderAvgPainReduction = olderSessions.reduce((sum, p) =>
      sum + (p.assessments.painBefore - p.assessments.painAfter), 0) / olderSessions.length;

    return Math.round((recentAvgPainReduction - olderAvgPainReduction) * 100) / 100;
  }
}

module.exports = new PatientDashboardService();