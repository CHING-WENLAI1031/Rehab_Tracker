import React from 'react';
import { Box, Container, Typography, Paper } from '@mui/material';
import Navbar from './Navbar';

const Layout = ({ children, maxWidth = 'lg', showFooter = true }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: (theme) => theme.palette.grey[50],
      }}
    >
      {/* Navbar */}
      <Navbar />

      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          py: 3,
          px: { xs: 2, sm: 3 },
        }}
      >
        <Container maxWidth={maxWidth}>
          {children}
        </Container>
      </Box>

      {/* Footer (optional) */}
      {showFooter && (
        <Box
          component="footer"
          sx={{
            py: 2,
            px: 2,
            mt: 'auto',
            backgroundColor: (theme) => theme.palette.grey[200],
          }}
        >
          <Container maxWidth={maxWidth}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                textAlign: 'center',
                backgroundColor: 'transparent',
              }}
            >
              <Typography variant="body2" color="text.secondary">
                © {new Date().getFullYear()} Rehab Tracker. All rights reserved.
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Multi-role rehabilitation tracking system
              </Typography>
            </Paper>
          </Container>
        </Box>
      )}
    </Box>
  );
};

export default Layout;
