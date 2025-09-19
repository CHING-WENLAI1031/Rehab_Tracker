const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Password Utilities for secure password handling
 */

class PasswordUtils {
  constructor() {
    this.saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.minPasswordLength = 6;
    this.maxPasswordLength = 128;
  }

  /**
   * Hash password using bcrypt
   * @param {String} password - Plain text password
   * @param {Number} saltRounds - Number of salt rounds (optional)
   * @returns {Promise<String>} Hashed password
   */
  async hashPassword(password, saltRounds = null) {
    try {
      // Validate password first
      this.validatePassword(password);

      const rounds = saltRounds || this.saltRounds;
      return await bcrypt.hash(password, rounds);
    } catch (error) {
      throw new Error(`Password hashing failed: ${error.message}`);
    }
  }

  /**
   * Compare password with hash
   * @param {String} password - Plain text password
   * @param {String} hash - Hashed password
   * @returns {Promise<Boolean>} True if password matches
   */
  async comparePassword(password, hash) {
    try {
      if (!password || !hash) {
        return false;
      }

      return await bcrypt.compare(password, hash);
    } catch (error) {
      // Log error but don't throw - return false for security
      console.error('Password comparison error:', error.message);
      return false;
    }
  }

  /**
   * Validate password strength and format
   * @param {String} password - Password to validate
   * @throws {Error} If password doesn't meet requirements
   */
  validatePassword(password) {
    if (!password) {
      throw new Error('Password is required');
    }

    if (typeof password !== 'string') {
      throw new Error('Password must be a string');
    }

    if (password.length < this.minPasswordLength) {
      throw new Error(`Password must be at least ${this.minPasswordLength} characters long`);
    }

    if (password.length > this.maxPasswordLength) {
      throw new Error(`Password cannot exceed ${this.maxPasswordLength} characters`);
    }

    // Check for at least one letter and one number (basic requirement)
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);

    if (!hasLetter || !hasNumber) {
      throw new Error('Password must contain at least one letter and one number');
    }

    // Check for common weak passwords
    const weakPasswords = [
      'password', 'password123', '123456', '123456789', 'qwerty',
      'abc123', 'password1', 'admin', 'user', 'guest'
    ];

