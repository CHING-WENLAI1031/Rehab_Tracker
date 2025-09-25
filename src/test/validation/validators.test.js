const ValidationUtils = require('../../main/js/core/validation/validators');

describe('ValidationUtils', () => {
  describe('validateEmail', () => {
    test('should validate correct email formats', () => {
      expect(ValidationUtils.validateEmail('test@example.com')).toEqual({
        isValid: true,
        message: null
      });

      expect(ValidationUtils.validateEmail('user.name@domain.co.uk')).toEqual({
        isValid: true,
        message: null
      });
    });

    test('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid.email',
        '@domain.com',
        'user@',
        '',
        null,
        undefined,
        123
      ];

      invalidEmails.forEach(email => {
        expect(ValidationUtils.validateEmail(email)).toEqual({
          isValid: false,
          message: 'Invalid email format'
        });
      });
    });
  });

  describe('validatePassword', () => {
    test('should validate strong passwords', () => {
      const result = ValidationUtils.validatePassword('StrongPass123');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe(null);
    });

    test('should reject weak passwords', () => {
      const weakPasswords = [
        { password: 'short', error: 'Password must be at least 8 characters long' },
        { password: 'nouppercase123', error: 'Password must contain at least one uppercase letter' },
        { password: 'NOLOWERCASE123', error: 'Password must contain at least one lowercase letter' },
        { password: 'NoNumbers', error: 'Password must contain at least one number' }
      ];

      weakPasswords.forEach(({ password, error }) => {
        const result = ValidationUtils.validatePassword(password);
        expect(result.isValid).toBe(false);
        expect(result.message).toContain(error);
      });
    });

    test('should handle custom password options', () => {
      const result = ValidationUtils.validatePassword('Test123!', {
        requireSpecialChars: true
      });
      expect(result.isValid).toBe(true);

      const result2 = ValidationUtils.validatePassword('Test123', {
        requireSpecialChars: true
      });
      expect(result2.isValid).toBe(false);
      expect(result2.message).toContain('special character');
    });
  });

  describe('validateObjectId', () => {
    test('should validate valid ObjectId', () => {
      const validId = '507f1f77bcf86cd799439011';
      const result = ValidationUtils.validateObjectId(validId);
      expect(result.isValid).toBe(true);
      expect(result.message).toBe(null);
    });

    test('should reject invalid ObjectId formats', () => {
      const invalidIds = ['invalid', '123', '', null];

      invalidIds.forEach(id => {
        const result = ValidationUtils.validateObjectId(id);
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Invalid ID format');
      });
    });
  });

  describe('validateDate', () => {
    test('should validate valid dates', () => {
      const validDate = '2023-12-25';
      const result = ValidationUtils.validateDate(validDate);
      expect(result.isValid).toBe(true);
      expect(result.message).toBe(null);
    });

    test('should reject invalid date formats', () => {
      const result = ValidationUtils.validateDate('invalid-date');
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Invalid date format');
    });

    test('should handle date range options', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
      const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday

      // Test allowPast: false
      const result1 = ValidationUtils.validateDate(pastDate, { allowPast: false });
      expect(result1.isValid).toBe(false);
      expect(result1.message).toBe('Date cannot be in the past');

      // Test allowFuture: false
      const result2 = ValidationUtils.validateDate(futureDate, { allowFuture: false });
      expect(result2.isValid).toBe(false);
      expect(result2.message).toBe('Date cannot be in the future');
    });
  });

  describe('validatePhoneNumber', () => {
    test('should validate phone numbers', () => {
      const validPhones = [
        '+1234567890',
        '1234567890',
        '+44 123 456 7890',
        '123-456-7890'
      ];

      validPhones.forEach(phone => {
        const result = ValidationUtils.validatePhoneNumber(phone);
        expect(result.isValid).toBe(true);
      });
    });

    test('should allow empty phone numbers (optional)', () => {
      const result = ValidationUtils.validatePhoneNumber('');
      expect(result.isValid).toBe(true);
      expect(result.message).toBe(null);
    });

    test('should reject invalid phone formats', () => {
      const invalidPhones = ['abc', '0123456789012345678', '++123', 'phone'];

      invalidPhones.forEach(phone => {
        const result = ValidationUtils.validatePhoneNumber(phone);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('validateNumericRange', () => {
    test('should validate numbers within range', () => {
      const result = ValidationUtils.validateNumericRange(5, { min: 1, max: 10 });
      expect(result.isValid).toBe(true);
      expect(result.message).toBe(null);
    });

    test('should reject numbers outside range', () => {
      const result1 = ValidationUtils.validateNumericRange(15, { min: 1, max: 10 });
      expect(result1.isValid).toBe(false);
      expect(result1.message).toBe('Value cannot exceed 10');

      const result2 = ValidationUtils.validateNumericRange(-1, { min: 1, max: 10 });
      expect(result2.isValid).toBe(false);
      expect(result2.message).toBe('Value must be at least 1');
    });

    test('should handle required option', () => {
      const result = ValidationUtils.validateNumericRange(null, { required: true });
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Value is required');
    });
  });

  describe('validateString', () => {
    test('should validate strings within length limits', () => {
      const result = ValidationUtils.validateString('Hello', { minLength: 3, maxLength: 10 });
      expect(result.isValid).toBe(true);
      expect(result.message).toBe(null);
    });

    test('should reject strings outside length limits', () => {
      const result1 = ValidationUtils.validateString('Hi', { minLength: 3 });
      expect(result1.isValid).toBe(false);
      expect(result1.message).toBe('Value must be at least 3 characters long');

      const result2 = ValidationUtils.validateString('This is too long', { maxLength: 5 });
      expect(result2.isValid).toBe(false);
      expect(result2.message).toBe('Value cannot exceed 5 characters');
    });

    test('should validate against pattern', () => {
      const result = ValidationUtils.validateString('abc123', { pattern: /^[a-z]+$/ });
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Value format is invalid');
    });
  });

  describe('validateArray', () => {
    test('should validate arrays within length limits', () => {
      const result = ValidationUtils.validateArray([1, 2, 3], { minLength: 2, maxLength: 5 });
      expect(result.isValid).toBe(true);
      expect(result.message).toBe(null);
    });

    test('should validate array items with custom validator', () => {
      const itemValidator = (item) => ({
        isValid: typeof item === 'number',
        message: 'Item must be a number'
      });

      const result = ValidationUtils.validateArray([1, 2, 'invalid'], { itemValidator });
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('Item at index 2');
    });
  });

  describe('validateEnum', () => {
    test('should validate enum values', () => {
      const result = ValidationUtils.validateEnum('patient', ['patient', 'doctor', 'physiotherapist']);
      expect(result.isValid).toBe(true);
      expect(result.message).toBe(null);
    });

    test('should reject invalid enum values', () => {
      const result = ValidationUtils.validateEnum('invalid', ['patient', 'doctor']);
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('Value must be one of: patient, doctor');
    });

    test('should handle case sensitivity', () => {
      const result = ValidationUtils.validateEnum('PATIENT', ['patient'], { caseSensitive: false });
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateSchema', () => {
    test('should validate complete schema', () => {
      const schema = {
        name: [(value) => ValidationUtils.validateString(value, { required: true })],
        email: [(value) => ValidationUtils.validateEmail(value)]
      };

      const validData = { name: 'John Doe', email: 'john@example.com' };
      const result = ValidationUtils.validateSchema(validData, schema);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBe(null);
    });

    test('should collect validation errors', () => {
      const schema = {
        name: [(value) => ValidationUtils.validateString(value, { required: true })],
        email: [(value) => ValidationUtils.validateEmail(value)]
      };

      const invalidData = { name: '', email: 'invalid-email' };
      const result = ValidationUtils.validateSchema(invalidData, schema);

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors.name).toBeDefined();
      expect(result.errors.email).toBeDefined();
    });
  });

  describe('sanitizeInput', () => {
    test('should sanitize HTML special characters', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = ValidationUtils.sanitizeInput(input);
      expect(sanitized).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    });

    test('should handle non-string inputs', () => {
      expect(ValidationUtils.sanitizeInput(123)).toBe(123);
      expect(ValidationUtils.sanitizeInput(null)).toBe(null);
    });
  });

  describe('validateFile', () => {
    test('should validate file within size and type limits', () => {
      const file = {
        size: 1024 * 1024, // 1MB
        mimetype: 'image/jpeg'
      };

      const result = ValidationUtils.validateFile(file, {
        maxSize: 5 * 1024 * 1024,
        allowedTypes: ['image/jpeg', 'image/png']
      });

      expect(result.isValid).toBe(true);
      expect(result.message).toBe(null);
    });

    test('should reject files exceeding size limit', () => {
      const file = {
        size: 10 * 1024 * 1024, // 10MB
        mimetype: 'image/jpeg'
      };

      const result = ValidationUtils.validateFile(file, {
        maxSize: 5 * 1024 * 1024
      });

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('File size cannot exceed 5MB');
    });

    test('should reject files with invalid types', () => {
      const file = {
        size: 1024,
        mimetype: 'application/pdf'
      };

      const result = ValidationUtils.validateFile(file, {
        allowedTypes: ['image/jpeg', 'image/png']
      });

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('File type must be one of');
    });
  });
});