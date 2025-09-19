/**
 * Role-based Access Control Middleware
 * Controls access to resources based on user roles and permissions
 */

/**
 * Require specific roles to access a route
 * @param {Array|String} allowedRoles - Array of allowed roles or single role
 * @returns {Function} Middleware function
 */
const requireRoles = (allowedRoles) => {
  // Convert single role to array
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please login to access this resource'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.user.role}`
      });
    }

    next();
  };
};

/**
 * Require patient role
 */
const requirePatient = requireRoles(['patient']);

/**
 * Require physiotherapist role
 */
const requirePhysiotherapist = requireRoles(['physiotherapist']);

/**
 * Require doctor role
 */
const requireDoctor = requireRoles(['doctor']);

/**
 * Require healthcare provider role (physiotherapist or doctor)
 */
const requireHealthcareProvider = requireRoles(['physiotherapist', 'doctor']);

/**
 * Require admin-level access (doctor role with additional checks)
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please login to access this resource'
    });
  }

  if (req.user.role !== 'doctor') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required',
      message: 'Only doctors have administrative access'
    });
  }

  // Additional admin checks could go here
  // (e.g., specific permissions, admin flag, etc.)

  next();
};

/**
 * Role-based resource access control
 * Allows different levels of access based on user role
 */
const roleBasedAccess = (permissions) => {
  /**
   * permissions object structure:
   * {
   *   patient: ['read'], // patients can only read
   *   physiotherapist: ['read', 'write'], // physios can read and write
   *   doctor: ['read', 'write', 'delete'], // doctors have full access
   * }
   */

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please login to access this resource'
      });
    }

    const userRole = req.user.role;
    const allowedActions = permissions[userRole];

    if (!allowedActions) {
      return res.status(403).json({
        success: false,
        error: 'Role not authorized',
        message: `Your role (${userRole}) is not authorized for this resource`
      });
    }

    // Determine action based on HTTP method
    const methodToAction = {
      'GET': 'read',
      'POST': 'write',
      'PUT': 'write',
      'PATCH': 'write',
      'DELETE': 'delete'
    };

    const requiredAction = methodToAction[req.method];

    if (!allowedActions.includes(requiredAction)) {
      return res.status(403).json({
        success: false,
        error: 'Action not permitted',
        message: `Your role (${userRole}) cannot perform ${requiredAction} on this resource`
      });
    }

    // Add permission info to request
    req.permissions = {
      role: userRole,
      allowedActions,
      currentAction: requiredAction
    };

    next();
  };
};

/**
 * Patient data access control
 * Ensures users can only access their own data or assigned patients
 */
const patientDataAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please login to access this resource'
    });
  }

  const targetPatientId = req.params.patientId || req.params.id || req.body.patientId;

  // If no specific patient ID is provided, proceed (for list endpoints)
  if (!targetPatientId) {
    return next();
  }

  try {
    // Patients can only access their own data
    if (req.user.role === 'patient') {
      if (targetPatientId !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'Patients can only access their own data'
        });
      }
    }

    // Healthcare providers can access their assigned patients
    else if (['physiotherapist', 'doctor'].includes(req.user.role)) {
      const User = require('../../models/User');

      // Check if provider is assigned to this patient
      const patient = await User.findById(targetPatientId);

      if (!patient || patient.role !== 'patient') {
        return res.status(404).json({
          success: false,
          error: 'Patient not found',
          message: 'The specified patient does not exist'
        });
      }

      const isAssigned = patient.assignedProviders.some(
        provider => provider.providerId.toString() === req.user.id.toString()
      );

      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You are not assigned to this patient'
        });
      }
    }

    // Add patient data access info to request
    req.patientAccess = {
      targetPatientId,
      accessType: req.user.role === 'patient' ? 'self' : 'assigned'
    };

    next();

  } catch (error) {
    console.error('Patient data access check error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Access verification failed',
      message: 'Unable to verify patient data access'
    });
  }
};

/**
 * Provider assignment check
 * Ensures healthcare providers can only manage their assigned patients
 */
const providerAssignmentCheck = async (req, res, next) => {
  if (!req.user || !['physiotherapist', 'doctor'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Healthcare provider access required',
      message: 'Only physiotherapists and doctors can access this resource'
    });
  }

  const targetPatientId = req.params.patientId || req.body.patientId;

  if (!targetPatientId) {
    return next(); // Skip check if no patient ID provided
  }

  try {
    const User = require('../../models/User');

    // Check provider's assigned patients
    const provider = await User.findById(req.user.id);
    const isAssigned = provider.assignedPatients.includes(targetPatientId);

    if (!isAssigned) {
      return res.status(403).json({
        success: false,
        error: 'Patient not assigned',
        message: 'You are not assigned to manage this patient'
      });
    }

    next();

  } catch (error) {
    console.error('Provider assignment check error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Assignment verification failed',
      message: 'Unable to verify provider assignment'
    });
  }
};

/**
 * Conditional role access
 * Allows different access based on conditions
 */
const conditionalAccess = (conditions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please login to access this resource'
      });
    }

    try {
      for (const condition of conditions) {
        if (await condition.check(req)) {
          if (condition.allow) {
            return next();
          } else {
            return res.status(403).json({
              success: false,
              error: 'Access denied',
              message: condition.message || 'Access denied by condition'
            });
          }
        }
      }

      // If no conditions matched, deny by default
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'No access conditions met'
      });

    } catch (error) {
      console.error('Conditional access error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Access check failed',
        message: 'Unable to evaluate access conditions'
      });
    }
  };
};

/**
 * Time-based access control
 * Restricts access based on time windows
 */
const timeBasedAccess = (timeWindow) => {
  return (req, res, next) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

    if (timeWindow.hours) {
      const [startHour, endHour] = timeWindow.hours;
      if (currentHour < startHour || currentHour > endHour) {
        return res.status(403).json({
          success: false,
          error: 'Access restricted',
          message: `Access is only allowed between ${startHour}:00 and ${endHour}:00`
        });
      }
    }

    if (timeWindow.days) {
      if (!timeWindow.days.includes(currentDay)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const allowedDays = timeWindow.days.map(d => dayNames[d]).join(', ');
        return res.status(403).json({
          success: false,
          error: 'Access restricted',
          message: `Access is only allowed on: ${allowedDays}`
        });
      }
    }

    next();
  };
};

/**
 * Feature flag middleware
 * Controls access based on feature flags
 */
const requireFeature = (featureName) => {
  return (req, res, next) => {
    // In a real application, you'd check feature flags from a config service
    const featureFlags = {
      advanced_analytics: true,
      export_data: true,
      bulk_operations: false,
      experimental_features: false
    };

    if (!featureFlags[featureName]) {
      return res.status(403).json({
        success: false,
        error: 'Feature not available',
        message: `The ${featureName} feature is not currently enabled`
      });
    }

    next();
  };
};

module.exports = {
  requireRoles,
  requirePatient,
  requirePhysiotherapist,
  requireDoctor,
  requireHealthcareProvider,
  requireAdmin,
  roleBasedAccess,
  patientDataAccess,
  providerAssignmentCheck,
  conditionalAccess,
  timeBasedAccess,
  requireFeature
};