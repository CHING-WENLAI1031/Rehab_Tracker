const request = require('supertest');
const express = require('express');
const {
  validateBody,
  validateQuery,
  validateParams,
  validateFileUpload,
  validateCustom,
  validateFieldCombinations,
  validateRateLimit
} = require('../../main/js/api/middleware/validationMiddleware');

// Mock the dependencies
jest.mock('../../main/js/core/validation/schemas', () => ({
  userRegistration: {
    email: [(value) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return {
        isValid: typeof value === 'string' && emailRegex.test(value),
        message: typeof value === 'string' && emailRegex.test(value) ? null : 'Invalid email format'
      };
    }],
    password: [(value) => {
      return {
        isValid: typeof value === 'string' && value.length >= 8,
        message: typeof value === 'string' && value.length >= 8 ? null : 'Password must be at least 8 characters long'
      };
    }]
  },
  queryParams: {
    page: [(value) => {
      if (!value) return { isValid: true, message: null };
      const numValue = parseInt(value);
      return {
        isValid: numValue >= 1 && numValue <= 1000,
        message: numValue >= 1 && numValue <= 1000 ? null : 'Page must be between 1 and 1000'
      };
    }]
  }
}));

jest.mock('../../main/js/core/validation/validators', () => ({
  validateSchema: jest.fn(),
  validateObjectId: jest.fn(),
  validateFile: jest.fn(),
  sanitizeInput: jest.fn((input) => input)
}));

const ValidationUtils = require('../../main/js/core/validation/validators');

describe('Validation Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    jest.clearAllMocks();
  });

  describe('validateBody', () => {
    test('should pass validation with valid data', async () => {
      ValidationUtils.validateSchema.mockReturnValue({
        isValid: true,
        errors: null
      });

      app.post('/test', validateBody('userRegistration'), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test')
        .send({
          email: 'test@example.com',
          password: 'validpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject invalid data', async () => {
      ValidationUtils.validateSchema.mockReturnValue({
        isValid: false,
        errors: { email: 'Invalid email format' }
      });

      app.post('/test', validateBody('userRegistration'), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test')
        .send({
          email: 'invalid-email',
          password: 'short'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toEqual({ email: 'Invalid email format' });
    });

    test('should return 500 for unknown schema', async () => {
      app.post('/test', validateBody('unknownSchema'), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test')
        .send({ test: 'data' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
      expect(response.body.message).toBe('Validation schema not found');
    });
  });

  describe('validateQuery', () => {
    test('should validate query parameters', async () => {
      ValidationUtils.validateSchema.mockReturnValue({
        isValid: true,
        errors: null
      });

      app.get('/test', validateQuery(), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test?page=1&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject invalid query parameters', async () => {
      ValidationUtils.validateSchema.mockReturnValue({
        isValid: false,
        errors: { page: 'Page must be between 1 and 1000' }
      });

      app.get('/test', validateQuery(), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test?page=0');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid query parameters');
    });
  });

  describe('validateParams', () => {
    test('should validate valid ObjectId parameters', async () => {
      ValidationUtils.validateObjectId.mockReturnValue({
        isValid: true,
        message: null
      });

      app.get('/test/:id', validateParams(['id']), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test/507f1f77bcf86cd799439011');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject invalid ObjectId parameters', async () => {
      ValidationUtils.validateObjectId.mockReturnValue({
        isValid: false,
        message: 'Invalid ID format'
      });

      app.get('/test/:id', validateParams(['id']), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .get('/test/invalid-id');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid parameters');
      expect(response.body.details.id).toBe('Invalid ID format');
    });
  });

  describe('validateFileUpload', () => {
    test('should validate file within limits', async () => {
      ValidationUtils.validateFile.mockReturnValue({
        isValid: true,
        message: null
      });

      // Mock multer middleware to simulate file upload
      app.use('/test', (req, res, next) => {
        req.file = {
          fieldname: 'file',
          originalname: 'test.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          size: 1024
        };
        next();
      });

      app.post('/test', validateFileUpload({ required: true }), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject missing required file', async () => {
      app.post('/test-required', validateFileUpload({ required: true }), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test-required');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('File required');
    });

    test('should reject invalid file', async () => {
      ValidationUtils.validateFile.mockReturnValue({
        isValid: false,
        message: 'File size too large'
      });

      // Mock multer middleware to simulate file upload
      app.use('/test-invalid', (req, res, next) => {
        req.file = {
          fieldname: 'file',
          originalname: 'large.jpg',
          encoding: '7bit',
          mimetype: 'image/jpeg',
          size: 10 * 1024 * 1024 // 10MB
        };
        next();
      });

      app.post('/test-invalid', validateFileUpload(), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test-invalid');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid file');
      expect(response.body.message).toBe('File size too large');
    });
  });

  describe('validateCustom', () => {
    test('should pass custom validation', async () => {
      const customValidator = jest.fn().mockResolvedValue({
        isValid: true,
        message: null
      });

      app.post('/test', validateCustom(customValidator), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test')
        .send({ test: 'data' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(customValidator).toHaveBeenCalledWith(expect.objectContaining({
        body: { test: 'data' }
      }));
    });

    test('should fail custom validation', async () => {
      const customValidator = jest.fn().mockResolvedValue({
        isValid: false,
        message: 'Custom validation failed',
        details: { field: 'error' }
      });

      app.post('/test', validateCustom(customValidator), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test')
        .send({ test: 'data' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.message).toBe('Custom validation failed');
      expect(response.body.details).toEqual({ field: 'error' });
    });
  });

  describe('validateFieldCombinations', () => {
    test('should pass field combination validation', async () => {
      const rules = [
        {
          fields: ['startDate', 'endDate'],
          validator: (startDate, endDate) => !endDate || new Date(startDate) < new Date(endDate),
          message: 'End date must be after start date'
        }
      ];

      app.post('/test', validateFieldCombinations(rules), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test')
        .send({
          startDate: '2023-01-01',
          endDate: '2023-12-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should fail field combination validation', async () => {
      const rules = [
        {
          fields: ['startDate', 'endDate'],
          validator: (startDate, endDate) => !endDate || new Date(startDate) < new Date(endDate),
          message: 'End date must be after start date'
        }
      ];

      app.post('/test', validateFieldCombinations(rules), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test')
        .send({
          startDate: '2023-12-31',
          endDate: '2023-01-01'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Field combination validation failed');
      expect(response.body.message).toBe('End date must be after start date');
    });
  });

  describe('validateRateLimit', () => {
    test('should allow requests within rate limit', async () => {
      app.get('/test', validateRateLimit({ max: 5, windowMs: 60000 }), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });

    test('should block requests exceeding rate limit', async () => {
      app.get('/test', validateRateLimit({ max: 1, windowMs: 60000 }), (req, res) => {
        res.json({ success: true });
      });

      // First request should pass
      await request(app).get('/test');

      // Second request should be blocked
      const response = await request(app).get('/test');
      expect(response.status).toBe(429);
      expect(response.body.error).toBe('Rate limit exceeded');
    });
  });

  describe('Error handling', () => {
    test('should handle middleware errors gracefully', async () => {
      const faultyValidator = () => {
        throw new Error('Validation error');
      };

      app.post('/test', validateCustom(faultyValidator), (req, res) => {
        res.json({ success: true });
      });

      const response = await request(app)
        .post('/test')
        .send({ test: 'data' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });
});