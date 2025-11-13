import React from 'react';
import { Box, Container, Typography, Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import BlockIcon from '@mui/icons-material/Block';
import { useAuth } from '../contexts/AuthContext';

const UnauthorizedPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleGoToDashboard = () => {
    if (user?.role) {
      navigate(`/${user.role}/dashboard`);
    } else {
      navigate('/login');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: (theme) => theme.palette.grey[50],
      }}
    >
      <Container maxWidth="sm">
        <Paper
          elevation={3}
          sx={{
            p: 4,
            textAlign: 'center',
            borderRadius: 2,
          }}
        >
          <BlockIcon
            sx={{
              fontSize: 80,
              color: 'warning.main',
              mb: 2,
            }}
          />
          <Typography variant="h2" component="h1" gutterBottom fontWeight="bold">
            403
          </Typography>
          <Typography variant="h5" gutterBottom color="text.secondary">
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
            You don't have permission to access this page.
          </Typography>
          {user && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Current role: <strong>{user.role}</strong>
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleGoToDashboard}
              sx={{ minWidth: 120 }}
            >
              Go to Dashboard
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleLogout}
              sx={{ minWidth: 120 }}
            >
              Logout
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default UnauthorizedPage;
