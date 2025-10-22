const User = require('../models/User');
const RehabTask = require('../models/RehabTask');
const Progress = require('../models/Progress');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');

/**
 * Access Control Service
 * Manages role-based data filtering and access permissions
 */
class AccessControlService {
  constructor() {
    this.roleHierarchy = {
      'doctor': ['doctor', 'physiotherapist', 'patient'],
      'physiotherapist': ['physiotherapist', 'patient'],
      'patient': ['patient']
    };

    this.resourcePermissions = {
      'rehabTask': {
        'patient': { read: ['own'], write: ['none'], delete: ['none'] },
        'physiotherapist': { read: ['assigned'], write: ['assigned'], delete: ['assigned'] },
        'doctor': { read: ['all'], write: ['all'], delete: ['all'] }
      },
      'progress': {
        'patient': { read: ['own'], write: ['own'], delete: ['none'] },
        'physiotherapist': { read: ['assigned_patients'], write: ['none'], delete: ['none'] },
        'doctor': { read: ['all'], write: ['none'], delete: ['none'] }
      },
      'comment': {
        'patient': { read: ['visible_to_user'], write: ['own_context'], delete: ['own'] },
        'physiotherapist': { read: ['assigned_patients_context'], write: ['assigned_patients_context'], delete: ['own'] },
        'doctor': { read: ['all'], write: ['all'], delete: ['own_or_moderation'] }
      },
      'notification': {
        'patient': { read: ['own'], write: ['none'], delete: ['none'] },
        'physiotherapist': { read: ['own'], write: ['create_for_assigned'], delete: ['none'] },
        'doctor': { read: ['own'], write: ['create_for_all'], delete: ['none'] }
      },
      'user': {
        'patient': { read: ['own_profile'], write: ['own_profile'], delete: ['none'] },
        'physiotherapist': { read: ['assigned_patients'], write: ['assigned_patients_limited'], delete: ['none'] },
        'doctor': { read: ['all'], write: ['all_limited'], delete: ['none'] }
      }
    };
  }

  /**
   * Check if user has permission for resource action
   */
  async hasPermission(userId, resource, action, targetData = null) {
    try {
      const user = await User.findById(userId);
      if (!user) return false;

      const permissions = this.resourcePermissions[resource];
      if (!permissions || !permissions[user.role]) return false;

      const actionPermissions = permissions[user.role][action];
      if (!actionPermissions || actionPermissions.includes('none')) return false;

      if (actionPermissions.includes('all')) return true;

      // Check specific permission types
      return await this.checkSpecificPermission(user, resource, action, actionPermissions, targetData);
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Check specific permission based on user relationship to data
   */
  async checkSpecificPermission(user, resource, action, permissions, targetData) {
    for (const permission of permissions) {
      switch (permission) {
        case 'own':
          if (await this.isOwnResource(user._id, resource, targetData)) return true;
          break;
        case 'assigned':
        case 'assigned_patients':
          if (await this.isAssignedResource(user, resource, targetData)) return true;
          break;
        case 'assigned_patients_context':
          if (await this.isAssignedPatientContext(user, targetData)) return true;
          break;
        case 'visible_to_user':
          if (await this.isVisibleToUser(user._id, targetData)) return true;
          break;
        case 'own_context':
          if (await this.isOwnContext(user._id, targetData)) return true;
          break;
        case 'own_profile':
          if (targetData && targetData._id.toString() === user._id.toString()) return true;
          break;
        case 'assigned_patients_limited':
          if (await this.isAssignedPatient(user, targetData) && this.isLimitedUserUpdate(action)) return true;
          break;
        case 'all_limited':
          if (this.isLimitedUserUpdate(action)) return true;
          break;
        case 'create_for_assigned':
          if (await this.canCreateForAssigned(user, targetData)) return true;
          break;
        case 'create_for_all':
          return true; // Doctor can create for anyone
        case 'own_or_moderation':
          if (await this.canModerateOrOwn(user, targetData)) return true;
          break;
      }
    }
    return false;
  }

  /**
   * Filter data based on user's role and permissions
   */
  async getFilteredQuery(userId, resource, baseQuery = {}) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const permissions = this.resourcePermissions[resource];
      if (!permissions || !permissions[user.role]) {
        return { ...baseQuery, _id: null }; // Return empty result
      }

      const readPermissions = permissions[user.role].read;
      if (readPermissions.includes('all')) {
        return baseQuery; // No filtering needed
      }

      // Apply role-based filters
      const roleFilters = await this.buildRoleFilters(user, resource, readPermissions);
      return { ...baseQuery, ...roleFilters };

    } catch (error) {
      console.error('Filter query error:', error);
      return { ...baseQuery, _id: null }; // Return empty result on error
    }
  }

