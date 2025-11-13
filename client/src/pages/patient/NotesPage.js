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
  InputAdornment,
  IconButton,
  Divider
} from '@mui/material';
import {
  Add,
  Search,
  Notes,
  DateRange,
  Edit,
  Delete,
  Clear
} from '@mui/icons-material';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { patientAPI } from '../../api/patient';

function NotesPage() {
  // State management
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState([]);
  const [filteredNotes, setFilteredNotes] = useState([]);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dialog states
  const [addNoteDialog, setAddNoteDialog] = useState(false);
  const [noteForm, setNoteForm] = useState({
    content: '',
    taskId: '',
    tags: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch notes on component mount
  useEffect(() => {
    fetchNotes();
  }, []);

  // Filter notes when search query or date range changes
  useEffect(() => {
    filterNotes();
  }, [notes, searchQuery, startDate, endDate]);

  const fetchNotes = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = {};

      if (startDate) {
        params.startDate = startOfDay(new Date(startDate)).toISOString();
      }

      if (endDate) {
        params.endDate = endOfDay(new Date(endDate)).toISOString();
      }

      const response = await patientAPI.getNotes(params);

      if (response.success) {
        const notesData = response.data || [];
        // Sort by date, newest first
        notesData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setNotes(notesData);
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError(err.message || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const filterNotes = () => {
    let filtered = [...notes];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(note =>
        (note.content && note.content.toLowerCase().includes(query)) ||
        (note.tags && note.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    setFilteredNotes(filtered);
  };

  // Handle opening add note dialog
  const handleOpenAddDialog = () => {
    setNoteForm({
      content: '',
      taskId: '',
      tags: ''
    });
    setAddNoteDialog(true);
  };

  // Handle closing add note dialog
  const handleCloseAddDialog = () => {
    setAddNoteDialog(false);
  };

  // Handle form input changes
  const handleFormChange = (field) => (event) => {
    setNoteForm({ ...noteForm, [field]: event.target.value });
  };

  // Handle submitting new note
  const handleSubmitNote = async () => {
    if (!noteForm.content.trim()) {
      setError('Note content is required');
      return;
    }

    setSubmitting(true);
    try {
      const noteData = {
        content: noteForm.content,
        taskId: noteForm.taskId || undefined,
        tags: noteForm.tags ? noteForm.tags.split(',').map(tag => tag.trim()).filter(Boolean) : []
      };

      await patientAPI.createNote(noteData);

      handleCloseAddDialog();
      fetchNotes();
    } catch (err) {
      console.error('Error creating note:', err);
      setError('Failed to create note');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle clearing date filters
  const handleClearDateFilters = () => {
    setStartDate('');
    setEndDate('');
    fetchNotes();
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
  if (loading && notes.length === 0) {
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
            My Notes
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Keep track of your rehabilitation notes and observations
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleOpenAddDialog}
        >
          Add Note
        </Button>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Search and Filters */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search notes by content or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <Clear />
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              type="date"
              label="Start Date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              type="date"
              label="End Date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="outlined"
              onClick={handleClearDateFilters}
              disabled={!startDate && !endDate}
            >
              Clear Filters
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Notes Count */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {filteredNotes.length === notes.length
            ? `Showing all ${notes.length} note${notes.length !== 1 ? 's' : ''}`
            : `Showing ${filteredNotes.length} of ${notes.length} note${notes.length !== 1 ? 's' : ''}`}
        </Typography>
      </Box>

      {/* Notes List */}
      {filteredNotes.length === 0 ? (
        <Paper elevation={2} sx={{ p: 6, textAlign: 'center' }}>
          <Notes sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {notes.length === 0 ? 'No notes yet' : 'No notes found'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {notes.length === 0
              ? 'Start adding notes to keep track of your rehabilitation journey'
              : 'Try adjusting your search or filters'}
          </Typography>
          {notes.length === 0 && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleOpenAddDialog}
              sx={{ mt: 3 }}
            >
              Add Your First Note
            </Button>
          )}
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {filteredNotes.map((note) => (
            <Grid item xs={12} key={note._id}>
              <Card elevation={3} sx={{ transition: 'all 0.2s', '&:hover': { boxShadow: 6 } }}>
                <CardContent>
                  {/* Note Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <DateRange sx={{ fontSize: 18, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(note.createdAt)}
                        </Typography>
                      </Box>
                      {note.task && (
                        <Chip
                          label={`Task: ${note.task.title || note.task.exerciseName || 'Untitled'}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ mb: 1 }}
                        />
                      )}
                    </Box>
                  </Box>

                  {/* Note Content */}
                  <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                    {note.content}
                  </Typography>

                  {/* Tags */}
                  {note.tags && note.tags.length > 0 && (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                      {note.tags.map((tag, index) => (
                        <Chip
                          key={index}
                          label={tag}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  )}

                  {/* Author Info (if available) */}
                  {note.patient && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="caption" color="text.secondary">
                        Created by: {note.patient.name || 'You'}
                      </Typography>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add Note Dialog */}
      <Dialog open={addNoteDialog} onClose={handleCloseAddDialog} maxWidth="md" fullWidth>
        <DialogTitle>Add New Note</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              required
              multiline
              rows={6}
              label="Note Content"
              value={noteForm.content}
              onChange={handleFormChange('content')}
              placeholder="Write your note here..."
              helperText="Record your observations, feelings, or any important information"
            />

            <TextField
              fullWidth
              label="Task ID (Optional)"
              value={noteForm.taskId}
              onChange={handleFormChange('taskId')}
              placeholder="Associate this note with a task"
              helperText="Enter the task ID if this note is related to a specific task"
            />

            <TextField
              fullWidth
              label="Tags (Optional)"
              value={noteForm.tags}
              onChange={handleFormChange('tags')}
              placeholder="pain, improvement, difficulty, etc."
              helperText="Comma-separated tags to help organize your notes"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddDialog}>Cancel</Button>
          <Button
            onClick={handleSubmitNote}
            variant="contained"
            disabled={!noteForm.content.trim() || submitting}
          >
            {submitting ? 'Saving...' : 'Save Note'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default NotesPage;
