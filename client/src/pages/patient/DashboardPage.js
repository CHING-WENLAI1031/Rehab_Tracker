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
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Assignment,
  CheckCircle,
  Timeline,
  LocalFireDepartment,
  Add,
  Notes,
  CalendarToday,
  CheckCircleOutline,
  EditNote
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { patientAPI } from '../../api/patient';

function DashboardPage() {
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [activeTasks, setActiveTasks] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const [recentActivities, setRecentActivities] = useState([]);

  // Dialog states
  const [notesDialog, setNotesDialog] = useState({ open: false, taskId: null, taskTitle: '' });
  const [noteText, setNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Fetch dashboard data on component mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all dashboard data in parallel
      const [dashboardRes, tasksRes, statsRes, progressRes] = await Promise.all([
        patientAPI.getDashboard(),
        patientAPI.getActiveTasks(),
        patientAPI.getWeeklyStats(),
        patientAPI.getOverallProgress()
      ]);

      // Set dashboard overview data
      if (dashboardRes.success) {
        setDashboardData(dashboardRes.data);
        // Extract recent activities if available
        if (dashboardRes.data.recentActivities) {
          setRecentActivities(dashboardRes.data.recentActivities.slice(0, 5));
        }
      }

      // Set active tasks
      if (tasksRes.success) {
        setActiveTasks(tasksRes.data);
      }

      // Set weekly statistics
      if (statsRes.success) {
        setWeeklyStats(statsRes.data);
      }

      // Set overall progress
      if (progressRes.success) {
        setOverallProgress(progressRes.data.percentage || 0);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Handle marking task as complete
  const handleMarkComplete = async (taskId) => {
    try {
      await patientAPI.recordProgress({
        taskId,
        completed: true,
        date: new Date().toISOString()
      });

      // Refresh dashboard data
      fetchDashboardData();
    } catch (err) {
      console.error('Error marking task complete:', err);
      setError('Failed to mark task as complete');
    }
  };

  // Handle opening notes dialog
  const handleOpenNotesDialog = (taskId, taskTitle) => {
    setNotesDialog({ open: true, taskId, taskTitle });
    setNoteText('');
  };

  // Handle closing notes dialog
  const handleCloseNotesDialog = () => {
    setNotesDialog({ open: false, taskId: null, taskTitle: '' });
    setNoteText('');
  };

  // Handle submitting notes
  const handleSubmitNotes = async () => {
    if (!noteText.trim()) return;

    setSubmittingNote(true);
    try {
      await patientAPI.addTaskNotes(notesDialog.taskId, noteText);
      handleCloseNotesDialog();
      // Optionally refresh dashboard to show updated activity
      fetchDashboardData();
    } catch (err) {
      console.error('Error adding notes:', err);
      setError('Failed to add notes');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  // Stats card data
  const statsCards = [
    {
      title: 'Total Tasks',
      value: dashboardData?.totalTasks || 0,
      icon: <Assignment sx={{ fontSize: 40 }} />,
      color: '#1976d2',
      bgColor: '#e3f2fd'
    },
    {
      title: 'Completed Today',
      value: dashboardData?.completedToday || 0,
      icon: <CheckCircle sx={{ fontSize: 40 }} />,
      color: '#2e7d32',
      bgColor: '#e8f5e9'
    },
    {
      title: 'Overall Progress',
      value: `${Math.round(overallProgress)}%`,
      icon: <Timeline sx={{ fontSize: 40 }} />,
      color: '#ed6c02',
      bgColor: '#fff3e0'
    },
    {
      title: 'Active Streak',
      value: `${dashboardData?.activeStreak || 0} days`,
      icon: <LocalFireDepartment sx={{ fontSize: 40 }} />,
      color: '#d32f2f',
      bgColor: '#ffebee'
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
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom fontWeight="bold">
          Patient Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track your rehabilitation progress and stay on top of your tasks
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
        {/* Left Column */}
        <Grid item xs={12} md={8}>
          {/* Active Tasks Section */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5" fontWeight="bold">
                Active Tasks
              </Typography>
              <Chip label={`${activeTasks.length} tasks`} color="primary" />
            </Box>

            {activeTasks.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CheckCircleOutline sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No active tasks
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  All caught up! Check back later for new tasks.
                </Typography>
              </Box>
            ) : (
              <List>
                {activeTasks.map((task, index) => (
                  <React.Fragment key={task._id || index}>
                    <ListItem
                      sx={{
                        flexDirection: 'column',
                        alignItems: 'stretch',
                        p: 2,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        mb: 2
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" fontWeight="medium">
                            {task.title || task.exerciseName || 'Untitled Task'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {task.description || task.notes || 'No description available'}
                          </Typography>
                        </Box>
                        <Chip
                          label={task.status || 'pending'}
                          size="small"
                          color={task.status === 'completed' ? 'success' : 'warning'}
                          sx={{ ml: 2 }}
                        />
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="caption" color="text.secondary">
                            Due: {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                          </Typography>
                        </Box>

                        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<EditNote />}
                            onClick={() => handleOpenNotesDialog(task._id, task.title || task.exerciseName)}
                          >
                            Add Notes
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<CheckCircle />}
                            onClick={() => handleMarkComplete(task._id)}
                            disabled={task.status === 'completed'}
                          >
                            Mark Complete
                          </Button>
                        </Box>
                      </Box>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>

          {/* Weekly Progress Chart */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
              Weekly Progress
            </Typography>

            {weeklyStats.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Timeline sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  No weekly data available yet
                </Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={weeklyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(date) => format(parseISO(date), 'EEE')}
                  />
                  <YAxis />
                  <Tooltip
                    labelFormatter={(date) => format(parseISO(date), 'MMM dd, yyyy')}
                  />
                  <Legend />
                  <Bar dataKey="completed" fill="#2e7d32" name="Completed Tasks" />
                  <Bar dataKey="total" fill="#1976d2" name="Total Tasks" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={4}>
          {/* Quick Actions Section */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
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
              >
                Log Progress
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<Notes />}
                fullWidth
                sx={{ py: 1.5 }}
              >
                Add Note
              </Button>
              <Button
                variant="outlined"
                size="large"
                startIcon={<CalendarToday />}
                fullWidth
                sx={{ py: 1.5 }}
              >
                View Full Schedule
              </Button>
            </Box>
          </Paper>

          {/* Recent Activity Feed */}
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
              Recent Activity
            </Typography>

            {recentActivities.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  No recent activity
                </Typography>
              </Box>
            ) : (
              <List sx={{ p: 0 }}>
                {recentActivities.map((activity, index) => (
                  <React.Fragment key={index}>
                    <ListItem sx={{ px: 0, py: 1.5 }}>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight="medium">
                            {activity.description || activity.title || 'Activity'}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {activity.timestamp ? formatDate(activity.timestamp) : 'Recent'}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < recentActivities.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Notes Dialog */}
      <Dialog open={notesDialog.open} onClose={handleCloseNotesDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add Notes to Task</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Task: {notesDialog.taskTitle}
          </Typography>
          <TextField
            autoFocus
            multiline
            rows={4}
            fullWidth
            label="Notes"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Enter your notes here..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseNotesDialog}>Cancel</Button>
          <Button
            onClick={handleSubmitNotes}
            variant="contained"
            disabled={!noteText.trim() || submittingNote}
          >
            {submittingNote ? 'Saving...' : 'Save Notes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default DashboardPage;