    if (weakPasswords.includes(password.toLowerCase())) {
      throw new Error('Password is too common and weak');
    }
  }

  /**
   * Check password strength and return strength score
   * @param {String} password - Password to check
   * @returns {Object} Strength analysis object
   */
  checkPasswordStrength(password) {
    const analysis = {
      score: 0,
      level: 'very_weak',
      feedback: []
    };

    if (!password) {
      analysis.feedback.push('Password is required');
      return analysis;
    }

    // Length check
    if (password.length >= 8) {
      analysis.score += 1;
    } else {
      analysis.feedback.push('Use at least 8 characters');
    }

    if (password.length >= 12) {
      analysis.score += 1;
    }

    // Character variety checks
    if (/[a-z]/.test(password)) {
      analysis.score += 1;
    } else {
      analysis.feedback.push('Add lowercase letters');
    }

    if (/[A-Z]/.test(password)) {
      analysis.score += 1;
    } else {
      analysis.feedback.push('Add uppercase letters');
    }

    if (/\d/.test(password)) {
      analysis.score += 1;
    } else {
      analysis.feedback.push('Add numbers');
    }

    if (/[^a-zA-Z0-9]/.test(password)) {
      analysis.score += 1;
    } else {
      analysis.feedback.push('Add special characters (!@#$%^&*)');
    }

    // Avoid common patterns
    if (!/(.)\1{2,}/.test(password)) { // No 3+ repeated characters
      analysis.score += 1;
    } else {
      analysis.feedback.push('Avoid repeated characters');
    }

    if (!/123|abc|qwe|asd|zxc/i.test(password)) { // No common sequences
      analysis.score += 1;
    } else {
      analysis.feedback.push('Avoid common sequences');
    }

    // Determine strength level
    if (analysis.score >= 7) {
      analysis.level = 'very_strong';
    } else if (analysis.score >= 5) {
      analysis.level = 'strong';
    } else if (analysis.score >= 3) {
      analysis.level = 'medium';
    } else if (analysis.score >= 1) {
      analysis.level = 'weak';
    }

    return analysis;
  }

  /**
   * Generate random password
   * @param {Number} length - Password length (default: 12)
   * @param {Object} options - Generation options
   * @returns {String} Generated password
   */
  generateRandomPassword(length = 12, options = {}) {
    const defaults = {
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSymbols: true,
      excludeSimilar: true, // Exclude similar characters (0, O, l, I, etc.)
      excludeAmbiguous: true // Exclude ambiguous characters
    };

    const config = { ...defaults, ...options };

    let charset = '';

    if (config.includeLowercase) {
      charset += config.excludeSimilar ? 'abcdefghjkmnpqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    }

    if (config.includeUppercase) {
      charset += config.excludeSimilar ? 'ABCDEFGHJKMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    }

    if (config.includeNumbers) {
      charset += config.excludeSimilar ? '23456789' : '0123456789';
    }

    if (config.includeSymbols) {
      charset += config.excludeAmbiguous ? '!@#$%^&*+-=' : '!@#$%^&*()_+-=[]{}|;:,.<>?';
    }

    if (!charset) {
      throw new Error('At least one character type must be included');
    }

    let password = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      password += charset[randomIndex];
    }

    // Ensure password meets basic requirements
    const strength = this.checkPasswordStrength(password);
    if (strength.score < 3) {
      // Recursively generate until we get a decent password
      return this.generateRandomPassword(length, options);
    }

    return password;
  }

  /**
   * Generate password reset token (secure random)
   * @param {Number} bytes - Number of random bytes (default: 32)
   * @returns {String} Hex-encoded random token
   */
  generatePasswordResetToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
  }

  /**
   * Generate secure random salt
   * @param {Number} bytes - Number of random bytes (default: 16)
   * @returns {String} Base64-encoded salt
   */
  generateSalt(bytes = 16) {
    return crypto.randomBytes(bytes).toString('base64');
  }

  /**
   * Time-safe password comparison to prevent timing attacks
   * @param {String} password - Plain text password
   * @param {String} hash - Hashed password
   * @returns {Promise<Boolean>} True if password matches
   */
  async timeSafeCompare(password, hash) {
    try {
      // Always perform the comparison even with invalid inputs
      const dummy = '$2b$12$dummy.hash.to.prevent.timing.attacks';
      const targetHash = hash || dummy;

      const result = await bcrypt.compare(password || '', targetHash);

      // Only return true if we have valid inputs and they match
      return hash && password && result;
    } catch (error) {
      console.error('Time-safe comparison error:', error.message);
      return false;
    }
  }

  /**
   * Check if password has been compromised (basic dictionary check)
   * @param {String} password - Password to check
   * @returns {Boolean} True if password appears compromised
   */
  isPasswordCompromised(password) {
    // Basic check against common compromised passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'password123',
      'abc123', '111111', 'password1', 'admin', 'welcome',
      'monkey', 'login', 'dragon', 'pass', 'master'
    ];

    return commonPasswords.includes(password.toLowerCase());
  }

  /**
   * Create password policy validator
   * @param {Object} policy - Password policy configuration
   * @returns {Function} Validator function
   */
  createPolicyValidator(policy = {}) {
    const defaultPolicy = {
      minLength: 8,
      maxLength: 128,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: false,
      maxRepeatedChars: 2,
      preventCommonPasswords: true
    };

    const config = { ...defaultPolicy, ...policy };

    return (password) => {
      const errors = [];

      if (!password) {
        errors.push('Password is required');
        return { isValid: false, errors };
      }

      if (password.length < config.minLength) {
        errors.push(`Password must be at least ${config.minLength} characters`);
      }

      if (password.length > config.maxLength) {
        errors.push(`Password cannot exceed ${config.maxLength} characters`);
      }

      if (config.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain uppercase letters');
      }

      if (config.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain lowercase letters');
      }

      if (config.requireNumbers && !/\d/.test(password)) {
        errors.push('Password must contain numbers');
      }

      if (config.requireSymbols && !/[^a-zA-Z0-9]/.test(password)) {
        errors.push('Password must contain special characters');
      }

      if (config.maxRepeatedChars > 0) {
        const repeatedPattern = new RegExp(`(.)\\1{${config.maxRepeatedChars},}`);
        if (repeatedPattern.test(password)) {
          errors.push(`Password cannot have more than ${config.maxRepeatedChars} repeated characters`);
        }
      }

      if (config.preventCommonPasswords && this.isPasswordCompromised(password)) {
        errors.push('Password is too common and easily guessed');
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    };
  }
}

// Export singleton instance
module.exports = new PasswordUtils();