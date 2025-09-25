/**
 * Validation Utilities
 * Centralized validation functions for consistent data validation across the application
 */

class ValidationUtils {
  /**
   * Validate email format
   * @param {String} email - Email to validate
   * @returns {Object} Validation result
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = typeof email === 'string' && emailRegex.test(email);

    return {
      isValid,
      message: isValid ? null : 'Invalid email format'
    };
  }

  /**
   * Validate password strength
   * @param {String} password - Password to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validatePassword(password, options = {}) {
    const defaults = {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false
    };

    const config = { ...defaults, ...options };
    const errors = [];

    if (!password || typeof password !== 'string') {
      return { isValid: false, message: 'Password is required' };
    }

    if (password.length < config.minLength) {
      errors.push(`Password must be at least ${config.minLength} characters long`);
    }

    if (config.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (config.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (config.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (config.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      message: errors.length > 0 ? errors.join(', ') : null
    };
  }

  /**
   * Validate ObjectId format
   * @param {String} id - ID to validate
   * @returns {Object} Validation result
   */
  static validateObjectId(id) {
    const mongoose = require('mongoose');
    const isValid = mongoose.Types.ObjectId.isValid(id);

    return {
      isValid,
      message: isValid ? null : 'Invalid ID format'
    };
  }

  /**
   * Validate date format and range
   * @param {String|Date} date - Date to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateDate(date, options = {}) {
    const { allowPast = true, allowFuture = true, minDate, maxDate } = options;

    if (!date) {
      return { isValid: false, message: 'Date is required' };
    }

    const dateObj = new Date(date);

    if (isNaN(dateObj.getTime())) {
      return { isValid: false, message: 'Invalid date format' };
    }

    const now = new Date();

    if (!allowPast && dateObj < now) {
      return { isValid: false, message: 'Date cannot be in the past' };
    }

    if (!allowFuture && dateObj > now) {
      return { isValid: false, message: 'Date cannot be in the future' };
    }

    if (minDate && dateObj < new Date(minDate)) {
      return { isValid: false, message: `Date cannot be before ${minDate}` };
    }

    if (maxDate && dateObj > new Date(maxDate)) {
      return { isValid: false, message: `Date cannot be after ${maxDate}` };
    }

    return { isValid: true, message: null };
  }

  /**
   * Validate phone number
   * @param {String} phone - Phone number to validate
   * @returns {Object} Validation result
   */
  static validatePhoneNumber(phone) {
    if (!phone) {
      return { isValid: true, message: null }; // Phone is optional
    }

    // Support multiple phone formats
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, '');
    const isValid = phoneRegex.test(cleanPhone);

