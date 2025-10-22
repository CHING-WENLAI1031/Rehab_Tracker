const AccessControlService = require('../../services/AccessControlService');

/**
 * Access Control Middleware
 * Provides role-based data filtering and permission checking
 */

class AccessControlMiddleware {
  constructor() {
    this.accessControlService = new AccessControlService();
  }

  /**
   * Check if user has permission for a specific resource action
   */
  requirePermission(resource, action) {
    return async (req, res, next) => {
      try {
        if (!req.user || !req.user.id) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required'
          });
        }

        // Get target data from request params, body, or existing data
        const targetData = await this.getTargetData(req, resource);

        const hasPermission = await this.accessControlService.hasPermission(
          req.user.id,
          resource,
          action,
          targetData
        );

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: `You don't have permission to ${action} this ${resource}`
          });
        }

        // Store target data in request for later use
        if (targetData) {
          req.targetData = targetData;
        }

        next();
      } catch (error) {
        console.error('Permission check error:', error);
        res.status(500).json({
          success: false,
          error: 'Permission check failed',
          message: error.message
        });
      }
    };
  }

  /**
   * Apply data filtering based on user role and permissions
   */
  applyDataFiltering(resource) {
    return async (req, res, next) => {
      try {
        if (!req.user || !req.user.id) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required'
          });
        }

        // Get filtered query for the user
        const additionalFilters = this.extractFiltersFromQuery(req.query);
        const filteredQuery = await this.accessControlService.getFilteredQuery(
          req.user.id,
          resource,
          additionalFilters
        );

        // Store filtered query in request
        req.filteredQuery = filteredQuery;
        req.accessResource = resource;

        next();
      } catch (error) {
        console.error('Data filtering error:', error);
        res.status(500).json({
          success: false,
          error: 'Data filtering failed',
          message: error.message
        });
      }
    };
  }

  /**
   * Sanitize response data based on user permissions
   */
  sanitizeResponse(resource) {
    const self = this;
    return (req, res, next) => {
      // Override res.json to sanitize data before sending
      const originalJson = res.json;

      res.json = function(data) {
        try {
          if (data && data.data) {
            data.data = self.sanitizeDataByRole(req.user, data.data, resource);
          }

          return originalJson.call(this, data);
        } catch (error) {
          console.error('Response sanitization error:', error);
          return originalJson.call(this, {
            success: false,
            error: 'Data sanitization failed'
          });
        }
      };

      next();
    };
  }

  /**
   * Check if user can access specific resource by ID
   */
  requireResourceAccess(resource, paramName = 'id') {
    return async (req, res, next) => {
      try {
        const resourceId = req.params[paramName];
        if (!resourceId) {
          return res.status(400).json({
            success: false,
            error: 'Resource ID required'
          });
        }

        let canAccess = false;
        switch (resource) {
          case 'rehabTask':
            canAccess = await this.accessControlService.canAccessTask(req.user.id, resourceId);
            break;
          case 'progress':
            canAccess = await this.accessControlService.canAccessProgress(req.user.id, resourceId);
            break;
          default:
            // Generic permission check
            const targetData = await this.getResourceById(resource, resourceId);
            canAccess = await this.accessControlService.hasPermission(
              req.user.id,
              resource,
              'read',
              targetData
            );
        }

        if (!canAccess) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: `You don't have access to this ${resource}`
          });
        }

        next();
      } catch (error) {
        console.error('Resource access check error:', error);
        res.status(500).json({
          success: false,
          error: 'Access check failed',
          message: error.message
        });
      }
    };
  }

  /**
   * Ensure user can only access their assigned patients (for physiotherapists)
   */
  requireAssignedPatient() {
    return async (req, res, next) => {
      try {
        if (req.user.role === 'patient') {
          // Patients can only access their own data
          const patientId = req.params.patientId || req.params.id;
          if (patientId !== req.user.id) {
            return res.status(403).json({
              success: false,
              error: 'Access denied',
              message: 'You can only access your own data'
            });
          }
        } else if (req.user.role === 'physiotherapist') {
          // Physiotherapists can only access assigned patients
          const patientId = req.params.patientId || req.params.id;
          const user = await this.getUserById(req.user.id);

          if (!user.assignedPatients || !user.assignedPatients.includes(patientId)) {
            return res.status(403).json({
              success: false,
              error: 'Access denied',
              message: 'Patient is not assigned to you'
            });
          }
        }
        // Doctors have access to all patients

        next();
      } catch (error) {
        console.error('Assigned patient check error:', error);
        res.status(500).json({
          success: false,
          error: 'Access check failed',
          message: error.message
        });
      }
    };
  }

  /**
   * Filter query parameters based on user permissions
   */
  filterQueryParams(allowedParams) {
    return (req, res, next) => {
      const filteredQuery = {};

      // Only allow specified parameters
      for (const param of allowedParams) {
        if (req.query[param] !== undefined) {
          filteredQuery[param] = req.query[param];
        }
      }

      // Add role-based restrictions
      if (req.user.role === 'patient') {
        // Patients can only query their own data
        filteredQuery.userId = req.user.id;
      } else if (req.user.role === 'physiotherapist') {
        // Add assigned patients filter if not already specified
        if (!filteredQuery.userId && !filteredQuery.patientId) {
          filteredQuery.assignedPatients = req.user.assignedPatients;
        }
      }

      req.filteredQuery = { ...req.filteredQuery, ...filteredQuery };
      next();
    };
  }

  /**
   * Get target data from request context
   */
  async getTargetData(req, resource) {
    try {
      // Check if data is in request body (for POST/PUT requests)
      if (req.body && Object.keys(req.body).length > 0) {
        return req.body;
      }

      // Check if ID is in params (for GET/PUT/DELETE requests)
      const id = req.params.id || req.params[`${resource}Id`];
      if (id) {
        return await this.getResourceById(resource, id);
      }

      return null;
    } catch (error) {
      console.error('Error getting target data:', error);
      return null;
    }
  }

  /**
   * Get resource by ID from database
   */
  async getResourceById(resource, id) {
    const { mongoose } = require('mongoose');

    let Model;
    switch (resource) {
      case 'rehabTask':
        const RehabTask = require('../../models/RehabTask');
        Model = RehabTask;
        break;
      case 'progress':
        const Progress = require('../../models/Progress');
        Model = Progress;
        break;
      case 'comment':
        const Comment = require('../../models/Comment');
        Model = Comment;
        break;
      case 'notification':
        const Notification = require('../../models/Notification');
        Model = Notification;
        break;
      case 'user':
        const User = require('../../models/User');
        Model = User;
        break;
      default:
        throw new Error('Invalid resource type');
    }

    return await Model.findById(id);
  }

  /**
   * Get user by ID
   */
  async getUserById(id) {
    const User = require('../../models/User');
    return await User.findById(id);
  }

  /**
   * Extract additional filters from query parameters
   */
  extractFiltersFromQuery(query) {
    const filters = {};
    const filterableFields = [
      'status', 'priority', 'category', 'type', 'isRead', 'isDismissed',
      'createdAt', 'updatedAt', 'scheduledDate', 'completedAt'
    ];

    for (const field of filterableFields) {
      if (query[field] !== undefined) {
        filters[field] = query[field];
      }
    }

    // Handle date range filters
    if (query.dateFrom || query.dateTo) {
      filters.createdAt = {};
      if (query.dateFrom) filters.createdAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) filters.createdAt.$lte = new Date(query.dateTo);
    }

    return filters;
  }

  /**
   * Sanitize data based on user role
   */
  sanitizeDataByRole(user, data, resource) {
    if (!data || !user) return data;

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeSingleItem(user, item, resource));
    }

    return this.sanitizeSingleItem(user, data, resource);
  }

  /**
   * Sanitize single data item
   */
  sanitizeSingleItem(user, item, resource) {
    if (!item || typeof item !== 'object') return item;

    const sanitized = { ...item };

    // Remove sensitive fields based on resource type and user role
    switch (resource) {
      case 'user':
        return this.accessControlService.sanitizeUserData(user, item);

      case 'rehabTask':
        if (user.role === 'patient' && sanitized.assignedTo !== user.id) {
          // Patients can only see limited info about others' tasks
          return {
            _id: sanitized._id,
            title: sanitized.title,
            category: sanitized.category,
            status: sanitized.status
          };
        }
        break;

      case 'progress':
        if (user.role !== 'doctor' && sanitized.userId !== user.id) {
          // Non-doctors can't see detailed progress of unrelated patients
          delete sanitized.assessments;
          delete sanitized.notes;
        }
        break;

      case 'comment':
        // Remove edit history for non-authors
        if (sanitized.author !== user.id && user.role !== 'doctor') {
          delete sanitized.edited;
        }
        break;

      case 'notification':
        // Users can only see their own notifications
        if (sanitized.recipient !== user.id) {
          return null;
        }
        break;
    }

    return sanitized;
  }
}

// Create singleton instance
const accessControlMiddleware = new AccessControlMiddleware();

module.exports = {
  requirePermission: accessControlMiddleware.requirePermission.bind(accessControlMiddleware),
  applyDataFiltering: accessControlMiddleware.applyDataFiltering.bind(accessControlMiddleware),
  sanitizeResponse: accessControlMiddleware.sanitizeResponse.bind(accessControlMiddleware),
  requireResourceAccess: accessControlMiddleware.requireResourceAccess.bind(accessControlMiddleware),
  requireAssignedPatient: accessControlMiddleware.requireAssignedPatient.bind(accessControlMiddleware),
  filterQueryParams: accessControlMiddleware.filterQueryParams.bind(accessControlMiddleware),
  accessControlService: accessControlMiddleware.accessControlService
};