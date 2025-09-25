// Test setup file that runs after Jest environment is set up

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random available port for testing
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.MONGODB_URI = 'mongodb://localhost:27017/rehab_tracker_test';

// Global test configurations
global.console = {
  ...console,
  // Suppress console.log during tests (keep errors and warnings)
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Global test utilities
global.testUtils = {
  // Helper function to create valid ObjectId for testing
  createObjectId: () => '507f1f77bcf86cd799439011',

  // Helper function to create test user data
  createTestUser: (overrides = {}) => ({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    password: 'SecurePass123',
    role: 'patient',
    phoneNumber: '+1234567890',
    ...overrides
  }),

  // Helper function to create test rehab task data
  createTestRehabTask: (overrides = {}) => ({
    title: 'Test Exercise',
    description: 'A test rehabilitation exercise for testing purposes.',
    category: 'strength_training',
    assignedTo: '507f1f77bcf86cd799439011',
    instructions: [
      { step: 1, instruction: 'Perform the first step of the exercise' },
      { step: 2, instruction: 'Perform the second step of the exercise' }
    ],
    schedule: {
      startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      endDate: new Date(Date.now() + 7 * 86400000).toISOString() // Next week
    },
    ...overrides
  }),

  // Helper function to create test progress session data
  createTestProgressSession: (overrides = {}) => ({
    rehabTaskId: '507f1f77bcf86cd799439011',
    sessionDuration: 45,
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
    },
    ...overrides
  })
};

// Mock console methods to reduce noise during testing
const originalConsoleError = console.error;
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // Clean up any test-specific configurations
  jest.restoreAllMocks();
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions in tests
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});