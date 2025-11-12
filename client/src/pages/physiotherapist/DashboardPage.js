import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  Divider
} from '@mui/material';
import {
  People,
  Assignment,
  TrendingUp,
  CalendarToday,
  Search,
  Visibility,
  ExpandMore,
  ExpandLess,
  Comment,
  EventNote,
  CheckCircle
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { physiotherapistAPI } from '../../api/physiotherapist';

function DashboardPage() {
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderBy, setOrderBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [expandedFeedback, setExpandedFeedback] = useState({});

  // Dialog states
  const [feedbackDialog, setFeedbackDialog] = useState(false);
  const [scheduleDialog, setScheduleDialog] = useState(false);

  // Fetch dashboard data on component mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Filter patients when search query changes
  useEffect(() => {
    filterPatients();
  }, [searchQuery, patients]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all dashboard data in parallel
      const [dashboardRes, patientsRes, analyticsRes] = await Promise.all([
        physiotherapistAPI.getDashboard(),
        physiotherapistAPI.getPatients(),
        physiotherapistAPI.getAnalytics({ days: 30 })
      ]);

      // Set dashboard overview data
      if (dashboardRes.success) {
        setDashboardData(dashboardRes.data);
        // Extract recent feedback if available
        if (dashboardRes.data.recentFeedback) {
          setRecentFeedback(dashboardRes.data.recentFeedback.slice(0, 5));
        }
      }

      // Set patients list
      if (patientsRes.success) {
        setPatients(patientsRes.data);
        setFilteredPatients(patientsRes.data);
      }

      // Set analytics data
      if (analyticsRes.success) {
        setAnalyticsData(analyticsRes.data);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Filter patients based on search query
  const filterPatients = () => {
    if (!searchQuery.trim()) {
      setFilteredPatients(patients);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = patients.filter(patient => {
      const name = patient.name?.toLowerCase() || '';
      const email = patient.email?.toLowerCase() || '';
      const status = patient.status?.toLowerCase() || '';
      return name.includes(query) || email.includes(query) || status.includes(query);
    });

    setFilteredPatients(filtered);
  };

  // Handle sorting
  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);

    const sorted = [...filteredPatients].sort((a, b) => {
      let aVal = a[property] || '';
      let bVal = b[property] || '';

      // Handle date sorting
      if (property === 'lastActivity') {
        aVal = new Date(aVal).getTime() || 0;
        bVal = new Date(bVal).getTime() || 0;
      }

      // Handle numeric sorting
      if (property === 'progress') {
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
      }

      if (aVal < bVal) return isAsc ? -1 : 1;
      if (aVal > bVal) return isAsc ? 1 : -1;
      return 0;
    });

    setFilteredPatients(sorted);
  };

  // Handle expanding/collapsing feedback
  const toggleFeedbackExpand = (index) => {
    setExpandedFeedback(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    const statusLower = status?.toLowerCase() || '';
    switch (statusLower) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'default';
      case 'completed':
        return 'info';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Get progress color
  const getProgressColor = (progress) => {
    const value = parseFloat(progress) || 0;
    if (value >= 75) return 'success';
    if (value >= 50) return 'info';
    if (value >= 25) return 'warning';
    return 'error';
  };

  // Stats card data
  const statsCards = [
    {
      title: 'Total Patients',
      value: dashboardData?.totalPatients || 0,
      icon: <People sx={{ fontSize: 40 }} />,
      color: '#1976d2',
      bgColor: '#e3f2fd'
    },
    {
      title: 'Active Cases',
      value: dashboardData?.activeCases || 0,
      icon: <Assignment sx={{ fontSize: 40 }} />,
      color: '#2e7d32',
      bgColor: '#e8f5e9'
    },
    {
      title: 'Patients Improving',
      value: dashboardData?.patientsImproving || 0,
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      color: '#ed6c02',
      bgColor: '#fff3e0'
    },
    {
      title: 'Sessions This Week',
      value: dashboardData?.sessionsThisWeek || 0,
      icon: <CalendarToday sx={{ fontSize: 40 }} />,
      color: '#9c27b0',
      bgColor: '#f3e5f5'
    }
  ];

  // Loading state
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom fontWeight="bold">
          Physiotherapist Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor patient progress and manage rehabilitation programs
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats Cards Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statsCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              elevation={2}
              sx={{
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      backgroundColor: stat.bgColor,
                      color: stat.color,
                      borderRadius: 2,
                      p: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {stat.icon}
                  </Box>
                </Box>
                <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5 }}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stat.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Left Column - Main Content */}
        <Grid item xs={12} lg={8}>
          {/* Patient List Section */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" fontWeight="bold">
                Assigned Patients
              </Typography>
              <Chip label={`${filteredPatients.length} patients`} color="primary" />
            </Box>

            {/* Search Bar */}
            <TextField
              fullWidth
              placeholder="Search patients by name, email, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />

            {/* Patients Table */}
            {filteredPatients.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <People sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  {searchQuery ? 'No patients found' : 'No assigned patients'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {searchQuery ? 'Try adjusting your search criteria' : 'Patients will appear here when assigned to you'}
                </Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <TableSortLabel
                          active={orderBy === 'name'}
                          direction={orderBy === 'name' ? order : 'asc'}
                          onClick={() => handleSort('name')}
                        >
                          Name
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={orderBy === 'status'}
                          direction={orderBy === 'status' ? order : 'asc'}
                          onClick={() => handleSort('status')}
                        >
                          Status
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={orderBy === 'lastActivity'}
                          direction={orderBy === 'lastActivity' ? order : 'asc'}
                          onClick={() => handleSort('lastActivity')}
                        >
                          Last Activity
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={orderBy === 'progress'}
                          direction={orderBy === 'progress' ? order : 'asc'}
                          onClick={() => handleSort('progress')}
                        >
                          Progress
                        </TableSortLabel>
                      </TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPatients.map((patient) => (
                      <TableRow key={patient._id || patient.id} hover>
                        <TableCell>
                          <Box>
                            <Typography variant="body1" fontWeight="medium">
                              {patient.name || 'Unknown'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {patient.email || 'No email'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={patient.status || 'Unknown'}
                            size="small"
                            color={getStatusColor(patient.status)}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(patient.lastActivity)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ minWidth: 120 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                              <Typography variant="body2" fontWeight="medium">
                                {patient.progress || 0}%
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={parseFloat(patient.progress) || 0}
                              color={getProgressColor(patient.progress)}
                              sx={{ height: 6, borderRadius: 1 }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<Visibility />}
                            onClick={() => {
                              // Navigate to patient details
                              console.log('View patient:', patient._id || patient.id);
                            }}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>

          {/* Performance Chart */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
              Patient Improvement Trends
            </Typography>

            {analyticsData.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <TrendingUp sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  No analytics data available yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Data will appear as patients complete their exercises
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => {
                      try {
                        return format(parseISO(date), 'MMM dd');
                      } catch {
                        return date;
                      }
                    }}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(date) => {
                      try {
                        return format(parseISO(date), 'MMM dd, yyyy');
                      } catch {
                        return date;
                      }
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avgProgress"
                    stroke="#2e7d32"
                    name="Average Progress (%)"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="completionRate"
                    stroke="#1976d2"
                    name="Completion Rate (%)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Right Column - Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Quick Actions Section */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<Comment />}
                fullWidth
                sx={{ py: 1.5 }}
                onClick={() => setFeedbackDialog(true)}
              >
                Add Feedback
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<EventNote />}
                fullWidth
                sx={{ py: 1.5 }}
                onClick={() => setScheduleDialog(true)}
              >
                Schedule Session
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<People />}
                fullWidth
                sx={{ py: 1.5 }}
                onClick={() => {
                  // Navigate to patients list
                  console.log('View all patients');
                }}
              >
                View All Patients
              </Button>
            </Box>
          </Paper>

          {/* Recent Feedback Section */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
              Recent Feedback
            </Typography>

            {recentFeedback.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Comment sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  No feedback given yet
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {recentFeedback.map((feedback, index) => (
                  <React.Fragment key={index}>
                    <ListItem sx={{ px: 0, py: 2, flexDirection: 'column', alignItems: 'stretch' }}>
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="body2" fontWeight="medium" sx={{ mb: 0.5 }}>
                          {feedback.patientName || 'Unknown Patient'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(feedback.timestamp || feedback.date)}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {expandedFeedback[index]
                            ? feedback.text || feedback.message || 'No feedback text'
                            : `${(feedback.text || feedback.message || 'No feedback text').substring(0, 100)}${(feedback.text || feedback.message || '').length > 100 ? '...' : ''}`
                          }
                        </Typography>

                        {(feedback.text || feedback.message || '').length > 100 && (
                          <Button
                            size="small"
                            endIcon={expandedFeedback[index] ? <ExpandLess /> : <ExpandMore />}
                            onClick={() => toggleFeedbackExpand(index)}
                            sx={{ mt: 0.5, p: 0, minWidth: 'auto' }}
                          >
                            {expandedFeedback[index] ? 'Show less' : 'Read more'}
                          </Button>
                        )}
                      </Box>
                    </ListItem>
                    {index < recentFeedback.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialog} onClose={() => setFeedbackDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Patient Feedback</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Provide feedback to help patients improve their rehabilitation progress
          </Typography>
          <TextField
            select
            fullWidth
            label="Select Patient"
            sx={{ mb: 2 }}
            SelectProps={{
              native: true,
            }}
          >
            <option value="">Choose a patient</option>
            {patients.map((patient) => (
              <option key={patient._id || patient.id} value={patient._id || patient.id}>
                {patient.name || 'Unknown'}
              </option>
            ))}
          </TextField>
          <TextField
            multiline
            rows={4}
            fullWidth
            label="Feedback Message"
            placeholder="Enter your feedback here..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFeedbackDialog(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<CheckCircle />}>
            Submit Feedback
          </Button>
        </DialogActions>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={scheduleDialog} onClose={() => setScheduleDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Schedule Session</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Schedule a rehabilitation session with a patient
          </Typography>
          <TextField
            select
            fullWidth
            label="Select Patient"
            sx={{ mb: 2 }}
            SelectProps={{
              native: true,
            }}
          >
            <option value="">Choose a patient</option>
            {patients.map((patient) => (
              <option key={patient._id || patient.id} value={patient._id || patient.id}>
                {patient.name || 'Unknown'}
              </option>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Session Date"
            type="datetime-local"
            sx={{ mb: 2 }}
            InputLabelProps={{
              shrink: true,
            }}
          />
          <TextField
            multiline
            rows={3}
            fullWidth
            label="Session Notes"
            placeholder="Enter session details..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialog(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<CalendarToday />}>
            Schedule Session
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default DashboardPage;
