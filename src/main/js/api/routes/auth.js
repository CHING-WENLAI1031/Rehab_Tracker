const express = require('express');
const router = express.Router();
const AuthService = require('../../services/AuthService');
const { authenticate, optionalAuth } = require('../middleware/authMiddleware');

/**
 * Authentication Routes
 * Handles user registration, login, logout, and token management
 */

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const result = await AuthService.register(req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error('Registration error:', error.message);

    res.status(400).json({
      success: false,
      error: 'Registration failed',
      message: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user and return JWT token
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await AuthService.login(email, password);

    res.status(200).json(result);
  } catch (error) {
    console.error('Login error:', error.message);

    // Use generic message for security
    const isAuthError = error.message.includes('Invalid email or password') ||
                       error.message.includes('Account is deactivated');

    res.status(isAuthError ? 401 : 400).json({
      success: false,
      error: 'Login failed',
      message: isAuthError ? error.message : 'Login request failed'
    });
  }
});

// @route   POST /api/auth/refresh
// @desc    Refresh JWT token
// @access  Public
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token required',
        message: 'Refresh token is required in request body'
      });
    }

    const result = await AuthService.refreshToken(refreshToken);
    res.status(200).json(result);
  } catch (error) {
    console.error('Token refresh error:', error.message);

    const isTokenError = error.message.includes('expired') ||
                        error.message.includes('invalid') ||
                        error.message.includes('User not found');

    res.status(isTokenError ? 401 : 400).json({
      success: false,
      error: 'Token refresh failed',
      message: isTokenError ? error.message : 'Token refresh request failed'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', authenticate, async (req, res) => {
  try {
    const result = await AuthService.logout(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    console.error('Logout error:', error.message);

    res.status(400).json({
      success: false,
      error: 'Logout failed',
      message: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await AuthService.getCurrentUser(req.user.id);
    res.status(200).json(result);
  } catch (error) {
    console.error('Get current user error:', error.message);

    res.status(error.message.includes('not found') ? 404 : 400).json({
      success: false,
      error: 'Failed to get user profile',
      message: error.message
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticate, async (req, res) => {
  try {
    const result = await AuthService.updateProfile(req.user.id, req.body);
    res.status(200).json(result);
  } catch (error) {
    console.error('Profile update error:', error.message);

    res.status(400).json({
      success: false,
      error: 'Profile update failed',
      message: error.message
    });
  }
});

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Current password and new password are required'
      });
    }

    const result = await AuthService.changePassword(req.user.id, currentPassword, newPassword);
    res.status(200).json(result);
  } catch (error) {
    console.error('Change password error:', error.message);

    const isAuthError = error.message.includes('Current password is incorrect');

    res.status(isAuthError ? 401 : 400).json({
      success: false,
      error: 'Password change failed',
      message: error.message
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email required',
        message: 'Email address is required'
      });
    }

    const result = await AuthService.requestPasswordReset(email);
    res.status(200).json(result);
  } catch (error) {
    console.error('Password reset request error:', error.message);

    // Always return success for security (don't reveal if email exists)
    res.status(200).json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Reset token and new password are required'
      });
    }

    const result = await AuthService.resetPassword(resetToken, newPassword);
    res.status(200).json(result);
  } catch (error) {
    console.error('Password reset error:', error.message);

    const isTokenError = error.message.includes('Invalid or expired') ||
                        error.message.includes('expired') ||
                        error.message.includes('invalid');

    res.status(isTokenError ? 401 : 400).json({
      success: false,
      error: 'Password reset failed',
      message: error.message
    });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify user email
// @access  Private
router.post('/verify-email', authenticate, async (req, res) => {
  try {
    const { verificationToken } = req.body;
    const result = await AuthService.verifyEmail(req.user.id, verificationToken);
    res.status(200).json(result);
  } catch (error) {
    console.error('Email verification error:', error.message);

    res.status(400).json({
      success: false,
      error: 'Email verification failed',
      message: error.message
    });
  }
});

// @route   POST /api/auth/deactivate
// @desc    Deactivate user account
// @access  Private
router.post('/deactivate', authenticate, async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await AuthService.deactivateAccount(req.user.id, reason);
    res.status(200).json(result);
  } catch (error) {
    console.error('Account deactivation error:', error.message);

    res.status(400).json({
      success: false,
      error: 'Account deactivation failed',
      message: error.message
    });
  }
});

// @route   GET /api/auth/check-token
// @desc    Check if token is valid
// @access  Public (optional auth)
router.get('/check-token', optionalAuth, (req, res) => {
  try {
    if (req.user) {
      res.status(200).json({
        success: true,
        message: 'Token is valid',
        data: {
          valid: true,
          user: req.user
        }
      });
    } else {
      res.status(200).json({
        success: true,
        message: 'No valid token provided',
        data: {
          valid: false
        }
      });
    }
  } catch (error) {
    console.error('Token check error:', error.message);

    res.status(400).json({
      success: false,
      error: 'Token check failed',
      message: error.message
    });
  }
});

module.exports = router;