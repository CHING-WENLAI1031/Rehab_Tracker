const mongoose = require('mongoose');

/**
 * RehabTask Schema for Rehabilitation Exercises and Schedules
 * Created by physiotherapists and assigned to patients
 */
const rehabTaskSchema = new mongoose.Schema({
  // Basic Task Information
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Task description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  category: {
    type: String,
    required: [true, 'Task category is required'],
    enum: {
      values: [
        'strength_training',
        'flexibility',
        'balance',
        'cardio',
        'range_of_motion',
        'pain_management',
        'posture',
        'functional_movement',
        'other'
      ],
      message: 'Invalid task category'
    }
  },

  // Task Specifications
  instructions: [{
    step: {
      type: Number,
      required: true
    },
    instruction: {
      type: String,
      required: true,
      trim: true,
      maxlength: [500, 'Instruction cannot exceed 500 characters']
    },
    duration: String, // e.g., "Hold for 10 seconds"
    repetitions: String, // e.g., "Repeat 15 times"
    imageUrl: String, // Optional demonstration image
    videoUrl: String  // Optional demonstration video
  }],

  // Exercise Parameters
  parameters: {
    duration: {
      value: Number, // Duration in minutes
      unit: {
        type: String,
        enum: ['minutes', 'seconds', 'hours'],
        default: 'minutes'
      }
    },
    repetitions: {
      sets: Number,
      reps: Number
    },
    intensity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    equipment: [String], // Array of required equipment
    precautions: [String] // Important safety notes
  },

  // Assignment Information
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Assigned by physiotherapist is required']
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Assigned to patient is required']
  },

  // Scheduling Information
  schedule: {
    startDate: {
      type: Date,
      required: [true, 'Start date is required']
    },
    endDate: {
      type: Date,
      validate: {
        validator: function(v) {
          return !v || v > this.schedule.startDate;
        },
        message: 'End date must be after start date'
      }
    },
    frequency: {
      type: String,
      required: [true, 'Frequency is required'],
      enum: {
        values: ['daily', 'every_other_day', 'weekly', 'bi_weekly', 'custom'],
        message: 'Invalid frequency'
      }
    },
    customSchedule: {
      // For custom frequency
      daysOfWeek: [{
        type: Number,
        min: 0, // Sunday
        max: 6  // Saturday
      }],
      timesPerDay: {
        type: Number,
        min: 1,
        default: 1
      },
      specificTimes: [String] // e.g., ["09:00", "15:00", "21:00"]
    },
    totalSessions: Number, // Total number of sessions planned
    completedSessions: {
      type: Number,
      default: 0
    }
  },

  // Status and Progress
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed', 'cancelled'],
    default: 'draft'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  // Goals and Targets
  goals: [{
    description: String,
    targetValue: Number,
    targetUnit: String,
    currentValue: {
      type: Number,
      default: 0
    },
    achieved: {
      type: Boolean,
      default: false
    }
  }],

  // Progress Tracking
  progressMetrics: {
    painLevel: {
      baseline: Number, // 1-10 scale
      target: Number,
      current: Number
    },
    functionality: {
      baseline: Number, // 1-10 scale
      target: Number,
      current: Number
    },
    adherence: {
      targetPercentage: {
        type: Number,
        default: 80
      },
      currentPercentage: {
        type: Number,
        default: 0
      }
    }
  },

  // Notes and Communication
  notes: {
    therapistNotes: String,
    patientNotes: String,
    modificationHistory: [{
      date: {
        type: Date,
        default: Date.now
      },
      modifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      changes: String,
      reason: String
    }]
  },

  // Attachments and Resources
  resources: [{
    title: String,
    type: {
      type: String,
      enum: ['pdf', 'video', 'image', 'link', 'audio'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    description: String
  }],

  // Reminders and Notifications
  reminders: {
    enabled: {
      type: Boolean,
      default: true
    },
    beforeSession: {
      type: Number,
      default: 30 // minutes before
    },
    missedSession: {
      type: Number,
      default: 60 // minutes after missed session
    },
    methods: [{
      type: String,
      enum: ['email', 'sms', 'push', 'in_app']
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for completion percentage
rehabTaskSchema.virtual('completionPercentage').get(function() {
  if (!this.schedule.totalSessions || this.schedule.totalSessions === 0) {
    return 0;
  }
  return Math.round((this.schedule.completedSessions / this.schedule.totalSessions) * 100);
});

// Virtual for days remaining
rehabTaskSchema.virtual('daysRemaining').get(function() {
  if (!this.schedule.endDate) return null;
  const today = new Date();
  const endDate = new Date(this.schedule.endDate);
  const timeDiff = endDate.getTime() - today.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  return daysDiff > 0 ? daysDiff : 0;
});

// Virtual for overdue status
rehabTaskSchema.virtual('isOverdue').get(function() {
  if (!this.schedule.endDate || this.status === 'completed') return false;
  return new Date() > new Date(this.schedule.endDate);
});

// Pre-save middleware
rehabTaskSchema.pre('save', function(next) {
  // Auto-update status based on dates and completion
  if (this.status === 'active') {
    const today = new Date();

    // Check if task should be completed
    if (this.schedule.totalSessions &&
        this.schedule.completedSessions >= this.schedule.totalSessions) {
      this.status = 'completed';
    }

    // Check if task is overdue
    if (this.schedule.endDate && today > this.schedule.endDate) {
      if (this.status === 'active') {
        // Keep as active but flag as overdue
        this.isOverdue = true;
      }
    }
  }

  next();
});

// Instance method to mark session as completed
rehabTaskSchema.methods.markSessionCompleted = function() {
  this.schedule.completedSessions += 1;

  // Update adherence percentage
  if (this.schedule.totalSessions) {
    this.progressMetrics.adherence.currentPercentage =
      Math.round((this.schedule.completedSessions / this.schedule.totalSessions) * 100);
  }

  return this.save();
};

// Static method to find active tasks for a patient
rehabTaskSchema.statics.findActiveTasksForPatient = function(patientId) {
  return this.find({
    assignedTo: patientId,
    status: 'active',
    'schedule.startDate': { $lte: new Date() }
  })
  .populate('assignedBy', 'firstName lastName role')
  .sort({ priority: -1, 'schedule.startDate': 1 });
};

// Static method to find tasks by therapist
rehabTaskSchema.statics.findTasksByTherapist = function(therapistId) {
  return this.find({ assignedBy: therapistId })
    .populate('assignedTo', 'firstName lastName email')
    .sort({ 'schedule.startDate': -1 });
};

// Indexes for performance
rehabTaskSchema.index({ assignedTo: 1, status: 1 });
rehabTaskSchema.index({ assignedBy: 1 });
rehabTaskSchema.index({ 'schedule.startDate': 1 });
rehabTaskSchema.index({ 'schedule.endDate': 1 });
rehabTaskSchema.index({ status: 1 });

module.exports = mongoose.model('RehabTask', rehabTaskSchema);