  /**
   * Build MongoDB filter queries based on user role
   */
  async buildRoleFilters(user, resource, permissions) {
    const filters = {};
    const orConditions = [];

    for (const permission of permissions) {
      switch (permission) {
        case 'own':
          if (resource === 'rehabTask') {
            orConditions.push({ assignedTo: user._id });
          } else if (resource === 'progress') {
            orConditions.push({ userId: user._id });
          } else if (resource === 'notification') {
            orConditions.push({ recipient: user._id });
          } else if (resource === 'comment') {
            orConditions.push({ author: user._id });
          }
          break;

        case 'assigned':
          if (resource === 'rehabTask' && user.role === 'physiotherapist') {
            orConditions.push({ assignedBy: user._id });
          }
          break;

        case 'assigned_patients':
          if (user.assignedPatients && user.assignedPatients.length > 0) {
            if (resource === 'progress') {
              orConditions.push({ userId: { $in: user.assignedPatients } });
            } else if (resource === 'user') {
              orConditions.push({ _id: { $in: user.assignedPatients } });
            }
          }
          break;

        case 'assigned_patients_context':
          if (user.assignedPatients && user.assignedPatients.length > 0) {
            orConditions.push({ relatedPatient: { $in: user.assignedPatients } });
          }
          break;

        case 'visible_to_user':
          if (resource === 'comment') {
            orConditions.push({
              $or: [
                { 'visibleTo.user': user._id },
                { visibility: 'all_visible' },
                {
                  $and: [
                    { visibility: 'patient_visible' },
                    { relatedPatient: user._id }
                  ]
                }
              ]
            });
          }
          break;

        case 'own_context':
          if (resource === 'comment') {
            orConditions.push({
              $or: [
                { relatedPatient: user._id },
                { author: user._id }
              ]
            });
          }
          break;

        case 'own_profile':
          orConditions.push({ _id: user._id });
          break;
      }
    }

    if (orConditions.length > 0) {
      if (orConditions.length === 1) {
        Object.assign(filters, orConditions[0]);
      } else {
        filters.$or = orConditions;
      }
    }

    return filters;
  }

  /**
   * Check if resource belongs to user
   */
  async isOwnResource(userId, resource, targetData) {
    if (!targetData) return false;

    switch (resource) {
      case 'rehabTask':
        return targetData.assignedTo && targetData.assignedTo.toString() === userId.toString();
      case 'progress':
        return targetData.userId && targetData.userId.toString() === userId.toString();
      case 'comment':
        return targetData.author && targetData.author.toString() === userId.toString();
      case 'notification':
        return targetData.recipient && targetData.recipient.toString() === userId.toString();
      default:
        return false;
    }
  }

  /**
   * Check if resource is assigned to user (for physiotherapists)
   */
  async isAssignedResource(user, resource, targetData) {
    if (!targetData || user.role !== 'physiotherapist') return false;

    switch (resource) {
      case 'rehabTask':
        return targetData.assignedBy && targetData.assignedBy.toString() === user._id.toString();
      case 'progress':
        return user.assignedPatients &&
               user.assignedPatients.some(p => p.toString() === targetData.userId.toString());
      default:
        return false;
    }
  }

  /**
   * Check if user can access data in assigned patient context
   */
  async isAssignedPatientContext(user, targetData) {
    if (!targetData || !user.assignedPatients) return false;

    return targetData.relatedPatient &&
           user.assignedPatients.some(p => p.toString() === targetData.relatedPatient.toString());
  }

  /**
   * Check if comment is visible to user
   */
  async isVisibleToUser(userId, targetData) {
    if (!targetData) return false;

    // Check explicit visibility settings
    if (targetData.visibleTo && targetData.visibleTo.some(v => v.user.toString() === userId.toString())) {
      return true;
    }

    // Check visibility levels
    switch (targetData.visibility) {
      case 'all_visible':
        return true;
      case 'patient_visible':
        return targetData.relatedPatient && targetData.relatedPatient.toString() === userId.toString();
      case 'team_visible':
        // Would need to check team membership
        return true; // Simplified for now
      default:
        return false;
    }
  }

  /**
   * Check if user can comment in this context
   */
  async isOwnContext(userId, targetData) {
    if (!targetData) return false;

    return (targetData.relatedPatient && targetData.relatedPatient.toString() === userId.toString()) ||
           (targetData.author && targetData.author.toString() === userId.toString());
  }

  /**
   * Check if target is an assigned patient
   */
  async isAssignedPatient(user, targetData) {
    if (!targetData || !user.assignedPatients) return false;

    return user.assignedPatients.some(p => p.toString() === targetData._id.toString());
  }

