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
  TablePagination,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  LocalHospital,
  Person,
  Warning,
  TrendingUp,
  Search,
  Visibility,
  Add,
  Notes,
  Assessment,
  Edit,
  CalendarToday
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import { doctorAPI } from '../../api/doctor';

function DashboardPage() {
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [patients, setPatients] = useState([]);
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [recoveryTrends, setRecoveryTrends] = useState([]);
  const [recentAnnotations, setRecentAnnotations] = useState([]);

  // Table pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  // Fetch dashboard data on component mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Filter patients based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPatients(patients);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = patients.filter(patient =>
        patient.name?.toLowerCase().includes(query) ||
        patient.condition?.toLowerCase().includes(query) ||
        patient.status?.toLowerCase().includes(query)
      );
      setFilteredPatients(filtered);
      setPage(0); // Reset to first page on search
    }
  }, [searchQuery, patients]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all dashboard data in parallel
      const [dashboardRes, analyticsRes, patientsRes] = await Promise.all([
        doctorAPI.getDashboard(),
        doctorAPI.getAnalyticsOverview(),
        doctorAPI.getAllPatients()
      ]);

      // Set dashboard data
      if (dashboardRes.success) {
        setDashboardData(dashboardRes.data);

        // Extract recent annotations if available
        if (dashboardRes.data.recentAnnotations) {
          setRecentAnnotations(dashboardRes.data.recentAnnotations.slice(0, 5));
        }
      }

      // Set analytics data
      if (analyticsRes.success) {
        setAnalyticsData(analyticsRes.data);

        // Generate recovery trends data (last 60 days)
        if (analyticsRes.data.recoveryTrends) {
          setRecoveryTrends(analyticsRes.data.recoveryTrends);
        } else {
          // Generate mock data if not available
          setRecoveryTrends(generateMockRecoveryTrends());
        }
      }

      // Set patients list
      if (patientsRes.success) {
        setPatients(patientsRes.data);
        setFilteredPatients(patientsRes.data);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Generate mock recovery trends data for demonstration
  const generateMockRecoveryTrends = () => {
    const data = [];
    const today = new Date();

    for (let i = 59; i >= 0; i--) {
      const date = subDays(today, i);
      data.push({
        date: format(date, 'yyyy-MM-dd'),
        avgRecovery: Math.min(100, 45 + (59 - i) * 0.9 + Math.random() * 5),
        criticalCases: Math.max(0, Math.floor(5 - (59 - i) * 0.05 + Math.random() * 2))
      });
    }

    return data;
  };

  // Handle table pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Handle viewing patient medical records
  const handleViewRecords = (patientId) => {
    // TODO: Navigate to patient medical records page
    console.log('View records for patient:', patientId);
  };

  // Format date for display
  const formatDate = (dateString) => {
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
      case 'critical':
        return 'error';
      case 'stable':
        return 'success';
      case 'recovering':
        return 'info';
      case 'monitoring':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Analytics cards data
  const analyticsCards = [
    {
      title: 'Total Patients Under Care',
      value: dashboardData?.totalPatients || analyticsData?.totalPatients || 0,
      icon: <Person sx={{ fontSize: 40 }} />,
      color: '#1976d2',
      bgColor: '#e3f2fd',
      subtitle: 'Active patients'
    },
    {
      title: 'Surgery Records',
      value: dashboardData?.totalSurgeries || analyticsData?.totalSurgeries || 0,
      icon: <LocalHospital sx={{ fontSize: 40 }} />,
      color: '#2e7d32',
      bgColor: '#e8f5e9',
      subtitle: 'Total procedures'
    },
    {
      title: 'Critical Cases',
      value: dashboardData?.criticalCases || analyticsData?.criticalCases || 0,
      icon: <Warning sx={{ fontSize: 40 }} />,
      color: '#d32f2f',
      bgColor: '#ffebee',
      subtitle: 'Requires attention'
    },
    {
      title: 'Avg Recovery Rate',
      value: `${Math.round(dashboardData?.avgRecoveryRate || analyticsData?.avgRecoveryRate || 0)}%`,
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      color: '#ed6c02',
      bgColor: '#fff3e0',
      subtitle: 'Overall progress'
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
        <Typography variant="h3" gutterBottom fontWeight="bold" color="primary">
          Doctor Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor patient progress, review medical records, and manage rehabilitation programs
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Analytics Cards Row */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {analyticsCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              elevation={3}
              sx={{
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6
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
                <Typography variant="h3" fontWeight="bold" sx={{ mb: 0.5 }}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary" fontWeight="medium">
                  {stat.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {stat.subtitle}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Left Column - Main Content */}
        <Grid item xs={12} lg={8}>
          {/* Patient Overview Table */}
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" fontWeight="bold">
                Patient Overview
              </Typography>
              <Chip
                label={`${filteredPatients.length} patient${filteredPatients.length !== 1 ? 's' : ''}`}
                color="primary"
                variant="outlined"
              />
            </Box>

            {/* Search Bar */}
            <TextField
              fullWidth
              placeholder="Search by patient name, condition, or status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                )
              }}
            />

            {/* Patients Table */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Patient Name</strong></TableCell>
                    <TableCell><strong>Condition</strong></TableCell>
                    <TableCell><strong>Surgery Date</strong></TableCell>
                    <TableCell align="center"><strong>Recovery %</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell align="center"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredPatients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                        <Typography variant="body1" color="text.secondary">
                          {searchQuery ? 'No patients found matching your search' : 'No patients available'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPatients
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((patient, index) => (
                        <TableRow
                          key={patient._id || index}
                          hover
                          sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                        >
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {patient.name || 'Unknown'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {patient.condition || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {patient.surgeryDate ? formatDate(patient.surgeryDate) : 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <Typography variant="body2" fontWeight="bold" color="primary">
                                {Math.round(patient.recoveryRate || 0)}%
                              </Typography>
                              <LinearProgress
                                variant="determinate"
                                value={patient.recoveryRate || 0}
                                sx={{ width: 60, mt: 0.5 }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={patient.status || 'Unknown'}
                              size="small"
                              color={getStatusColor(patient.status)}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="View Medical Records">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleViewRecords(patient._id)}
                              >
                                <Visibility />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            {filteredPatients.length > 0 && (
              <TablePagination
                component="div"
                count={filteredPatients.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25]}
              />
            )}
          </Paper>

          {/* Recovery Analytics Chart */}
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
              Recovery Analytics - Last 60 Days
            </Typography>

            {recoveryTrends.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <TrendingUp sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  No recovery data available yet
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={recoveryTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => format(parseISO(date), 'MMM dd')}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="left"
                    label={{ value: 'Recovery %', angle: -90, position: 'insideLeft' }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    label={{ value: 'Critical Cases', angle: 90, position: 'insideRight' }}
                  />
                  <RechartsTooltip
                    labelFormatter={(date) => format(parseISO(date), 'MMM dd, yyyy')}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="avgRecovery"
                    stroke="#2e7d32"
                    strokeWidth={2}
                    name="Avg Recovery Rate (%)"
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="criticalCases"
                    stroke="#d32f2f"
                    strokeWidth={2}
                    name="Critical Cases"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Right Column - Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Quick Actions Section */}
          <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={<Add />}
                fullWidth
                sx={{ py: 1.5 }}
                color="primary"
              >
                Add Surgery Record
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<Edit />}
                fullWidth
                sx={{ py: 1.5 }}
              >
                Create Annotation
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<Assessment />}
                fullWidth
                sx={{ py: 1.5 }}
              >
                View Reports
              </Button>
            </Box>
          </Paper>

          {/* Recent Annotations Section */}
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
              Recent Annotations
            </Typography>

            {recentAnnotations.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Notes sx={{ fontSize: 50, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No recent annotations
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {recentAnnotations.map((annotation, index) => (
                  <React.Fragment key={annotation._id || index}>
                    <ListItem
                      sx={{
                        px: 0,
                        py: 2,
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          borderRadius: 1
                        }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box>
                            <Typography variant="body2" fontWeight="medium" gutterBottom>
                              {annotation.patientName || 'Unknown Patient'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              {annotation.summary || annotation.notes || 'No summary available'}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CalendarToday sx={{ fontSize: 14, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary">
                                {annotation.date ? formatDate(annotation.date) : 'Recent'}
                              </Typography>
                            </Box>
                            <Button
                              size="small"
                              endIcon={<Visibility />}
                              sx={{ minWidth: 'auto' }}
                            >
                              View
                            </Button>
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < recentAnnotations.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default DashboardPage;
