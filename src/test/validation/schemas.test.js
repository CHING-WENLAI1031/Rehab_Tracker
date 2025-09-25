const ValidationSchemas = require('../../main/js/core/validation/schemas');
const ValidationUtils = require('../../main/js/core/validation/validators');

describe('ValidationSchemas', () => {
  describe('userRegistration schema', () => {
    test('should validate complete user registration data', () => {
      const validUserData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'SecurePass123',
        role: 'patient',
        phoneNumber: '+1234567890',
        dateOfBirth: '1990-01-15'
      };

      const result = ValidationUtils.validateSchema(validUserData, ValidationSchemas.userRegistration);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBe(null);
    });

    test('should reject invalid user registration data', () => {
      const invalidUserData = {
        firstName: 'J', // Too short
        lastName: '', // Empty
        email: 'invalid-email', // Invalid format
        password: 'weak', // Too weak
        role: 'invalid-role', // Not in enum
        phoneNumber: 'abc', // Invalid format
        dateOfBirth: '2030-01-01' // Future date
      };

      const result = ValidationUtils.validateSchema(invalidUserData, ValidationSchemas.userRegistration);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(Object.keys(result.errors)).toContain('firstName');
      expect(Object.keys(result.errors)).toContain('lastName');
      expect(Object.keys(result.errors)).toContain('email');
      expect(Object.keys(result.errors)).toContain('password');
      expect(Object.keys(result.errors)).toContain('role');
    });

    test('should allow optional fields to be undefined', () => {
      const minimalUserData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'SecurePass123',
        role: 'patient'
      };

      const result = ValidationUtils.validateSchema(minimalUserData, ValidationSchemas.userRegistration);
      expect(result.isValid).toBe(true);
    });
  });

  describe('userLogin schema', () => {
    test('should validate login credentials', () => {
      const loginData = {
        email: 'user@example.com',
        password: 'password123'
      };

      const result = ValidationUtils.validateSchema(loginData, ValidationSchemas.userLogin);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBe(null);
    });

    test('should reject invalid login data', () => {
      const invalidLoginData = {
        email: 'invalid-email',
        password: ''
      };

      const result = ValidationUtils.validateSchema(invalidLoginData, ValidationSchemas.userLogin);
      expect(result.isValid).toBe(false);
      expect(result.errors.email).toBeDefined();
      expect(result.errors.password).toBeDefined();
    });
  });

  describe('rehabTaskCreation schema', () => {
    test('should validate complete rehab task data', () => {
      const validTaskData = {
        title: 'Shoulder Strengthening Exercise',
        description: 'A comprehensive shoulder strengthening routine for post-surgery recovery.',
        category: 'strength_training',
        assignedTo: '507f1f77bcf86cd799439011',
        instructions: [
          { step: 1, instruction: 'Warm up with light arm circles for 2 minutes' },
          { step: 2, instruction: 'Perform 3 sets of 10 shoulder raises with light weights' }
        ],
        schedule: {
          startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          endDate: new Date(Date.now() + 7 * 86400000).toISOString() // Next week
        }
      };

      const result = ValidationUtils.validateSchema(validTaskData, ValidationSchemas.rehabTaskCreation);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBe(null);
    });

    test('should reject invalid rehab task data', () => {
      const invalidTaskData = {
        title: 'X', // Too short
        description: 'Short', // Too short
        category: 'invalid-category', // Not in enum
        assignedTo: 'invalid-id', // Invalid ObjectId
        instructions: [], // Empty array
        schedule: {
          startDate: new Date(Date.now() - 86400000).toISOString() // Past date
        }
      };

      const result = ValidationUtils.validateSchema(invalidTaskData, ValidationSchemas.rehabTaskCreation);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('progressSession schema', () => {
    test('should validate complete progress session data', () => {
      const validSessionData = {
        rehabTaskId: '507f1f77bcf86cd799439011',
        sessionDuration: 45, // minutes
        completionStatus: 'completed',
        completionPercentage: 100,
        assessments: {
          painBefore: 3,
          painDuring: 2,
          painAfter: 1,
          mobilityBefore: 7,
          mobilityAfter: 8,
          energyBefore: 6,
          energyAfter: 5
        },
        performance: {
          effortLevel: 8,
          difficultyLevel: 6,
          formQuality: 'good'
        },
        sessionContext: {
          location: 'home',
          supervision: 'independent'
        }
      };

      const result = ValidationUtils.validateSchema(validSessionData, ValidationSchemas.progressSession);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBe(null);
    });

    test('should reject invalid progress session data', () => {
      const invalidSessionData = {
        rehabTaskId: 'invalid-id',
        sessionDuration: 400, // Too long
        completionStatus: 'invalid-status',
        completionPercentage: 150, // Out of range
        assessments: {
          painBefore: 15 // Out of range
        },
        sessionContext: {
          location: 'invalid-location'
        }
      };

      const result = ValidationUtils.validateSchema(invalidSessionData, ValidationSchemas.progressSession);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('passwordChange schema', () => {
    test('should validate password change data', () => {
      const passwordChangeData = {
        currentPassword: 'oldPassword123',
        newPassword: 'NewSecurePass456'
      };

      const result = ValidationUtils.validateSchema(passwordChangeData, ValidationSchemas.passwordChange);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBe(null);
    });

    test('should reject weak new passwords', () => {
      const weakPasswordData = {
        currentPassword: 'oldPassword123',
        newPassword: 'weak'
      };

      const result = ValidationUtils.validateSchema(weakPasswordData, ValidationSchemas.passwordChange);
      expect(result.isValid).toBe(false);
      expect(result.errors.newPassword).toBeDefined();
    });
  });

  describe('queryParams schema', () => {
    test('should validate query parameters', () => {
      const queryData = {
        page: '2',
        limit: '10',
        startDate: '2023-01-01',
        endDate: '2023-12-31'
      };

      const result = ValidationUtils.validateSchema(queryData, ValidationSchemas.queryParams);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBe(null);
    });

    test('should allow empty query parameters', () => {
      const emptyQuery = {};
      const result = ValidationUtils.validateSchema(emptyQuery, ValidationSchemas.queryParams);
      expect(result.isValid).toBe(true);
    });

    test('should reject invalid query parameters', () => {
      const invalidQuery = {
        page: '0', // Below minimum
        limit: '1000' // Above maximum
      };

      const result = ValidationUtils.validateSchema(invalidQuery, ValidationSchemas.queryParams);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('commentCreation schema', () => {
    test('should validate comment data', () => {
      const commentData = {
        content: 'This exercise helped reduce my pain significantly.',
        type: 'achievement',
        visibility: 'healthcare_team'
      };

      const result = ValidationUtils.validateSchema(commentData, ValidationSchemas.commentCreation);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBe(null);
    });

    test('should reject invalid comment data', () => {
      const invalidComment = {
        content: '', // Empty content
        type: 'invalid-type', // Not in enum
        visibility: 'invalid-visibility' // Not in enum
      };

      const result = ValidationUtils.validateSchema(invalidComment, ValidationSchemas.commentCreation);
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});