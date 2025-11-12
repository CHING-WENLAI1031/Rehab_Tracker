import React, { useState } from 'react';
import {
  Container,
  Paper,
  Typography,
  Button,
  Box,
  Alert,
  CircularProgress,
  Divider,
  TextField
} from '@mui/material';
import { authAPI } from '../api/auth';
import { patientAPI } from '../api/patient';

function TestPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('patient@test.com');
  const [password, setPassword] = useState('password123');
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setUser(null);
    setResult({ test: 'Logout', data: { message: 'Logged out successfully' }, success: true });
  };

  const handleTest = async (testName, testFunction) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await testFunction();
      setResult({ test: testName, data: response, success: true });
    } catch (err) {
      setError({ test: testName, message: err.message || JSON.stringify(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h3" gutterBottom color="primary">
          🧪 API Test Page
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Test your backend API endpoints to verify everything is working!
        </Typography>

        {/* Auth Status Indicator */}
        {isLoggedIn && user && (
          <Alert severity="info" sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2">
                🔐 Logged in as: <strong>{user.email}</strong> ({user.role})
              </Typography>
              <Button
                variant="outlined"
                size="small"
                color="inherit"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </Box>
          </Alert>
        )}
        {!isLoggedIn && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2">
              ⚠️ Not logged in - Protected endpoints will fail
            </Typography>
          </Alert>
        )}

        <Divider sx={{ my: 3 }} />

        {/* Backend Health Check */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            1. Backend Health Check
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => handleTest('Health Check', async () => {
              const response = await fetch('http://localhost:3001/health');
              return await response.json();
            })}
            disabled={loading}
          >
            Test Backend Health
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Login Test */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            2. Test Login
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Try logging in with test credentials (saves auth token)
          </Typography>

          <Box sx={{ mb: 2 }}>
            <TextField
              fullWidth
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 1 }}
            />
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Box>

          <Button
            variant="contained"
            color="secondary"
            onClick={async () => {
              setLoading(true);
              setError(null);
              setResult(null);
              try {
                const response = await authAPI.login(email, password);
                if (response.success && response.data.token) {
                  // Save token to localStorage
                  localStorage.setItem('token', response.data.token);
                  localStorage.setItem('user', JSON.stringify(response.data.user));
                  setIsLoggedIn(true);
                  setUser(response.data.user);
                  setResult({
                    test: 'Login',
                    data: {
                      ...response,
                      note: '✅ Token saved! Protected endpoints will now work.'
                    },
                    success: true
                  });
                } else {
                  setResult({ test: 'Login', data: response, success: true });
                }
              } catch (err) {
                setError({ test: 'Login', message: err.message || JSON.stringify(err) });
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            Test Login (Save Token)
          </Button>
          <Box sx={{ mt: 2, p: 1.5, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="caption" display="block" fontWeight="bold">
              Available Test Accounts:
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
              👤 Patient: patient@test.com / password123
            </Typography>
            <Typography variant="caption" display="block">
              🏥 Physiotherapist: physio@test.com / password123
            </Typography>
            <Typography variant="caption" display="block">
              👨‍⚕️ Doctor: doctor@test.com / password123
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Register Test */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            3. Test Registration
          </Typography>
          <Button
            variant="contained"
            color="success"
            onClick={() => handleTest('Register', () =>
              authAPI.register({
                firstName: 'Test',
                lastName: 'User',
                email: `test${Date.now()}@example.com`,
                password: 'password123',
                role: 'patient',
                phoneNumber: '+1234567890'
              })
            )}
            disabled={loading}
          >
            Register New Test User
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Protected Endpoint Test */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            4. Test Protected Endpoint (Requires Login)
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            This will fail if not logged in - that's expected!
          </Typography>
          <Button
            variant="contained"
            color="warning"
            onClick={() => handleTest('Patient Dashboard', () => patientAPI.getDashboard())}
            disabled={loading}
          >
            Get Patient Dashboard
          </Button>
        </Box>

        {/* Loading Indicator */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Success Result */}
        {result && (
          <Alert severity="success" sx={{ mt: 3 }}>
            <Typography variant="h6">✅ {result.test} - Success!</Typography>
            <Typography
              component="pre"
              sx={{
                mt: 2,
                p: 2,
                bgcolor: 'grey.100',
                borderRadius: 1,
                overflow: 'auto',
                maxHeight: 300,
                fontSize: '0.875rem'
              }}
            >
              {JSON.stringify(result.data, null, 2)}
            </Typography>
          </Alert>
        )}

        {/* Error Result */}
        {error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            <Typography variant="h6">❌ {error.test} - Failed</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {error.message}
            </Typography>
          </Alert>
        )}

        {/* Instructions */}
        <Box sx={{ mt: 4, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
          <Typography variant="h6" gutterBottom>
            💡 How to Use:
          </Typography>
          <Typography variant="body2" component="div">
            <ol>
              <li>Click "Test Backend Health" - Should show OK status</li>
              <li>Use one of the test accounts above to login</li>
              <li>After login, try "Get Patient Dashboard" - Should work now!</li>
              <li>Click "Logout" when done to clear your session</li>
              <li>Or register a new user with "Register New Test User"</li>
            </ol>
          </Typography>
        </Box>

        {/* API Documentation Link */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            📚 See full API documentation in <code>docs/api/</code> folder
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default TestPage;
