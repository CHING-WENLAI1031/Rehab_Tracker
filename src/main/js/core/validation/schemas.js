const ValidationUtils = require('./validators');

/**
 * Validation Schemas
 * Defines validation rules for different data models and operations
 */

class ValidationSchemas {
  /**
   * User registration validation schema
   */
  static get userRegistration() {
    return {
      firstName: [
        (value) => ValidationUtils.validateString(value, {
          required: true,
          minLength: 2,
          maxLength: 50,
          pattern: /^[a-zA-Z\s\-']+$/
        })
      ],
      lastName: [
        (value) => ValidationUtils.validateString(value, {
          required: true,
          minLength: 2,
          maxLength: 50,
          pattern: /^[a-zA-Z\s\-']+$/
        })
      ],
      email: [
        (value) => ValidationUtils.validateEmail(value)
      ],
      password: [
        (value) => ValidationUtils.validatePassword(value, {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true
        })
      ],
      role: [
        (value) => ValidationUtils.validateEnum(value, ['patient', 'physiotherapist', 'doctor'], {
          required: true
        })
      ],
      phoneNumber: [
        (value) => ValidationUtils.validatePhoneNumber(value)
      ],
      dateOfBirth: [
        (value) => {
          if (!value) return { isValid: true, message: null };
          return ValidationUtils.validateDate(value, {
            allowFuture: false,
            maxDate: new Date().toISOString()
          });
        }
      ]
    };
  }

  /**
   * User login validation schema
   */
  static get userLogin() {
    return {
      email: [
        (value) => ValidationUtils.validateEmail(value)
      ],
      password: [
        (value) => ValidationUtils.validateString(value, {
          required: true,
          minLength: 1
        })
      ]
    };
  }

  /**
   * Rehab task creation validation schema
   */
  static get rehabTaskCreation() {
    return {
      title: [
        (value) => ValidationUtils.validateString(value, {
          required: true,
          minLength: 3,
          maxLength: 100
        })
      ],
      description: [
        (value) => ValidationUtils.validateString(value, {
          required: true,
          minLength: 10,
          maxLength: 500
        })
      ],
      category: [
        (value) => ValidationUtils.validateEnum(value, [
          'strength_training',
          'flexibility',
          'balance',
          'cardiovascular',
          'range_of_motion',
          'pain_management',
          'posture',
          'functional_movement',
          'other'
        ], { required: true })
      ],
      assignedTo: [
        (value) => ValidationUtils.validateObjectId(value)
      ],
      instructions: [
        (value) => ValidationUtils.validateArray(value, {
          minLength: 1,
          itemValidator: (item) => {
            const stepResult = ValidationUtils.validateNumericRange(item.step, {
              min: 1,
              required: true
            });
            if (!stepResult.isValid) return stepResult;

            return ValidationUtils.validateString(item.instruction, {
              required: true,
              minLength: 5,
              maxLength: 500
            });
          }
        })
      ],
      schedule: [
        (value, obj) => {
          if (!value || typeof value !== 'object') {
            return { isValid: false, message: 'Schedule is required' };
          }

          const dateResult = ValidationUtils.validateDate(value.startDate, {
            required: true,
            allowPast: false
          });
          if (!dateResult.isValid) return dateResult;

          if (value.endDate) {
            const endDateResult = ValidationUtils.validateDate(value.endDate, {
              allowPast: false,
              minDate: value.startDate
            });
            if (!endDateResult.isValid) return endDateResult;
          }

          return { isValid: true, message: null };
        }
      ]
    };
  }

  /**
   * Progress session recording validation schema
   */
  static get progressSession() {
    return {
      rehabTaskId: [
        (value) => ValidationUtils.validateObjectId(value)
      ],
      sessionDuration: [
        (value) => ValidationUtils.validateNumericRange(value, {
          min: 1,
          max: 300, // 5 hours max
          required: true
        })
      ],
      completionStatus: [
        (value) => ValidationUtils.validateEnum(value, [
          'completed',
          'partially_completed',
          'skipped',
          'unable_to_complete'
        ], { required: true })
      ],
      completionPercentage: [
        (value) => ValidationUtils.validateNumericRange(value, {
          min: 0,
          max: 100
        })
      ],
      assessments: [
        (value) => {
          if (!value || typeof value !== 'object') {
            return { isValid: false, message: 'Assessments are required' };
          }

          const requiredFields = [
            'painBefore', 'painDuring', 'painAfter',
            'mobilityBefore', 'mobilityAfter',
            'energyBefore', 'energyAfter'
          ];

          for (const field of requiredFields) {
            const result = ValidationUtils.validateNumericRange(value[field], {
              min: 0,
              max: 10,
              required: true
            });
            if (!result.isValid) {
              return { isValid: false, message: `${field}: ${result.message}` };
            }
          }

          return { isValid: true, message: null };
        }
      ],
      performance: [
        (value) => {
          if (!value) return { isValid: true, message: null };

          if (value.effortLevel !== undefined) {
            const result = ValidationUtils.validateNumericRange(value.effortLevel, {
              min: 1,
              max: 10
            });
            if (!result.isValid) return result;
          }

          if (value.difficultyLevel !== undefined) {
            const result = ValidationUtils.validateNumericRange(value.difficultyLevel, {
              min: 1,
              max: 10
            });
            if (!result.isValid) return result;
          }

          if (value.formQuality !== undefined) {
            const result = ValidationUtils.validateEnum(value.formQuality, [
              'excellent', 'good', 'fair', 'poor'
            ]);
            if (!result.isValid) return result;
          }

          return { isValid: true, message: null };
        }
      ],
      sessionContext: [
        (value) => {
          if (!value || typeof value !== 'object') {
            return { isValid: false, message: 'Session context is required' };
          }

          const locationResult = ValidationUtils.validateEnum(value.location, [
            'home', 'clinic', 'gym', 'outdoor', 'other'
          ], { required: true });
          if (!locationResult.isValid) return locationResult;

          const supervisionResult = ValidationUtils.validateEnum(value.supervision, [
            'supervised', 'independent', 'remote_guidance'
          ], { required: true });
          if (!supervisionResult.isValid) return supervisionResult;

          return { isValid: true, message: null };
        }
      ]
    };
  }

  /**
   * Password change validation schema
   */
  static get passwordChange() {
    return {
      currentPassword: [
        (value) => ValidationUtils.validateString(value, {
          required: true,
          minLength: 1
        })
      ],
      newPassword: [
        (value) => ValidationUtils.validatePassword(value, {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true
        })
      ]
    };
  }

  /**
   * Query parameter validation schema
   */
  static get queryParams() {
    return {
      page: [
        (value) => {
          if (!value) return { isValid: true, message: null };
          const numValue = parseInt(value);
          return ValidationUtils.validateNumericRange(numValue, {
            min: 1,
            max: 1000
          });
        }
      ],
      limit: [
        (value) => {
          if (!value) return { isValid: true, message: null };
          const numValue = parseInt(value);
          return ValidationUtils.validateNumericRange(numValue, {
            min: 1,
            max: 100
          });
        }
      ],
      startDate: [
        (value) => {
          if (!value) return { isValid: true, message: null };
          return ValidationUtils.validateDate(value);
        }
      ],
      endDate: [
        (value) => {
          if (!value) return { isValid: true, message: null };
          return ValidationUtils.validateDate(value);
        }
      ]
    };
  }

  /**
   * File upload validation schema
   */
  static get fileUpload() {
    return {
      file: [
        (value) => ValidationUtils.validateFile(value, {
          maxSize: 5 * 1024 * 1024, // 5MB
          allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
          required: true
        })
      ]
    };
  }

  /**
   * Comment creation validation schema
   */
  static get commentCreation() {
    return {
      content: [
        (value) => ValidationUtils.validateString(value, {
          required: true,
          minLength: 1,
          maxLength: 1000
        })
      ],
      type: [
        (value) => ValidationUtils.validateEnum(value, [
          'note', 'concern', 'achievement', 'question', 'feedback'
        ], { required: true })
      ],
      visibility: [
        (value) => ValidationUtils.validateEnum(value, [
          'patient_only', 'healthcare_team', 'all_assigned'
        ])
      ]
    };
  }
}

module.exports = ValidationSchemas;