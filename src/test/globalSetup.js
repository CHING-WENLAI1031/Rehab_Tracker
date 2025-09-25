// Global setup that runs once before all tests
module.exports = async () => {
  console.log('🧪 Starting Jest test suite...');

  // Set global test environment variables
  process.env.NODE_ENV = 'test';
  process.env.PORT = '0';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

  // Note: In a real application, you might want to:
  // 1. Start a test database instance
  // 2. Set up test data
  // 3. Initialize test services

  console.log('✅ Global test setup completed');
};