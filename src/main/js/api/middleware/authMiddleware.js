const jwtUtils = require('../../core/auth/jwtUtils');
const User = require('../../models/User');

/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user data to request
 */

/**
 * Main authentication middleware
 * Verifies JWT token and adds user data to request object
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = jwtUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied',
        message: 'No authentication token provided'
      });
    }

    // Verify token
    const decoded = await jwtUtils.verifyAccessToken(token);

    // Find user to ensure they still exist and are active
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account inactive',
        message: 'Your account has been deactivated'
      });
    }

    // Add user data to request object
    req.user = {
      id: user._id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      isActive: user.isActive,
      emailVerified: user.emailVerified
    };

    // Add full user object if needed (optional)
    req.userFull = user;

    next();

  } catch (error) {
    console.error('Authentication error:', error.message);

    let errorMessage = 'Authentication failed';
    let statusCode = 401;

    if (error.message.includes('expired')) {
      errorMessage = 'Token has expired';
    } else if (error.message.includes('invalid')) {
      errorMessage = 'Invalid token';
    } else if (error.message.includes('malformed')) {
      errorMessage = 'Malformed token';
    }

    return res.status(statusCode).json({
      success: false,
      error: 'Authentication failed',
      message: errorMessage
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user data if token is present, but doesn't require authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtUtils.extractTokenFromHeader(authHeader);

    if (token) {
      try {
        const decoded = await jwtUtils.verifyAccessToken(token);
        const user = await User.findById(decoded.userId);

        if (user && user.isActive) {
          req.user = {
            id: user._id,
            email: user.email,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            isActive: user.isActive,
            emailVerified: user.emailVerified
          };
          req.userFull = user;
        }
      } catch (tokenError) {
        // Silently ignore token errors for optional auth
        console.log('Optional auth token error:', tokenError.message);
      }
    }

    next();

  } catch (error) {
    // Don't fail for optional auth errors
    console.error('Optional authentication error:', error.message);
    next();
  }
};

/**
 * Require email verification middleware
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please login to access this resource'
    });
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      error: 'Email verification required',
      message: 'Please verify your email address to access this resource'
    });
  }

  next();
};

/**
 * Check if user owns resource or has permission
 * @param {Function} getResourceOwnerId - Function that returns the resource owner ID
 */
const requireOwnership = (getResourceOwnerId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please login to access this resource'
        });
      }

      const resourceOwnerId = await getResourceOwnerId(req);

      // Allow if user is the owner
      if (resourceOwnerId.toString() === req.user.id.toString()) {
        return next();
      }

      // Allow doctors and physiotherapists to access their patients' resources
      if (['doctor', 'physiotherapist'].includes(req.user.role)) {
        const owner = await User.findById(resourceOwnerId);
        if (owner && owner.role === 'patient') {
          // Check if this provider is assigned to this patient
          const isAssigned = owner.assignedProviders.some(
            provider => provider.providerId.toString() === req.user.id.toString()
          );

          if (isAssigned) {
            return next();
          }
        }
      }

      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to access this resource'
      });

    } catch (error) {
      console.error('Ownership check error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Permission check failed',
        message: 'Unable to verify resource ownership'
      });
    }
  };
};

/**
 * Rate limiting per user
 * @param {Object} options - Rate limiting options
 */
const userRateLimit = (options = {}) => {
  const defaults = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window per user
    message: 'Too many requests from this user'
  };

  const config = { ...defaults, ...options };
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next(); // Skip rate limiting for unauthenticated requests
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get or create user's request history
    if (!userRequests.has(userId)) {
      userRequests.set(userId, []);
    }

    const requests = userRequests.get(userId);

    // Remove old requests outside the window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    userRequests.set(userId, recentRequests);

    // Check if user has exceeded the limit
    if (recentRequests.length >= config.max) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: config.message,
        retryAfter: Math.ceil(config.windowMs / 1000)
      });
    }

    // Add current request
    recentRequests.push(now);
    userRequests.set(userId, recentRequests);

    next();
  };
};

/**
 * API Key authentication (for external integrations)
 * @param {String} validApiKey - Valid API key
 */
const authenticateApiKey = (validApiKey) => {
  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'API key required',
        message: 'Please provide a valid API key'
      });
    }

    if (apiKey !== validApiKey) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        message: 'The provided API key is invalid'
      });
    }

    req.apiAuthenticated = true;
    next();
  };
};

/**
 * Combine multiple authentication methods
 * @param {Array} methods - Array of authentication middleware functions
 */
const combineAuth = (...methods) => {
  return async (req, res, next) => {
    let lastError = null;

    // Try each authentication method
    for (const method of methods) {
      try {
        await new Promise((resolve, reject) => {
          method(req, res, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        // If we get here, authentication succeeded
        return next();
      } catch (error) {
        lastError = error;
        continue;
      }
    }

    // All authentication methods failed
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: lastError?.message || 'All authentication methods failed'
    });
  };
};

/**
 * Create middleware to check user status
 * @param {Array} allowedStatuses - Array of allowed user statuses
 */
const requireUserStatus = (allowedStatuses = ['active']) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please login to access this resource'
      });
    }

    const userStatus = req.user.isActive ? 'active' : 'inactive';

    if (!allowedStatuses.includes(userStatus)) {
      return res.status(403).json({
        success: false,
        error: 'Account status not allowed',
        message: `Your account status (${userStatus}) does not allow access to this resource`
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  optionalAuth,
  requireEmailVerification,
  requireOwnership,
  userRateLimit,
  authenticateApiKey,
  combineAuth,
  requireUserStatus
};