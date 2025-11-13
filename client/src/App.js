import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Components
import ProtectedRoute from './components/common/ProtectedRoute';
import Layout from './components/common/Layout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Patient Pages
import PatientDashboardPage from './pages/patient/DashboardPage';
import ProgressPage from './pages/patient/ProgressPage';
import TasksPage from './pages/patient/TasksPage';
import NotesPage from './pages/patient/NotesPage';

// Physiotherapist Pages
import PhysiotherapistDashboardPage from './pages/physiotherapist/DashboardPage';

// Doctor Pages
import DoctorDashboardPage from './pages/doctor/DashboardPage';

// Other Pages
import TestPage from './pages/TestPage';
import NotFoundPage from './pages/NotFoundPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

// Create Material-UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

// Home redirect component
const HomeRedirect = () => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to role-specific dashboard
  switch (user?.role) {
    case 'patient':
      return <Navigate to="/patient/dashboard" replace />;
    case 'physiotherapist':
      return <Navigate to="/physiotherapist/dashboard" replace />;
    case 'doctor':
      return <Navigate to="/doctor/dashboard" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Home Route - Redirect based on auth status */}
            <Route path="/" element={<HomeRedirect />} />

            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/test" element={<TestPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Patient Routes */}
            <Route
              path="/patient/dashboard"
              element={
                <ProtectedRoute allowedRoles={['patient']}>
                  <Layout>
                    <PatientDashboardPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/progress"
              element={
                <ProtectedRoute allowedRoles={['patient']}>
                  <Layout>
                    <ProgressPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/tasks"
              element={
                <ProtectedRoute allowedRoles={['patient']}>
                  <Layout>
                    <TasksPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/patient/notes"
              element={
                <ProtectedRoute allowedRoles={['patient']}>
                  <Layout>
                    <NotesPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Physiotherapist Routes */}
            <Route
              path="/physiotherapist/dashboard"
              element={
                <ProtectedRoute allowedRoles={['physiotherapist']}>
                  <Layout>
                    <PhysiotherapistDashboardPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/physiotherapist/patients"
              element={
                <ProtectedRoute allowedRoles={['physiotherapist']}>
                  <Layout>
                    <PhysiotherapistDashboardPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Doctor Routes */}
            <Route
              path="/doctor/dashboard"
              element={
                <ProtectedRoute allowedRoles={['doctor']}>
                  <Layout>
                    <DoctorDashboardPage />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/patients"
              element={
                <ProtectedRoute allowedRoles={['doctor']}>
                  <Layout>
                    <DoctorDashboardPage />
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* 404 Not Found - Must be last */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>

          {/* Toast Notifications */}
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
