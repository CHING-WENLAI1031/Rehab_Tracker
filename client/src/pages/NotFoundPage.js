import React from 'react';
import { Box, Container, Typography, Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

const NotFoundPage = () => {
  const navigate = useNavigate();

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
          <ErrorOutlineIcon
            sx={{
              fontSize: 80,
              color: 'error.main',
              mb: 2,
            }}
          />
          <Typography variant="h2" component="h1" gutterBottom fontWeight="bold">
            404
          </Typography>
          <Typography variant="h5" gutterBottom color="text.secondary">
            Page Not Found
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            The page you're looking for doesn't exist or has been moved.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate(-1)}
              sx={{ minWidth: 120 }}
            >
              Go Back
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => navigate('/')}
              sx={{ minWidth: 120 }}
            >
              Go Home
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default NotFoundPage;
