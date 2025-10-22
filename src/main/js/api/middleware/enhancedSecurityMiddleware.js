const { requirePermission, applyDataFiltering, requireResourceAccess, requireAssignedPatient } = require('./accessControlMiddleware');

/**
 * Enhanced Security Middleware
 * Provides convenient wrappers for common security patterns
 */

/**
 * Secure resource access with permission checking and data filtering
 */
function secureResource(resource) {
  return {
    // For GET requests - apply data filtering
    list: [applyDataFiltering(resource)],

    // For GET /:id requests - check resource access
    get: [requireResourceAccess(resource, 'id')],

    // For POST requests - check create permission
    create: [requirePermission(resource, 'write')],

    // For PUT /:id requests - check update permission
    update: [requireResourceAccess(resource, 'id'), requirePermission(resource, 'write')],

    // For DELETE /:id requests - check delete permission
    delete: [requireResourceAccess(resource, 'id'), requirePermission(resource, 'delete')]
  };
}

/**
 * Secure patient-related endpoints
 */
function securePatientEndpoint() {
  return [requireAssignedPatient()];
}

/**
 * Combined middleware for common patterns
 */
function securePatientResource(resource) {
  return {
    list: [requireAssignedPatient(), applyDataFiltering(resource)],
    get: [requireAssignedPatient(), requireResourceAccess(resource, 'id')],
    create: [requireAssignedPatient(), requirePermission(resource, 'write')],
    update: [requireAssignedPatient(), requireResourceAccess(resource, 'id'), requirePermission(resource, 'write')],
    delete: [requireAssignedPatient(), requireResourceAccess(resource, 'id'), requirePermission(resource, 'delete')]
  };
}

/**
 * Apply middleware arrays to Express routes
 */
function applySecurityMiddleware(router, basePath, resource, middlewareConfig) {
  if (middlewareConfig.list) {
    router.get(basePath, ...middlewareConfig.list);
  }

  if (middlewareConfig.get) {
    router.get(`${basePath}/:id`, ...middlewareConfig.get);
  }

  if (middlewareConfig.create) {
    router.post(basePath, ...middlewareConfig.create);
  }

  if (middlewareConfig.update) {
    router.put(`${basePath}/:id`, ...middlewareConfig.update);
  }

  if (middlewareConfig.delete) {
    router.delete(`${basePath}/:id`, ...middlewareConfig.delete);
  }
}

/**
 * Role hierarchy checking
 */
function requireMinimumRole(minimumRole) {
  const roleHierarchy = {
    'patient': 1,
    'physiotherapist': 2,
    'doctor': 3
  };

  return (req, res, next) => {
    const userRoleLevel = roleHierarchy[req.user.role] || 0;
    const minimumRoleLevel = roleHierarchy[minimumRole] || 0;

    if (userRoleLevel < minimumRoleLevel) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient role privileges',
        message: `Minimum role required: ${minimumRole}`
      });
    }

    next();
  };
}

/**
 * Context-aware permission checking
 */
function checkContextPermission(getContext) {
  return async (req, res, next) => {
    try {
      const context = await getContext(req);
      const hasAccess = await validateContext(req.user, context);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: 'You do not have permission to access this resource in this context'
        });
      }

      req.securityContext = context;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Context validation failed',
        message: error.message
      });
    }
  };
}

/**
 * Validate user access in specific context
 */
async function validateContext(user, context) {
  switch (user.role) {
    case 'patient':
      return context.patientId === user.id;
    case 'physiotherapist':
      return user.assignedPatients && user.assignedPatients.includes(context.patientId);
    case 'doctor':
      return true; // Doctors have full access
    default:
      return false;
  }
}

/**
 * Data sanitization middleware
 */
function sanitizeResponseData(sanitizationRules = {}) {
  return (req, res, next) => {
    const originalJson = res.json;

    res.json = function(data) {
      try {
        if (data && data.data) {
          data.data = applySanitizationRules(data.data, req.user, sanitizationRules);
        }

        return originalJson.call(this, data);
      } catch (error) {
        console.error('Data sanitization error:', error);
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
 * Apply sanitization rules based on user role
 */
function applySanitizationRules(data, user, rules) {
  if (!data || !user) return data;

  const roleRules = rules[user.role] || {};

  if (Array.isArray(data)) {
    return data.map(item => sanitizeItem(item, roleRules));
  }

  return sanitizeItem(data, roleRules);
}

/**
 * Sanitize individual data item
 */
function sanitizeItem(item, rules) {
  if (!item || typeof item !== 'object') return item;

  const sanitized = { ...item };

  // Remove forbidden fields
  if (rules.remove) {
    for (const field of rules.remove) {
      delete sanitized[field];
    }
  }

  // Keep only allowed fields
  if (rules.allowOnly) {
    const filtered = {};
    for (const field of rules.allowOnly) {
      if (sanitized.hasOwnProperty(field)) {
        filtered[field] = sanitized[field];
      }
    }
    return filtered;
  }

  return sanitized;
}

/**
 * Audit logging middleware
 */
function auditAction(action, resourceType) {
  return (req, res, next) => {
    // Log the access attempt
    const auditLog = {
      timestamp: new Date(),
      userId: req.user?.id,
      userRole: req.user?.role,
      action,
      resourceType,
      resourceId: req.params.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    // In production, this would go to a proper audit log system
    console.log('AUDIT:', JSON.stringify(auditLog));

    next();
  };
}

/**
 * Rate limiting per role
 */
function roleBasedRateLimit() {
  const rateLimits = {
    'patient': { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15 minutes
    'physiotherapist': { windowMs: 15 * 60 * 1000, max: 200 }, // 200 requests per 15 minutes
    'doctor': { windowMs: 15 * 60 * 1000, max: 300 } // 300 requests per 15 minutes
  };

  return (req, res, next) => {
    const userRole = req.user?.role || 'patient';
    const limit = rateLimits[userRole] || rateLimits.patient;

    // Store request info for rate limiting
    const key = `${userRole}_${req.user?.id || req.ip}`;

    // Simple in-memory rate limiting (in production, use Redis)
    if (!global.rateLimitStore) global.rateLimitStore = {};

    const now = Date.now();
    const userRequests = global.rateLimitStore[key] || [];

    // Clean old requests outside window
    const validRequests = userRequests.filter(timestamp =>
      now - timestamp < limit.windowMs
    );

    if (validRequests.length >= limit.max) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${limit.max} per ${limit.windowMs / 60000} minutes`
      });
    }

    // Add current request
    validRequests.push(now);
    global.rateLimitStore[key] = validRequests;

    next();
  };
}

/**
 * Security headers middleware
 */
function securityHeaders() {
  return (req, res, next) => {
    // Set security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'Content-Security-Policy': "default-src 'self'",
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    });

    next();
  };
}

module.exports = {
  secureResource,
  securePatientEndpoint,
  securePatientResource,
  applySecurityMiddleware,
  requireMinimumRole,
  checkContextPermission,
  sanitizeResponseData,
  auditAction,
  roleBasedRateLimit,
  securityHeaders
};