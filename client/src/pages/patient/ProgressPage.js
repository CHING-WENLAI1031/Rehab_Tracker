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
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  Divider,
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/material';
import {
  Add,
  Download,
  TrendingUp,
  FitnessCenter,
  DateRange,
  CheckCircle,
  Edit,
  Delete,
  FilterList
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
import { format, parseISO, subDays, startOfDay, endOfDay } from 'date-fns';
import { patientAPI } from '../../api/patient';

function ProgressPage() {
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progressData, setProgressData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);

  // Filter states
  const [dateRange, setDateRange] = useState('30'); // days
  const [exerciseType, setExerciseType] = useState('all');
  const [exerciseTypes, setExerciseTypes] = useState([]);

  // Dialog states
  const [addProgressDialog, setAddProgressDialog] = useState(false);
  const [progressForm, setProgressForm] = useState({
    exerciseName: '',
    exerciseType: '',
    duration: '',
    intensity: '',
    notes: '',
    painLevel: '',
    completed: true
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch progress data on component mount and when filters change
  useEffect(() => {
    fetchProgressData();
  }, [dateRange, exerciseType]);

  const fetchProgressData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {
        startDate: startOfDay(subDays(new Date(), parseInt(dateRange))).toISOString(),
        endDate: endOfDay(new Date()).toISOString()
      };

      if (exerciseType !== 'all') {
        params.exerciseType = exerciseType;
      }

      const response = await patientAPI.getProgress(params);

      if (response.success) {
        const progress = response.data || [];
        setProgressData(progress);
        setFilteredData(progress);

        // Extract unique exercise types for filter
        const types = [...new Set(progress.map(p => p.exerciseType).filter(Boolean))];
        setExerciseTypes(types);

        // Prepare chart data - group by date
        const chartMap = {};
        progress.forEach(entry => {
          const date = format(parseISO(entry.date || entry.createdAt), 'MMM dd');
          if (!chartMap[date]) {
            chartMap[date] = { date, count: 0, totalDuration: 0, avgIntensity: 0, entries: 0 };
          }
          chartMap[date].count += 1;
          chartMap[date].totalDuration += entry.duration || 0;
          if (entry.intensity) {
            chartMap[date].avgIntensity += parseInt(entry.intensity);
            chartMap[date].entries += 1;
          }
        });

        const chart = Object.values(chartMap).map(item => ({
          date: item.date,
          count: item.count,
          duration: item.totalDuration,
          intensity: item.entries > 0 ? Math.round(item.avgIntensity / item.entries) : 0
        }));

        setChartData(chart);
      }
    } catch (err) {
      console.error('Error fetching progress data:', err);
      setError(err.message || 'Failed to load progress data');
    } finally {
      setLoading(false);
    }
  };

  // Handle opening add progress dialog
  const handleOpenAddDialog = () => {
    setProgressForm({
      exerciseName: '',
      exerciseType: '',
      duration: '',
      intensity: '',
      notes: '',
      painLevel: '',
      completed: true
    });
    setAddProgressDialog(true);
  };

  // Handle closing add progress dialog
  const handleCloseAddDialog = () => {
    setAddProgressDialog(false);
  };

  // Handle form input changes
  const handleFormChange = (field) => (event) => {
    setProgressForm({ ...progressForm, [field]: event.target.value });
  };

  // Handle submitting new progress
  const handleSubmitProgress = async () => {
    if (!progressForm.exerciseName.trim()) {
      setError('Exercise name is required');
      return;
    }

    setSubmitting(true);
    try {
      await patientAPI.recordProgress({
        ...progressForm,
        date: new Date().toISOString(),
        duration: parseInt(progressForm.duration) || 0,
        intensity: progressForm.intensity ? parseInt(progressForm.intensity) : undefined,
        painLevel: progressForm.painLevel ? parseInt(progressForm.painLevel) : undefined
      });

      handleCloseAddDialog();
      fetchProgressData();
    } catch (err) {
      console.error('Error recording progress:', err);
      setError('Failed to record progress');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle export progress report
  const handleExportReport = () => {
    try {
      const reportData = filteredData.map(entry => ({
        Date: format(parseISO(entry.date || entry.createdAt), 'yyyy-MM-dd HH:mm'),
        Exercise: entry.exerciseName || 'N/A',
        Type: entry.exerciseType || 'N/A',
        Duration: `${entry.duration || 0} min`,
        Intensity: entry.intensity || 'N/A',
        PainLevel: entry.painLevel || 'N/A',
        Notes: entry.notes || '',
        Status: entry.completed ? 'Completed' : 'Partial'
      }));

      const csv = [
        Object.keys(reportData[0]).join(','),
        ...reportData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `progress-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting report:', err);
      setError('Failed to export report');
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  // Loading state
  if (loading && progressData.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h3" gutterBottom fontWeight="bold">
            My Progress
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track your rehabilitation journey and improvements
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={handleExportReport}
            disabled={filteredData.length === 0}
          >
            Export Report
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleOpenAddDialog}
          >
            Log Progress
          </Button>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <FilterList />
          <Typography variant="h6" fontWeight="bold">
            Filters
          </Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth>
              <InputLabel>Date Range</InputLabel>
              <Select
                value={dateRange}
                label="Date Range"
                onChange={(e) => setDateRange(e.target.value)}
              >
                <MenuItem value="7">Last 7 days</MenuItem>
                <MenuItem value="14">Last 14 days</MenuItem>
                <MenuItem value="30">Last 30 days</MenuItem>
                <MenuItem value="60">Last 60 days</MenuItem>
                <MenuItem value="90">Last 90 days</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth>
              <InputLabel>Exercise Type</InputLabel>
              <Select
                value={exerciseType}
                label="Exercise Type"
                onChange={(e) => setExerciseType(e.target.value)}
              >
                <MenuItem value="all">All Types</MenuItem>
                {exerciseTypes.map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Progress Chart */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
          Progress Overview
        </Typography>
        {chartData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <TrendingUp sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No progress data available
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start logging your exercises to see your progress
            </Typography>
          </Box>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <RechartsTooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="count"
                stroke="#1976d2"
                strokeWidth={2}
                name="Sessions"
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="duration"
                stroke="#2e7d32"
                strokeWidth={2}
                name="Duration (min)"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="intensity"
                stroke="#ed6c02"
                strokeWidth={2}
                name="Avg Intensity"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Paper>

      {/* Progress Timeline */}
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
          Progress Timeline
        </Typography>

        {filteredData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <FitnessCenter sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No progress entries yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Click "Log Progress" to record your first entry
            </Typography>
          </Box>
        ) : (
          <Timeline position="alternate">
            {filteredData.map((entry, index) => (
              <TimelineItem key={entry._id || index}>
                <TimelineOppositeContent color="text.secondary">
                  {formatDate(entry.date || entry.createdAt)}
                </TimelineOppositeContent>
                <TimelineSeparator>
                  <TimelineDot color={entry.completed ? 'success' : 'warning'}>
                    {entry.completed ? <CheckCircle /> : <FitnessCenter />}
                  </TimelineDot>
                  {index < filteredData.length - 1 && <TimelineConnector />}
                </TimelineSeparator>
                <TimelineContent>
                  <Card elevation={3}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Typography variant="h6" fontWeight="bold">
                          {entry.exerciseName || 'Exercise'}
                        </Typography>
                        {entry.exerciseType && (
                          <Chip label={entry.exerciseType} size="small" color="primary" />
                        )}
                      </Box>

                      <Grid container spacing={2} sx={{ mt: 1 }}>
                        {entry.duration && (
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              Duration
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {entry.duration} minutes
                            </Typography>
                          </Grid>
                        )}
                        {entry.intensity && (
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              Intensity
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {entry.intensity}/10
                            </Typography>
                          </Grid>
                        )}
                        {entry.painLevel !== undefined && entry.painLevel !== null && (
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary">
                              Pain Level
                            </Typography>
                            <Typography variant="body2" fontWeight="medium">
                              {entry.painLevel}/10
                            </Typography>
                          </Grid>
                        )}
                      </Grid>

                      {entry.notes && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="caption" color="text.secondary">
                            Notes
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {entry.notes}
                          </Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </Paper>

      {/* Add Progress Dialog */}
      <Dialog open={addProgressDialog} onClose={handleCloseAddDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Log Progress</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              required
              label="Exercise Name"
              value={progressForm.exerciseName}
              onChange={handleFormChange('exerciseName')}
              placeholder="e.g., Shoulder Rotation"
            />

            <TextField
              fullWidth
              label="Exercise Type"
              value={progressForm.exerciseType}
              onChange={handleFormChange('exerciseType')}
              placeholder="e.g., Stretching, Strength, Cardio"
            />

            <TextField
              fullWidth
              type="number"
              label="Duration (minutes)"
              value={progressForm.duration}
              onChange={handleFormChange('duration')}
              inputProps={{ min: 0 }}
            />

            <TextField
              fullWidth
              select
              label="Intensity Level"
              value={progressForm.intensity}
              onChange={handleFormChange('intensity')}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                <MenuItem key={level} value={level}>{level}</MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              select
              label="Pain Level"
              value={progressForm.painLevel}
              onChange={handleFormChange('painLevel')}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(level => (
                <MenuItem key={level} value={level}>{level}</MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes"
              value={progressForm.notes}
              onChange={handleFormChange('notes')}
              placeholder="How did you feel? Any observations?"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog}>Cancel</Button>
          <Button
            onClick={handleSubmitProgress}
            variant="contained"
            disabled={!progressForm.exerciseName.trim() || submitting}
          >
            {submitting ? 'Saving...' : 'Save Progress'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default ProgressPage;
