import React, { createContext, useState, useContext, useEffect } from 'react';
import { authAPI } from '../api/auth';
import { toast } from 'react-toastify';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (token && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setIsAuthenticated(true);

          // Verify token is still valid
          const response = await authAPI.getCurrentUser();
          if (response.success) {
            setUser(response.data.user);
            localStorage.setItem('user', JSON.stringify(response.data.user));
          }
        } catch (error) {
          console.error('Failed to load user:', error);
          logout();
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);

      if (response.success) {
        const { token, user } = response.data;

        // Store auth data
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        // Update state
        setUser(user);
        setIsAuthenticated(true);

        toast.success(`Welcome back, ${user.firstName}!`);
        return { success: true, user };
      }

      return { success: false, error: response.error };
    } catch (error) {
      toast.error(error.message || 'Login failed');
      return { success: false, error: error.message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);

      if (response.success) {
        const { token, user } = response.data;

        // Store auth data
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        // Update state
        setUser(user);
        setIsAuthenticated(true);

        toast.success('Registration successful!');
        return { success: true, user };
      }

      return { success: false, error: response.error };
    } catch (error) {
      toast.error(error.message || 'Registration failed');
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Update state
      setUser(null);
      setIsAuthenticated(false);

      toast.info('Logged out successfully');
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthContext;
