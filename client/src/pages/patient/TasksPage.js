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
  Chip,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip
} from '@mui/material';
import {
  Assignment,
  CheckCircle,
  Schedule,
  CalendarToday,
  ViewList,
  EditNote,
  CheckCircleOutline,
  PendingActions
} from '@mui/icons-material';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { patientAPI } from '../../api/patient';

function TasksPage() {
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);

  // Filter and view states
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, completed, upcoming
  const [viewMode, setViewMode] = useState('list'); // list or calendar

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState([]);

  // Dialog states
  const [notesDialog, setNotesDialog] = useState({ open: false, taskId: null, taskTitle: '' });
  const [noteText, setNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Fetch tasks on component mount and when filter changes
  useEffect(() => {
    fetchTasks();
  }, [statusFilter]);

  // Update filtered tasks when tasks change
  useEffect(() => {
    filterTasks();
  }, [tasks, statusFilter]);

  // Generate calendar days when month changes
  useEffect(() => {
    if (viewMode === 'calendar') {
      generateCalendarDays();
    }
  }, [currentMonth, tasks, viewMode]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response = await patientAPI.getTasks(params);

      if (response.success) {
        setTasks(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = () => {
    let filtered = [...tasks];

    if (statusFilter === 'active') {
      filtered = filtered.filter(task => task.status !== 'completed');
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter(task => task.status === 'completed');
    } else if (statusFilter === 'upcoming') {
      filtered = filtered.filter(task => {
        if (!task.dueDate) return false;
        const dueDate = parseISO(task.dueDate);
        return dueDate > new Date() && task.status !== 'completed';
      });
    }

    setFilteredTasks(filtered);
  };

  const generateCalendarDays = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });
    setCalendarDays(days);
  };

  // Handle marking task as complete
  const handleMarkComplete = async (taskId) => {
    try {
      await patientAPI.recordProgress({
        taskId,
        completed: true,
        date: new Date().toISOString()
      });

      // Update task status locally
      setTasks(tasks.map(task =>
        task._id === taskId ? { ...task, status: 'completed' } : task
      ));
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
      fetchTasks();
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

  // Get task status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_progress':
        return 'primary';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  // Calculate task progress percentage
  const calculateProgress = (task) => {
    if (task.status === 'completed') return 100;
    if (task.completedSessions && task.totalSessions) {
      return Math.round((task.completedSessions / task.totalSessions) * 100);
    }
    return task.status === 'in_progress' ? 50 : 0;
  };

  // Get tasks for a specific day (for calendar view)
  const getTasksForDay = (day) => {
    return filteredTasks.filter(task => {
      if (!task.dueDate) return false;
      return isSameDay(parseISO(task.dueDate), day);
    });
  };

  // Stats for header
  const stats = {
    total: tasks.length,
    active: tasks.filter(t => t.status !== 'completed').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    upcoming: tasks.filter(t => {
      if (!t.dueDate) return false;
      return parseISO(t.dueDate) > new Date() && t.status !== 'completed';
    }).length
  };

  // Loading state
  if (loading && tasks.length === 0) {
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
          My Tasks
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your rehabilitation tasks and track completion
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats Overview */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
            <Assignment sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" fontWeight="bold">
              {stats.total}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Total Tasks
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
            <PendingActions sx={{ fontSize: 32, color: 'warning.main', mb: 1 }} />
            <Typography variant="h5" fontWeight="bold">
              {stats.active}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Active
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
            <CheckCircle sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
            <Typography variant="h5" fontWeight="bold">
              {stats.completed}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Completed
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={2} sx={{ p: 2, textAlign: 'center' }}>
            <Schedule sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
            <Typography variant="h5" fontWeight="bold">
              {stats.upcoming}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upcoming
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters and View Toggle */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Status Filter</InputLabel>
            <Select
              value={statusFilter}
              label="Status Filter"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All Tasks</MenuItem>
              <MenuItem value="active">Active Only</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="upcoming">Upcoming</MenuItem>
            </Select>
          </FormControl>

          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(e, newMode) => newMode && setViewMode(newMode)}
            aria-label="view mode"
          >
            <ToggleButton value="list" aria-label="list view">
              <ViewList sx={{ mr: 1 }} />
              List
            </ToggleButton>
            <ToggleButton value="calendar" aria-label="calendar view">
              <CalendarToday sx={{ mr: 1 }} />
              Calendar
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* List View */}
      {viewMode === 'list' && (
        <Paper elevation={2} sx={{ p: 3 }}>
          {filteredTasks.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CheckCircleOutline sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No tasks found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {statusFilter === 'all'
                  ? 'You have no tasks assigned yet'
                  : `No ${statusFilter} tasks available`}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {filteredTasks.map((task) => (
                <Grid item xs={12} key={task._id}>
                  <Card elevation={3} sx={{ transition: 'all 0.2s', '&:hover': { boxShadow: 6 } }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" fontWeight="bold">
                            {task.title || task.exerciseName || 'Untitled Task'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {task.description || task.notes || 'No description available'}
                          </Typography>
                        </Box>
                        <Chip
                          label={task.status || 'pending'}
                          size="small"
                          color={getStatusColor(task.status)}
                          sx={{ ml: 2 }}
                        />
                      </Box>

                      {/* Progress Bar */}
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Progress
                          </Typography>
                          <Typography variant="caption" fontWeight="bold">
                            {calculateProgress(task)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={calculateProgress(task)}
                          sx={{ height: 8, borderRadius: 1 }}
                        />
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              Due: {task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                            </Typography>
                          </Box>
                          {task.assignedBy && (
                            <Chip
                              label={`Assigned by: ${task.assignedBy.name || 'Provider'}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1 }}>
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
                            {task.status === 'completed' ? 'Completed' : 'Mark Complete'}
                          </Button>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" fontWeight="bold">
              {format(currentMonth, 'MMMM yyyy')}
            </Typography>
            <Box>
              <Button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              >
                Previous
              </Button>
              <Button
                onClick={() => setCurrentMonth(new Date())}
                sx={{ mx: 1 }}
              >
                Today
              </Button>
              <Button
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              >
                Next
              </Button>
            </Box>
          </Box>

          <Grid container spacing={1}>
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <Grid item xs={12 / 7} key={day}>
                <Typography variant="caption" fontWeight="bold" align="center" display="block">
                  {day}
                </Typography>
              </Grid>
            ))}

            {/* Calendar days */}
            {calendarDays.map((day, index) => {
              const dayTasks = getTasksForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <Grid item xs={12 / 7} key={index}>
                  <Box
                    sx={{
                      border: 1,
                      borderColor: isToday ? 'primary.main' : 'divider',
                      borderWidth: isToday ? 2 : 1,
                      borderRadius: 1,
                      minHeight: 80,
                      p: 1,
                      bgcolor: isToday ? 'primary.light' : 'background.paper',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <Typography variant="caption" fontWeight={isToday ? 'bold' : 'normal'}>
                      {format(day, 'd')}
                    </Typography>
                    {dayTasks.map((task, idx) => (
                      <Tooltip key={idx} title={task.title || task.exerciseName}>
                        <Box
                          sx={{
                            mt: 0.5,
                            p: 0.5,
                            bgcolor: getStatusColor(task.status) + '.light',
                            borderRadius: 0.5,
                            cursor: 'pointer'
                          }}
                        >
                          <Typography variant="caption" noWrap>
                            {task.title || task.exerciseName}
                          </Typography>
                        </Box>
                      </Tooltip>
                    ))}
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Paper>
      )}

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

export default TasksPage;