  /**
   * Check if user update is limited to safe fields
   */
  isLimitedUserUpdate(action) {
    // Define which user fields can be updated by different roles
    const allowedFields = ['firstName', 'lastName', 'phoneNumber', 'preferences'];
    // In a real implementation, you'd check the specific fields being updated
    return true; // Simplified for now
  }

  /**
   * Check if user can create notifications for target
   */
  async canCreateForAssigned(user, targetData) {
    if (!targetData || !user.assignedPatients) return false;

    return user.assignedPatients.some(p => p.toString() === targetData.recipient.toString());
  }

  /**
   * Check if user can moderate or owns the content
   */
  async canModerateOrOwn(user, targetData) {
    if (!targetData) return false;

    return (user.role === 'doctor') ||
           (targetData.author && targetData.author.toString() === user._id.toString());
  }

  /**
   * Get user's accessible patient IDs
   */
  async getAccessiblePatientIds(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return [];

      switch (user.role) {
        case 'patient':
          return [user._id];
        case 'physiotherapist':
          return user.assignedPatients || [];
        case 'doctor':
          const allPatients = await User.find({ role: 'patient' }).select('_id');
          return allPatients.map(p => p._id);
        default:
          return [];
      }
    } catch (error) {
      console.error('Error getting accessible patients:', error);
      return [];
    }
  }

  /**
   * Get user's accessible physiotherapist IDs
   */
  async getAccessiblePhysiotherapistIds(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) return [];

      switch (user.role) {
        case 'patient':
          // Find physiotherapists who have this patient assigned
          const physios = await User.find({
            role: 'physiotherapist',
            assignedPatients: user._id
          }).select('_id');
          return physios.map(p => p._id);
        case 'physiotherapist':
          return [user._id];
        case 'doctor':
          const allPhysios = await User.find({ role: 'physiotherapist' }).select('_id');
          return allPhysios.map(p => p._id);
        default:
          return [];
      }
    } catch (error) {
      console.error('Error getting accessible physiotherapists:', error);
      return [];
    }
  }

  /**
   * Sanitize user data based on role and context
   */
  sanitizeUserData(requestingUser, targetUser) {
    const sanitized = { ...targetUser.toObject() };

    // Always remove sensitive data
    delete sanitized.password;
    delete sanitized.tokens;

    // Role-based field filtering
    if (requestingUser.role === 'patient' && requestingUser._id.toString() !== targetUser._id.toString()) {
      // Patients can only see limited info about other users
      return {
        _id: sanitized._id,
        firstName: sanitized.firstName,
        lastName: sanitized.lastName,
        role: sanitized.role
      };
    }

    if (requestingUser.role === 'physiotherapist') {
      // Physiotherapists can see more but not everything
      delete sanitized.personalHistory;
      delete sanitized.emergencyContacts;

      // Only show assigned patients' full info
      if (targetUser.role === 'patient' &&
          !requestingUser.assignedPatients.some(p => p.toString() === targetUser._id.toString())) {
        return {
          _id: sanitized._id,
          firstName: sanitized.firstName,
          lastName: sanitized.lastName,
          role: sanitized.role
        };
      }
    }

    // Doctors can see most info but remove some sensitive fields
    if (requestingUser.role === 'doctor') {
      delete sanitized.tokens;
    }

    return sanitized;
  }

  /**
   * Check if user can access specific task
   */
  async canAccessTask(userId, taskId) {
    try {
      const user = await User.findById(userId);
      const task = await RehabTask.findById(taskId);

      if (!user || !task) return false;

      return await this.hasPermission(userId, 'rehabTask', 'read', task);
    } catch (error) {
      console.error('Error checking task access:', error);
      return false;
    }
  }

  /**
   * Check if user can access specific progress entry
   */
  async canAccessProgress(userId, progressId) {
    try {
      const user = await User.findById(userId);
      const progress = await Progress.findById(progressId);

      if (!user || !progress) return false;

      return await this.hasPermission(userId, 'progress', 'read', progress);
    } catch (error) {
      console.error('Error checking progress access:', error);
      return false;
    }
  }

  /**
   * Get filtered data with pagination
   */
  async getFilteredData(userId, resource, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        ...additionalFilters
      } = options;

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

      // Get base query with access control filters
      const baseQuery = await this.getFilteredQuery(userId, resource, additionalFilters);

      let Model;
      switch (resource) {
        case 'rehabTask':
          Model = RehabTask;
          break;
        case 'progress':
          Model = Progress;
          break;
        case 'comment':
          Model = Comment;
          break;
        case 'notification':
          Model = Notification;
          break;
        case 'user':
          Model = User;
          break;
        default:
          throw new Error('Invalid resource type');
      }

      const [data, totalCount] = await Promise.all([
        Model.find(baseQuery)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Model.countDocuments(baseQuery)
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
        success: true,
        data,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = AccessControlService;