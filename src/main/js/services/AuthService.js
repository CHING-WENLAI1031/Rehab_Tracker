const User = require('../models/User');
const jwtUtils = require('../core/auth/jwtUtils');
const passwordUtils = require('../core/auth/passwordUtils');

/**
 * Authentication Service
 * Handles user registration, login, token management, and authentication flows
 */

class AuthService {
  /**
   * Register a new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>} Created user and tokens
   */
  async register(userData) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        role,
        phoneNumber,
        dateOfBirth,
        ...otherData
      } = userData;

      // Validate required fields
      if (!firstName || !lastName || !email || !password || !role) {
        throw new Error('Missing required fields: firstName, lastName, email, password, role');
      }

      // Validate role
      const validRoles = ['patient', 'physiotherapist', 'doctor'];
      if (!validRoles.includes(role)) {
        throw new Error('Invalid role. Must be patient, physiotherapist, or doctor');
      }

      // Validate password strength
      const passwordStrength = passwordUtils.checkPasswordStrength(password);
      if (passwordStrength.level === 'very_weak' || passwordStrength.level === 'weak') {
        throw new Error(`Password is too weak. ${passwordStrength.feedback.join(', ')}`);
      }

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Create user object (password will be hashed by pre-save middleware)
      const userData_ = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        password,
        role,
        phoneNumber: phoneNumber?.trim(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        ...otherData
      };

      // Create user
      const user = new User(userData_);
      await user.save();

      // Generate tokens
      const tokens = await jwtUtils.generateTokenPair(user);

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Return user data (password excluded by schema transform)
      return {
        success: true,
        message: 'User registered successfully',
        data: {
          user: user.toJSON(),
          tokens
        }
      };

    } catch (error) {
      // Handle Mongoose validation errors
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(e => e.message);
        throw new Error(`Validation failed: ${messages.join(', ')}`);
      }

      // Handle duplicate key errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        throw new Error(`${field} already exists`);
      }

      throw error;
    }
  }

  /**
   * Login user with email and password
   * @param {String} email - User email
   * @param {String} password - User password
   * @returns {Promise<Object>} User data and tokens
   */
  async login(email, password) {
    try {
      // Validate input
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Find user and include password field
      const user = await User.findByEmail(email).select('+password');
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is deactivated. Please contact support');
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Generate tokens
      const tokens = await jwtUtils.generateTokenPair(user);

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      return {
        success: true,
        message: 'Login successful',
        data: {
          user: user.toJSON(),
          tokens
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {String} refreshToken - Valid refresh token
   * @returns {Promise<Object>} New access token
   */
  async refreshToken(refreshToken) {
    try {
      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }

      // Verify refresh token
      const decoded = await jwtUtils.verifyRefreshToken(refreshToken);

      // Find user to ensure they still exist and are active
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Generate new access token
      const tokenData = await jwtUtils.refreshAccessToken(refreshToken);

      return {
        success: true,
        message: 'Token refreshed successfully',
        data: tokenData
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout user (in a real app, you'd blacklist the token)
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Logout confirmation
   */
  async logout(userId) {
    try {
      // In a production app, you would:
      // 1. Add the token to a blacklist/revoked tokens list
      // 2. Store blacklisted tokens in Redis with expiration
      // 3. Check blacklist in auth middleware

      // For now, we'll just confirm logout
      // You could also update user's lastLogout timestamp if needed

      return {
        success: true,
        message: 'Logged out successfully'
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get current user profile
   * @param {String} userId - User ID from token
   * @returns {Promise<Object>} User profile data
   */
  async getCurrentUser(userId) {
    try {
      const user = await User.findById(userId)
        .populate('assignedPatients', 'firstName lastName email role')
        .populate('assignedProviders.providerId', 'firstName lastName role specialization');

      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      return {
        success: true,
        data: {
          user: user.toJSON()
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {String} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} Updated user data
   */
  async updateProfile(userId, updateData) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Remove fields that shouldn't be updated via this method
      const restrictedFields = ['password', 'email', 'role', '_id', 'createdAt', 'updatedAt'];
      restrictedFields.forEach(field => {
        delete updateData[field];
      });

      // Update user
      Object.assign(user, updateData);
      await user.save();

      return {
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: user.toJSON()
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
   * Change user password
   * @param {String} userId - User ID
   * @param {String} currentPassword - Current password
   * @param {String} newPassword - New password
   * @returns {Promise<Object>} Success confirmation
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Validate input
      if (!currentPassword || !newPassword) {
        throw new Error('Current password and new password are required');
      }

      // Find user with password
      const user = await User.findById(userId).select('+password');
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Check if new password is different from current
      const isSamePassword = await passwordUtils.comparePassword(newPassword, user.password);
      if (isSamePassword) {
        throw new Error('New password must be different from current password');
      }

      // Validate new password strength
      const passwordStrength = passwordUtils.checkPasswordStrength(newPassword);
      if (passwordStrength.level === 'very_weak' || passwordStrength.level === 'weak') {
        throw new Error(`New password is too weak. ${passwordStrength.feedback.join(', ')}`);
      }

      // Update password (will be hashed by pre-save middleware)
      user.password = newPassword;
      await user.save();

      return {
        success: true,
        message: 'Password changed successfully'
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Request password reset
   * @param {String} email - User email
   * @returns {Promise<Object>} Reset token (in production, send via email)
   */
  async requestPasswordReset(email) {
    try {
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return {
          success: true,
          message: 'If the email exists, a password reset link has been sent'
        };
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Generate password reset token
      const resetToken = await jwtUtils.generatePasswordResetToken(user);

      // In production, you would:
      // 1. Store the token with expiration in database
      // 2. Send email with reset link
      // 3. Never return the token in the response

      return {
        success: true,
        message: 'Password reset link has been sent to your email',
        // Remove this in production - only for development
        data: {
          resetToken,
          userId: user._id
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Reset password with token
   * @param {String} resetToken - Password reset token
   * @param {String} newPassword - New password
   * @returns {Promise<Object>} Success confirmation
   */
  async resetPassword(resetToken, newPassword) {
    try {
      if (!resetToken || !newPassword) {
        throw new Error('Reset token and new password are required');
      }

      // Verify reset token
      const decoded = await jwtUtils.verifyPasswordResetToken(resetToken);

      // Find user
      const user = await User.findById(decoded.userId).select('+password');
      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Validate new password
      const passwordStrength = passwordUtils.checkPasswordStrength(newPassword);
      if (passwordStrength.level === 'very_weak' || passwordStrength.level === 'weak') {
        throw new Error(`Password is too weak. ${passwordStrength.feedback.join(', ')}`);
      }

      // Check if new password is different from current
      const isSamePassword = await passwordUtils.comparePassword(newPassword, user.password);
      if (isSamePassword) {
        throw new Error('New password must be different from current password');
      }

      // Update password
      user.password = newPassword;
      await user.save();

      return {
        success: true,
        message: 'Password reset successfully'
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify user email
   * @param {String} userId - User ID
   * @param {String} verificationToken - Email verification token
   * @returns {Promise<Object>} Verification confirmation
   */
  async verifyEmail(userId, verificationToken) {
    try {
      // In a production app, you would:
      // 1. Generate and store email verification tokens
      // 2. Send verification emails during registration
      // 3. Verify token and mark email as verified

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.emailVerified = true;
      await user.save();

      return {
        success: true,
        message: 'Email verified successfully'
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Deactivate user account
   * @param {String} userId - User ID
   * @param {String} reason - Deactivation reason
   * @returns {Promise<Object>} Deactivation confirmation
   */
  async deactivateAccount(userId, reason = 'User requested') {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.isActive = false;
      await user.save();

      return {
        success: true,
        message: 'Account deactivated successfully'
      };

    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AuthService();