    return {
      isValid,
      message: isValid ? null : 'Invalid phone number format'
    };
  }

  /**
   * Validate numeric range
   * @param {Number} value - Value to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateNumericRange(value, options = {}) {
    const { min = -Infinity, max = Infinity, required = false } = options;

    if (value === undefined || value === null) {
      if (required) {
        return { isValid: false, message: 'Value is required' };
      }
      return { isValid: true, message: null };
    }

    if (typeof value !== 'number' || isNaN(value)) {
      return { isValid: false, message: 'Value must be a number' };
    }

    if (value < min) {
      return { isValid: false, message: `Value must be at least ${min}` };
    }

    if (value > max) {
      return { isValid: false, message: `Value cannot exceed ${max}` };
    }

    return { isValid: true, message: null };
  }

  /**
   * Validate string length and content
   * @param {String} value - String to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateString(value, options = {}) {
    const {
      minLength = 0,
      maxLength = Infinity,
      required = false,
      allowEmpty = false,
      pattern = null,
      trim = true
    } = options;

    if (value === undefined || value === null) {
      if (required) {
        return { isValid: false, message: 'Value is required' };
      }
      return { isValid: true, message: null };
    }

    if (typeof value !== 'string') {
      return { isValid: false, message: 'Value must be a string' };
    }

    const processedValue = trim ? value.trim() : value;

    if (!allowEmpty && processedValue.length === 0) {
      if (required) {
        return { isValid: false, message: 'Value cannot be empty' };
      }
      return { isValid: true, message: null };
    }

    if (processedValue.length < minLength) {
      return { isValid: false, message: `Value must be at least ${minLength} characters long` };
    }

    if (processedValue.length > maxLength) {
      return { isValid: false, message: `Value cannot exceed ${maxLength} characters` };
    }

    if (pattern && !pattern.test(processedValue)) {
      return { isValid: false, message: 'Value format is invalid' };
    }

    return { isValid: true, message: null };
  }

  /**
   * Validate array
   * @param {Array} array - Array to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateArray(array, options = {}) {
    const { minLength = 0, maxLength = Infinity, required = false, itemValidator = null } = options;

    if (!array) {
      if (required) {
        return { isValid: false, message: 'Array is required' };
      }
      return { isValid: true, message: null };
    }

    if (!Array.isArray(array)) {
      return { isValid: false, message: 'Value must be an array' };
    }

    if (array.length < minLength) {
      return { isValid: false, message: `Array must contain at least ${minLength} items` };
    }

    if (array.length > maxLength) {
      return { isValid: false, message: `Array cannot contain more than ${maxLength} items` };
    }

    if (itemValidator) {
      for (let i = 0; i < array.length; i++) {
        const itemResult = itemValidator(array[i], i);
        if (!itemResult.isValid) {
          return { isValid: false, message: `Item at index ${i}: ${itemResult.message}` };
        }
      }
    }

    return { isValid: true, message: null };
  }

  /**
   * Validate enum value
   * @param {*} value - Value to validate
   * @param {Array} allowedValues - Allowed values
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateEnum(value, allowedValues, options = {}) {
    const { required = false, caseSensitive = true } = options;

    if (value === undefined || value === null) {
      if (required) {
        return { isValid: false, message: 'Value is required' };
      }
      return { isValid: true, message: null };
    }

    const compareValue = caseSensitive ? value : String(value).toLowerCase();
    const compareAllowed = caseSensitive ? allowedValues : allowedValues.map(v => String(v).toLowerCase());

    const isValid = compareAllowed.includes(compareValue);

    return {
      isValid,
      message: isValid ? null : `Value must be one of: ${allowedValues.join(', ')}`
    };
  }

  /**
   * Validate complex object schema
   * @param {Object} obj - Object to validate
   * @param {Object} schema - Validation schema
   * @returns {Object} Validation result
   */
  static validateSchema(obj, schema) {
    const errors = {};
    let hasErrors = false;

    for (const [field, rules] of Object.entries(schema)) {
      const value = obj ? obj[field] : undefined;

      for (const rule of rules) {
        const result = rule(value, obj);
        if (!result.isValid) {
          errors[field] = result.message;
          hasErrors = true;
          break; // Stop at first error for this field
        }
      }
    }

    return {
      isValid: !hasErrors,
      errors: hasErrors ? errors : null
    };
  }

  /**
   * Sanitize input to prevent XSS
   * @param {String} input - Input to sanitize
   * @returns {String} Sanitized input
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Validate file upload
   * @param {Object} file - File object
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  static validateFile(file, options = {}) {
    const {
      maxSize = 5 * 1024 * 1024, // 5MB default
      allowedTypes = ['image/jpeg', 'image/png', 'image/gif'],
      required = false
    } = options;

    if (!file) {
      if (required) {
        return { isValid: false, message: 'File is required' };
      }
      return { isValid: true, message: null };
    }

    if (file.size > maxSize) {
      return {
        isValid: false,
        message: `File size cannot exceed ${Math.round(maxSize / 1024 / 1024)}MB`
      };
    }

    if (!allowedTypes.includes(file.mimetype)) {
      return {
        isValid: false,
        message: `File type must be one of: ${allowedTypes.join(', ')}`
      };
    }

    return { isValid: true, message: null };
  }
}

module.exports = ValidationUtils;