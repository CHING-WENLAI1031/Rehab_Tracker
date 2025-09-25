const ValidationSchemas = require('../../core/validation/schemas');
const ValidationUtils = require('../../core/validation/validators');

/**
 * Validation Middleware
 * Provides middleware functions for validating request data against schemas
 */

/**
 * Create validation middleware for request body
 * @param {String} schemaName - Name of the validation schema to use
 * @returns {Function} Express middleware function
 */
const validateBody = (schemaName) => {
  return (req, res, next) => {
    try {
      const schema = ValidationSchemas[schemaName];
      if (!schema) {
        return res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: 'Validation schema not found'
        });
      }

      // Sanitize inputs
      const sanitizedBody = sanitizeObject(req.body);
      req.body = sanitizedBody;

      // Validate against schema
      const result = ValidationUtils.validateSchema(req.body, schema);

      if (!result.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: 'Invalid input data',
          details: result.errors
        });
      }

      next();
    } catch (error) {
      console.error('Validation middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Validation processing failed'
      });
    }
  };
};

/**
 * Create validation middleware for query parameters
 * @returns {Function} Express middleware function
 */
const validateQuery = () => {
  return (req, res, next) => {
    try {
      const schema = ValidationSchemas.queryParams;
      const result = ValidationUtils.validateSchema(req.query, schema);

      if (!result.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          message: 'Query parameter validation failed',
          details: result.errors
        });
      }

      next();
    } catch (error) {
      console.error('Query validation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Query validation processing failed'
      });
    }
  };
};

/**
 * Validate route parameters (IDs)
 * @param {Array} paramNames - Names of parameters to validate as ObjectIds
 * @returns {Function} Express middleware function
 */
const validateParams = (paramNames = []) => {
  return (req, res, next) => {
    try {
      const errors = {};

      for (const paramName of paramNames) {
        const value = req.params[paramName];
        if (value) {
          const result = ValidationUtils.validateObjectId(value);
          if (!result.isValid) {
            errors[paramName] = result.message;
          }
        }
      }

      if (Object.keys(errors).length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid parameters',
          message: 'Parameter validation failed',
          details: errors
        });
      }

      next();
    } catch (error) {
      console.error('Parameter validation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Parameter validation processing failed'
      });
    }
  };
};

/**
 * Validate file uploads
 * @param {Object} options - File validation options
 * @returns {Function} Express middleware function
 */
const validateFileUpload = (options = {}) => {
  return (req, res, next) => {
    try {
      const {
        required = false,
        maxSize = 5 * 1024 * 1024, // 5MB
        allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
      } = options;

      if (!req.file && required) {
        return res.status(400).json({
          success: false,
          error: 'File required',
          message: 'A file upload is required for this endpoint'
        });
      }

      if (req.file) {
        const result = ValidationUtils.validateFile(req.file, {
          maxSize,
          allowedTypes,
          required
        });

        if (!result.isValid) {
          return res.status(400).json({
            success: false,
            error: 'Invalid file',
            message: result.message
          });
        }
      }

      next();
    } catch (error) {
      console.error('File validation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'File validation processing failed'
      });
    }
  };
};

/**
 * Custom validation middleware
 * @param {Function} validator - Custom validation function
 * @returns {Function} Express middleware function
 */
const validateCustom = (validator) => {
  return async (req, res, next) => {
    try {
      const result = await validator(req);

      if (!result.isValid) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: result.message || 'Custom validation failed',
          details: result.details || null
        });
      }

      next();
    } catch (error) {
      console.error('Custom validation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Custom validation processing failed'
      });
    }
  };
};

/**
 * Validate specific field combinations
 * @param {Object} rules - Field combination rules
 * @returns {Function} Express middleware function
 */
const validateFieldCombinations = (rules) => {
  return (req, res, next) => {
    try {
      const errors = [];

      for (const rule of rules) {
        const { fields, validator, message } = rule;
        const values = fields.map(field => req.body[field]);

        if (!validator(...values)) {
          errors.push(message);
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Field combination validation failed',
          message: errors.join(', ')
        });
      }

      next();
    } catch (error) {
      console.error('Field combination validation error:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Field combination validation processing failed'
      });
    }
  };
};

/**
 * Sanitize object recursively
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return ValidationUtils.sanitizeInput(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Rate limiting validation
 * @param {Object} options - Rate limiting options
 * @returns {Function} Express middleware function
 */
const validateRateLimit = (options = {}) => {
  const { windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests' } = options;
  const requests = new Map();

  return (req, res, next) => {
    try {
      const key = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean old entries
      if (!requests.has(key)) {
        requests.set(key, []);
      }

      const userRequests = requests.get(key).filter(timestamp => timestamp > windowStart);
      requests.set(key, userRequests);

      if (userRequests.length >= max) {
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message,
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      userRequests.push(now);
      next();
    } catch (error) {
      console.error('Rate limit validation error:', error);
      next(); // Continue on error to not block legitimate requests
    }
  };
};

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  validateFileUpload,
  validateCustom,
  validateFieldCombinations,
  validateRateLimit,
  sanitizeObject
};