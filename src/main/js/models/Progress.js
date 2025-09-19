const mongoose = require('mongoose');

/**
 * Progress Schema for tracking patient exercise completions and outcomes
 * Each document represents a single exercise session completion
 */
const progressSchema = new mongoose.Schema({
  // Reference Information
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Patient reference is required']
  },
  rehabTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RehabTask',
    required: [true, 'Rehab task reference is required']
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recorder reference is required']
  },

  // Session Information
  sessionDate: {
    type: Date,
    required: [true, 'Session date is required'],
    default: Date.now
  },
  sessionDuration: {
    planned: {
      type: Number, // in minutes
      required: true
    },
    actual: {
      type: Number, // in minutes
      required: [true, 'Actual duration is required']
    }
  },

  // Completion Status
  completionStatus: {
    type: String,
    required: [true, 'Completion status is required'],
    enum: {
      values: ['completed', 'partially_completed', 'skipped', 'unable_to_complete'],
      message: 'Invalid completion status'
    }
  },
  completionPercentage: {
    type: Number,
    min: [0, 'Completion percentage cannot be negative'],
    max: [100, 'Completion percentage cannot exceed 100'],
    default: function() {
      switch(this.completionStatus) {
        case 'completed': return 100;
        case 'skipped': return 0;
        case 'unable_to_complete': return 0;
        default: return 50; // partially_completed
      }
    }
  },

  // Exercise Performance Data
  performance: {
    // Repetitions and Sets
    sets: [{
      setNumber: {
        type: Number,
        required: true
      },
      repetitionsPlanned: Number,
      repetitionsCompleted: {
        type: Number,
        required: true
      },
      weight: Number, // if applicable
      resistance: String, // e.g., "light", "medium", "heavy"
      restTime: Number, // seconds between sets
      notes: String
    }],

    // Quality Metrics
    formQuality: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'poor'],
      default: 'good'
    },
    effortLevel: {
      type: Number,
      min: 1,
      max: 10,
      required: [true, 'Effort level is required']
    },
    difficultyLevel: {
      type: Number,
      min: 1,
      max: 10,
      required: [true, 'Difficulty level is required']
    }
  },

  // Subjective Assessments
  assessments: {
    // Pain Assessment
    painBefore: {
      type: Number,
      min: 0,
      max: 10,
      required: [true, 'Pain level before exercise is required']
    },
    painDuring: {
      type: Number,
      min: 0,
      max: 10,
      required: [true, 'Pain level during exercise is required']
    },
    painAfter: {
      type: Number,
      min: 0,
      max: 10,
      required: [true, 'Pain level after exercise is required']
    },

    // Functionality Assessment
    mobilityBefore: {
      type: Number,
      min: 1,
      max: 10,
      required: [true, 'Mobility before exercise is required']
    },
    mobilityAfter: {
      type: Number,
      min: 1,
      max: 10,
      required: [true, 'Mobility after exercise is required']
    },

    // Energy and Fatigue
    energyBefore: {
      type: Number,
      min: 1,
      max: 10,
      required: [true, 'Energy level before exercise is required']
    },
    energyAfter: {
      type: Number,
      min: 1,
      max: 10,
      required: [true, 'Energy level after exercise is required']
    }
  },

  // Measurements (if applicable)
  measurements: {
    rangeOfMotion: [{
      joint: String,
      measurement: Number,
      unit: String, // degrees, inches, cm
      direction: String // flexion, extension, etc.
    }],
    strength: [{
      muscle: String,
      measurement: Number,
      unit: String,
      testMethod: String
    }],
    balance: {
      duration: Number, // seconds able to maintain balance
      assistance: String // none, minimal, moderate, maximum
    }
  },

  // Environment and Context
  sessionContext: {
    location: {
      type: String,
      enum: ['home', 'clinic', 'gym', 'outdoor', 'other'],
      required: [true, 'Session location is required']
    },
    supervision: {
      type: String,
      enum: ['supervised', 'independent', 'remote_guidance'],
      required: [true, 'Supervision level is required']
    },
    equipment: [String], // equipment actually used
    environmentalFactors: [String] // weather, noise, distractions, etc.
  },

  // Notes and Observations
  notes: {
    patientNotes: {
      type: String,
      maxlength: [1000, 'Patient notes cannot exceed 1000 characters']
    },
    therapistNotes: {
      type: String,
      maxlength: [1000, 'Therapist notes cannot exceed 1000 characters']
    },
    observations: {
      type: String,
      maxlength: [500, 'Observations cannot exceed 500 characters']
    },
    modifications: {
      type: String,
      maxlength: [500, 'Modifications cannot exceed 500 characters']
    }
  },

  // Attachments (photos, videos of performance)
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'video', 'document'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    caption: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Next Session Planning
  nextSession: {
    recommendations: String,
    adjustments: String,
    targetDate: Date
  },

  // Flags and Status
  flags: {
    requiresReview: {
      type: Boolean,
      default: false
    },
    concernsRaised: {
      type: Boolean,
      default: false
    },
    significantImprovement: {
      type: Boolean,
      default: false
    },
    adverseEvent: {
      type: Boolean,
      default: false
    }
  },

  // Validation and Quality Assurance
  validated: {
    byTherapist: {
      type: Boolean,
      default: false
    },
    byPatient: {
      type: Boolean,
      default: true
    },
    validationDate: Date,
    validatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for pain improvement
progressSchema.virtual('painImprovement').get(function() {
  return this.assessments.painBefore - this.assessments.painAfter;
});

// Virtual for mobility improvement
progressSchema.virtual('mobilityImprovement').get(function() {
  return this.assessments.mobilityAfter - this.assessments.mobilityBefore;
});

// Virtual for energy change
progressSchema.virtual('energyChange').get(function() {
  return this.assessments.energyAfter - this.assessments.energyBefore;
});

// Virtual for overall session score (0-100)
progressSchema.virtual('sessionScore').get(function() {
  const completionScore = this.completionPercentage * 0.4; // 40% weight
  const effortScore = (this.performance.effortLevel / 10) * 100 * 0.3; // 30% weight
  const painScore = Math.max(0, 100 - (this.assessments.painDuring * 10)) * 0.3; // 30% weight

  return Math.round(completionScore + effortScore + painScore);
});

// Pre-save middleware to set flags based on assessments
progressSchema.pre('save', function(next) {
  // Flag for review if pain increased significantly
  if (this.assessments.painAfter > this.assessments.painBefore + 2) {
    this.flags.requiresReview = true;
    this.flags.concernsRaised = true;
  }

  // Flag significant improvement
  if (this.painImprovement >= 2 && this.mobilityImprovement >= 2) {
    this.flags.significantImprovement = true;
  }

  // Flag adverse events
  if (this.assessments.painDuring >= 8 || this.completionStatus === 'unable_to_complete') {
    this.flags.adverseEvent = true;
    this.flags.requiresReview = true;
  }

  next();
});

// Instance method to calculate adherence for this session
progressSchema.methods.calculateAdherence = function() {
  if (this.completionStatus === 'completed') return 100;
  if (this.completionStatus === 'skipped') return 0;
  return this.completionPercentage || 0;
};

// Static method to get progress summary for a patient
progressSchema.statics.getPatientSummary = async function(patientId, startDate, endDate) {
  const match = {
    patient: mongoose.Types.ObjectId(patientId)
  };

  if (startDate && endDate) {
    match.sessionDate = { $gte: startDate, $lte: endDate };
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSessions: { $sum: 1 },
        completedSessions: {
          $sum: { $cond: [{ $eq: ['$completionStatus', 'completed'] }, 1, 0] }
        },
        averagePainBefore: { $avg: '$assessments.painBefore' },
        averagePainAfter: { $avg: '$assessments.painAfter' },
        averageMobilityBefore: { $avg: '$assessments.mobilityBefore' },
        averageMobilityAfter: { $avg: '$assessments.mobilityAfter' },
        averageEffort: { $avg: '$performance.effortLevel' },
        averageCompletion: { $avg: '$completionPercentage' },
        flaggedSessions: {
          $sum: { $cond: ['$flags.requiresReview', 1, 0] }
        }
      }
    },
    {
      $addFields: {
        adherenceRate: {
          $multiply: [
            { $divide: ['$completedSessions', '$totalSessions'] },
            100
          ]
        },
        painImprovement: {
          $subtract: ['$averagePainBefore', '$averagePainAfter']
        },
        mobilityImprovement: {
          $subtract: ['$averageMobilityAfter', '$averageMobilityBefore']
        }
      }
    }
  ]);
};

// Static method to find recent progress for a task
progressSchema.statics.findRecentProgressForTask = function(taskId, limit = 10) {
  return this.find({ rehabTask: taskId })
    .sort({ sessionDate: -1 })
    .limit(limit)
    .populate('patient', 'firstName lastName')
    .populate('recordedBy', 'firstName lastName role');
};

// Indexes for performance
progressSchema.index({ patient: 1, sessionDate: -1 });
progressSchema.index({ rehabTask: 1, sessionDate: -1 });
progressSchema.index({ recordedBy: 1 });
progressSchema.index({ sessionDate: 1 });
progressSchema.index({ 'flags.requiresReview': 1 });

module.exports = mongoose.model('Progress', progressSchema);