const RehabTask = require('../models/RehabTask');
const User = require('../models/User');
const mongoose = require('mongoose');

/**
 * Rehabilitation Service
 * Handles CRUD operations for rehabilitation tasks and schedule management
 */

class RehabService {
  /**
   * Create a new rehabilitation task
   * @param {String} physiotherapistId - ID of the physiotherapist creating the task
   * @param {Object} taskData - Task creation data
   * @returns {Promise<Object>} Created task
   */
  async createTask(physiotherapistId, taskData) {
    try {
      // Validate physiotherapist
      const physiotherapist = await User.findById(physiotherapistId);
      if (!physiotherapist || physiotherapist.role !== 'physiotherapist') {
        throw new Error('Only physiotherapists can create rehabilitation tasks');
      }

      // Validate patient
      const patient = await User.findById(taskData.assignedTo);
      if (!patient || patient.role !== 'patient') {
        throw new Error('Task must be assigned to a valid patient');
      }

      // Check if physiotherapist is assigned to this patient
      const isAssigned = patient.assignedProviders.some(
        provider => provider.providerId.toString() === physiotherapistId.toString()
      );

      if (!isAssigned) {
        throw new Error('You are not assigned to this patient');
      }

      // Validate required fields
      const {
        title,
        description,
        category,
        instructions,
        parameters,
        schedule
      } = taskData;

      if (!title || !description || !category || !schedule) {
        throw new Error('Missing required fields: title, description, category, schedule');
      }

      // Validate schedule dates
      if (!schedule.startDate) {
        throw new Error('Schedule start date is required');
      }

      const startDate = new Date(schedule.startDate);
      const endDate = schedule.endDate ? new Date(schedule.endDate) : null;

      if (startDate < new Date()) {
        throw new Error('Start date cannot be in the past');
      }

      if (endDate && endDate <= startDate) {
        throw new Error('End date must be after start date');
      }

      // Create task
      const task = new RehabTask({
        title: title.trim(),
        description: description.trim(),
        category,
        instructions: instructions || [],
        parameters: parameters || {},
        assignedBy: physiotherapistId,
        assignedTo: taskData.assignedTo,
        schedule: {
          ...schedule,
          startDate,
          endDate,
          completedSessions: 0
        },
        status: 'draft',
        priority: taskData.priority || 'normal',
        goals: taskData.goals || [],
        progressMetrics: taskData.progressMetrics || {},
        notes: {
          therapistNotes: taskData.therapistNotes || '',
          patientNotes: '',
          modificationHistory: []
        },
        resources: taskData.resources || [],
        reminders: taskData.reminders || {
          enabled: true,
          beforeSession: 30,
          missedSession: 60,
          methods: ['push', 'email']
        }
      });

      await task.save();

      // Populate references for response
      await task.populate([
        { path: 'assignedBy', select: 'firstName lastName role' },
        { path: 'assignedTo', select: 'firstName lastName email role' }
      ]);

      return {
        success: true,
        message: 'Rehabilitation task created successfully',
        data: {
          task: task.toJSON()
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
   * Get tasks for a physiotherapist
   * @param {String} physiotherapistId - Physiotherapist ID
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Tasks list
   */
  async getTasksByPhysiotherapist(physiotherapistId, filters = {}) {
    try {
      const query = { assignedBy: physiotherapistId };

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.patientId) {
        query.assignedTo = filters.patientId;
      }

      if (filters.category) {
        query.category = filters.category;
      }

      if (filters.priority) {
        query.priority = filters.priority;
      }

      if (filters.startDate) {
        query['schedule.startDate'] = { $gte: new Date(filters.startDate) };
      }

      if (filters.endDate) {
        query['schedule.endDate'] = { $lte: new Date(filters.endDate) };
      }

      // Pagination
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 10;
      const skip = (page - 1) * limit;

      // Sort
      const sortBy = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortBy]: sortOrder };

      const [tasks, total] = await Promise.all([
        RehabTask.find(query)
          .populate('assignedTo', 'firstName lastName email role')
          .sort(sort)
          .skip(skip)
          .limit(limit),
        RehabTask.countDocuments(query)
      ]);

      return {
        success: true,
        data: {
          tasks,
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
   * Get tasks for a patient
   * @param {String} patientId - Patient ID
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} Tasks list
   */
  async getTasksForPatient(patientId, filters = {}) {
    try {
      const query = { assignedTo: patientId };

      // Apply filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.category) {
        query.category = filters.category;
      }

      if (filters.active !== undefined) {
        const today = new Date();
        if (filters.active === 'true') {
          query.status = 'active';
          query['schedule.startDate'] = { $lte: today };
          query.$or = [
            { 'schedule.endDate': { $gte: today } },
            { 'schedule.endDate': null }
          ];
        }
      }

      // Sort by priority and start date
      const sort = { priority: -1, 'schedule.startDate': 1 };

      const tasks = await RehabTask.find(query)
        .populate('assignedBy', 'firstName lastName role')
        .sort(sort);

      return {
        success: true,
        data: {
          tasks
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get a specific task by ID
   * @param {String} taskId - Task ID
   * @param {String} userId - Requesting user ID
   * @returns {Promise<Object>} Task details
   */
  async getTaskById(taskId, userId) {
    try {
      const task = await RehabTask.findById(taskId)
        .populate('assignedBy', 'firstName lastName role')
        .populate('assignedTo', 'firstName lastName email role');

      if (!task) {
        throw new Error('Task not found');
      }

      // Check permission
      const isAuthorized =
        task.assignedTo._id.toString() === userId ||
        task.assignedBy._id.toString() === userId;

      if (!isAuthorized) {
        throw new Error('Access denied. You can only view your own tasks or assigned tasks');
      }

      return {
        success: true,
        data: {
          task: task.toJSON()
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Update a rehabilitation task
   * @param {String} taskId - Task ID
   * @param {String} physiotherapistId - Physiotherapist ID
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated task
   */
  async updateTask(taskId, physiotherapistId, updateData) {
    try {
      const task = await RehabTask.findById(taskId);

      if (!task) {
        throw new Error('Task not found');
      }

      // Check permission
      if (task.assignedBy.toString() !== physiotherapistId) {
        throw new Error('You can only update tasks you created');
      }

      // Prevent updating certain fields
      const restrictedFields = ['assignedBy', 'assignedTo', '_id', 'createdAt', 'updatedAt'];
      restrictedFields.forEach(field => {
        delete updateData[field];
      });

      // Validate status transitions
      if (updateData.status) {
        const validTransitions = {
          'draft': ['active', 'cancelled'],
          'active': ['paused', 'completed', 'cancelled'],
          'paused': ['active', 'cancelled'],
          'completed': [], // Cannot change from completed
          'cancelled': [] // Cannot change from cancelled
        };

        const allowedStatuses = validTransitions[task.status] || [];
        if (!allowedStatuses.includes(updateData.status)) {
          throw new Error(`Cannot change status from ${task.status} to ${updateData.status}`);
        }
      }

      // Add modification history
      if (updateData.notes && updateData.notes.modificationReason) {
        if (!task.notes.modificationHistory) {
          task.notes.modificationHistory = [];
        }

        task.notes.modificationHistory.push({
          date: new Date(),
          modifiedBy: physiotherapistId,
          changes: updateData.notes.modificationReason,
          reason: updateData.notes.modificationReason
        });

        delete updateData.notes.modificationReason;
      }

      // Update task
      Object.assign(task, updateData);
      await task.save();

      // Populate for response
      await task.populate([
        { path: 'assignedBy', select: 'firstName lastName role' },
        { path: 'assignedTo', select: 'firstName lastName email role' }
      ]);

      return {
        success: true,
        message: 'Task updated successfully',
        data: {
          task: task.toJSON()
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
   * Delete a rehabilitation task
   * @param {String} taskId - Task ID
   * @param {String} physiotherapistId - Physiotherapist ID
   * @returns {Promise<Object>} Deletion confirmation
   */
  async deleteTask(taskId, physiotherapistId) {
    try {
      const task = await RehabTask.findById(taskId);

      if (!task) {
        throw new Error('Task not found');
      }

      // Check permission
      if (task.assignedBy.toString() !== physiotherapistId) {
        throw new Error('You can only delete tasks you created');
      }

      // Check if task can be deleted
      if (task.status === 'active' && task.schedule.completedSessions > 0) {
        throw new Error('Cannot delete active task with completed sessions. Consider cancelling instead.');
      }

      await RehabTask.findByIdAndDelete(taskId);

      return {
        success: true,
        message: 'Task deleted successfully'
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Activate a task (change from draft to active)
   * @param {String} taskId - Task ID
   * @param {String} physiotherapistId - Physiotherapist ID
   * @returns {Promise<Object>} Activation confirmation
   */
  async activateTask(taskId, physiotherapistId) {
    try {
      const task = await RehabTask.findById(taskId);

      if (!task) {
        throw new Error('Task not found');
      }

      if (task.assignedBy.toString() !== physiotherapistId) {
        throw new Error('You can only activate tasks you created');
      }

      if (task.status !== 'draft') {
        throw new Error('Only draft tasks can be activated');
      }

      // Validate task is ready for activation
      if (!task.schedule.startDate) {
        throw new Error('Task must have a start date to be activated');
      }

      if (!task.instructions || task.instructions.length === 0) {
        throw new Error('Task must have instructions to be activated');
      }

      task.status = 'active';
      await task.save();

      return {
        success: true,
        message: 'Task activated successfully',
        data: {
          task: task.toJSON()
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get task statistics for a physiotherapist
   * @param {String} physiotherapistId - Physiotherapist ID
   * @returns {Promise<Object>} Task statistics
   */
  async getTaskStatistics(physiotherapistId) {
    try {
      const stats = await RehabTask.aggregate([
        { $match: { assignedBy: new mongoose.Types.ObjectId(physiotherapistId) } },
        {
          $group: {
            _id: null,
            totalTasks: { $sum: 1 },
            activeTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            completedTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            draftTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
            },
            cancelledTasks: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            },
            averageCompletion: {
              $avg: '$schedule.completedSessions'
            },
            totalSessions: {
              $sum: '$schedule.completedSessions'
            }
          }
        }
      ]);

      const categoryStats = await RehabTask.aggregate([
        { $match: { assignedBy: new mongoose.Types.ObjectId(physiotherapistId) } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            averageCompletion: { $avg: '$schedule.completedSessions' }
          }
        }
      ]);

      return {
        success: true,
        data: {
          overview: stats[0] || {
            totalTasks: 0,
            activeTasks: 0,
            completedTasks: 0,
            draftTasks: 0,
            cancelledTasks: 0,
            averageCompletion: 0,
            totalSessions: 0
          },
          byCategory: categoryStats
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get upcoming tasks for a patient
   * @param {String} patientId - Patient ID
   * @param {Number} days - Number of days to look ahead (default: 7)
   * @returns {Promise<Object>} Upcoming tasks
   */
  async getUpcomingTasks(patientId, days = 7) {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const tasks = await RehabTask.find({
        assignedTo: patientId,
        status: 'active',
        'schedule.startDate': { $lte: endDate },
        $or: [
          { 'schedule.endDate': { $gte: startDate } },
          { 'schedule.endDate': null }
        ]
      })
      .populate('assignedBy', 'firstName lastName')
      .sort({ 'schedule.startDate': 1, priority: -1 });

      return {
        success: true,
        data: {
          tasks,
          period: {
            start: startDate,
            end: endDate,
            days
          }
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Search tasks
   * @param {Object} searchCriteria - Search parameters
   * @param {String} userId - User ID making the request
   * @returns {Promise<Object>} Search results
   */
  async searchTasks(searchCriteria, userId) {
    try {
      const { query, category, status, assignedBy, assignedTo } = searchCriteria;

      // Build search query
      const searchQuery = {};

      // Text search
      if (query) {
        searchQuery.$text = { $search: query };
      }

      // Filters
      if (category) searchQuery.category = category;
      if (status) searchQuery.status = status;
      if (assignedBy) searchQuery.assignedBy = assignedBy;
      if (assignedTo) searchQuery.assignedTo = assignedTo;

      // Permission filter based on user role
      const user = await User.findById(userId);
      if (user.role === 'patient') {
        searchQuery.assignedTo = userId;
      } else if (user.role === 'physiotherapist') {
        searchQuery.assignedBy = userId;
      }
      // Doctors can see all tasks for their patients

      const tasks = await RehabTask.find(searchQuery)
        .populate('assignedBy', 'firstName lastName role')
        .populate('assignedTo', 'firstName lastName role')
        .sort({ score: { $meta: 'textScore' } })
        .limit(50);

      return {
        success: true,
        data: {
          tasks,
          count: tasks.length
        }
      };

    } catch (error) {
      throw error;
    }
  }
}

module.exports = new RehabService();