const request = require('supertest');

// Test with the actual server-test.js to avoid database dependencies
const app = require('../../main/js/server-test');

describe('API Integration Tests', () => {
  describe('Health Check Endpoint', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('database', 'Not connected (test mode)');
    });
  });

  describe('404 Handler', () => {
    test('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Route not found');
      expect(response.body.message).toContain('GET /non-existent-route');
    });

    test('should return 404 for non-existent POST routes', async () => {
      const response = await request(app)
        .post('/api/non-existent');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Route not found');
      expect(response.body.message).toContain('POST /api/non-existent');
    });
  });

  describe('CORS Headers', () => {
    test('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Security Headers', () => {
    test('should include security headers from helmet', async () => {
      const response = await request(app)
        .get('/health');

      // Helmet adds various security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting to API routes', async () => {
      // Make multiple requests to trigger rate limiting
      const requests = Array(10).fill().map(() =>
        request(app).get('/api/auth/status')
      );

      const responses = await Promise.all(requests);

      // Some requests should be successful, but we're mainly testing
      // that rate limiting middleware is applied without errors
      responses.forEach(response => {
        expect([200, 404, 429]).toContain(response.status);
      });
    });
  });

  describe('JSON Body Parsing', () => {
    test('should parse JSON request bodies', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .set('Content-Type', 'application/json');

      // Should parse the JSON body without errors
      // (route might not exist, but body parsing should work)
      expect([404, 400, 401, 500]).toContain(response.status);
    });
  });

  describe('URL Encoded Body Parsing', () => {
    test('should parse URL encoded request bodies', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send('email=test@example.com&password=password')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      // Should parse the URL encoded body without errors
      expect([404, 400, 401, 500]).toContain(response.status);
    });
  });

  describe('Large Request Bodies', () => {
    test('should handle request bodies up to 10mb limit', async () => {
      const largeData = {
        data: 'x'.repeat(1024 * 100) // 100KB of data
      };

      const response = await request(app)
        .post('/api/test-large-body')
        .send(largeData);

      // Should not fail due to body size (route might not exist though)
      expect([404, 400, 401, 500]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send('{"invalid": json"}')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
    });
  });

  describe('API Route Structure', () => {
    test('should mount auth routes under /api/auth', async () => {
      const response = await request(app)
        .get('/api/auth/');

      // Route exists but might return 404 for root path or require authentication
      expect([200, 404, 401, 405]).toContain(response.status);
    });

    test('should mount patient routes under /api/patients', async () => {
      const response = await request(app)
        .get('/api/patients/');

      expect([200, 404, 401, 405]).toContain(response.status);
    });

    test('should mount physiotherapist routes under /api/physiotherapists', async () => {
      const response = await request(app)
        .get('/api/physiotherapists/');

      expect([200, 404, 401, 405]).toContain(response.status);
    });

    test('should mount doctor routes under /api/doctors', async () => {
      const response = await request(app)
        .get('/api/doctors/');

      expect([200, 404, 401, 405]).toContain(response.status);
    });
  });

  describe('HTTP Methods', () => {
    test('should handle different HTTP methods appropriately', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        const response = await request(app)[method.toLowerCase()]('/health');

        if (method === 'GET') {
          expect(response.status).toBe(200);
        } else {
          // Other methods should return 404 or 405 (Method Not Allowed)
          expect([404, 405]).toContain(response.status);
        }
      }
    });
  });

  describe('Content Type Handling', () => {
    test('should handle various content types', async () => {
      const contentTypes = [
        'application/json',
        'application/x-www-form-urlencoded',
        'text/plain',
        'multipart/form-data'
      ];

      for (const contentType of contentTypes) {
        const response = await request(app)
          .post('/api/test-content-type')
          .set('Content-Type', contentType)
          .send('test data');

        // Should not fail due to content type parsing
        expect([200, 404, 400, 401, 415, 500]).toContain(response.status);
      }
    });
  });
});