const mongoose = require('mongoose');

/**
 * Surgery Schema for detailed surgical procedure records
 * Created and managed by doctors for comprehensive patient care
 */
const surgerySchema = new mongoose.Schema({
  // Patient and Provider Information
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Patient reference is required']
  },
  primarySurgeon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Primary surgeon is required']
  },
  assistingSurgeons: [{
    surgeon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['assistant', 'resident', 'fellow', 'consultant']
    }
  }],

  // Surgery Classification
  surgeryType: {
    type: String,
    required: [true, 'Surgery type is required'],
    enum: {
      values: [
        'orthopedic',
        'neurological',
        'cardiac',
        'general',
        'plastic',
        'vascular',
        'emergency',
        'reconstructive',
        'minimally_invasive',
        'other'
      ],
      message: 'Invalid surgery type'
    }
  },

  // Procedure Details
  procedure: {
    name: {
      type: String,
      required: [true, 'Procedure name is required'],
      trim: true,
      maxlength: [200, 'Procedure name cannot exceed 200 characters']
    },
    description: {
      type: String,
      required: [true, 'Procedure description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    cptCode: {
      type: String, // Current Procedural Terminology code
      trim: true
    },
    icdCode: {
      type: String, // International Classification of Diseases code
      trim: true
    }
  },

  // Anatomical Information
  anatomicalSite: {
    bodyPart: {
      type: String,
      required: [true, 'Body part is required']
    },
    laterality: {
      type: String,
      enum: ['left', 'right', 'bilateral', 'midline', 'not_applicable'],
      required: [true, 'Laterality is required']
    },
    specificLocation: String, // More detailed description
    approach: {
      type: String,
      enum: [
        'open',
        'laparoscopic',
        'arthroscopic',
        'endoscopic',
        'percutaneous',
        'robotic',
        'other'
      ],
      required: [true, 'Surgical approach is required']
    }
  },

  // Scheduling Information
  scheduling: {
    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required']
    },
    actualDate: {
      type: Date,
      required: [true, 'Actual surgery date is required']
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required']
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
      validate: {
        validator: function(v) {
          return v > this.scheduling.startTime;
        },
        message: 'End time must be after start time'
      }
    },
    urgency: {
      type: String,
      enum: ['elective', 'urgent', 'emergency'],
      required: [true, 'Urgency level is required']
    }
  },

  // Pre-operative Information
  preOperative: {
    diagnosis: {
      primary: {
        type: String,
        required: [true, 'Primary diagnosis is required']
      },
      secondary: [String]
    },
    indication: {
      type: String,
      required: [true, 'Surgical indication is required']
    },
    riskFactors: [String],
    allergies: [String],
    medications: [String],
    asaScore: {
      type: Number,
      min: 1,
      max: 6 // American Society of Anesthesiologists Physical Status Classification
    },
    consentObtained: {
      type: Boolean,
      required: [true, 'Consent status is required'],
      default: false
    },
    consentDate: Date
  },

  // Operative Details
  operative: {
    anesthesia: {
      type: {
        type: String,
        enum: ['general', 'regional', 'local', 'monitored', 'combination'],
        required: [true, 'Anesthesia type is required']
      },
      provider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      complications: [String]
    },
    position: {
      type: String,
      enum: ['supine', 'prone', 'lateral', 'lithotomy', 'sitting', 'other']
    },
    equipmentUsed: [String],
    implants: [{
      type: String,
      manufacturer: String,
      model: String,
      serialNumber: String,
      size: String
    }],
    specimens: [{
      type: String,
      sentTo: String, // pathology, lab, etc.
      findings: String
    }],
    bloodLoss: {
      estimated: Number, // in mL
      actual: Number // if measured
    },
    complications: [{
      type: String,
      severity: {
        type: String,
        enum: ['minor', 'moderate', 'major', 'life_threatening']
      },
      management: String
    }]
  },

  // Operative Findings and Technique
  findings: {
    intraoperativeFindings: {
      type: String,
      required: [true, 'Intraoperative findings are required']
    },
    technique: {
      type: String,
      required: [true, 'Surgical technique description is required']
    },
    closure: {
      layers: [String],
      materials: [String]
    }
  },

  // Post-operative Information
  postOperative: {
    immediateStatus: {
      type: String,
      enum: ['stable', 'guarded', 'critical'],
      required: [true, 'Immediate post-op status is required']
    },
    disposition: {
      type: String,
      enum: ['recovery', 'icu', 'ward', 'discharge', 'other'],
      required: [true, 'Post-op disposition is required']
    },
    instructions: String,
    followUpPlan: String,
    restrictions: [String],
    medications: [String],
    complications: [{
      type: String,
      date: Date,
      severity: String,
      resolution: String
    }]
  },

  // Outcomes and Assessment
  outcomes: {
    success: {
      type: String,
      enum: ['complete', 'partial', 'unsuccessful'],
      default: 'complete'
    },
    functionalOutcome: {
      baseline: String,
      expected: String,
      actual: String
    },
    patientSatisfaction: {
      type: Number,
      min: 1,
      max: 10
    }
  },

  // Quality and Safety
  quality: {
    timeoutPerformed: {
      type: Boolean,
      required: true,
      default: false
    },
    siteMarked: {
      type: Boolean,
      required: true,
      default: false
    },
    instrumentCount: {
      initial: Number,
      final: Number,
      correct: {
        type: Boolean,
        default: true
      }
    },
    safetyChecklist: {
      completed: {
        type: Boolean,
        default: false
      },
      completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    }
  },

  // Documentation and Files
  documentation: {
    operativeReport: String, // Full detailed report
    pathologyReport: String,
    imagingReports: [String],
    photos: [{
      type: String, // URL to image
      caption: String,
      stage: {
        type: String,
        enum: ['pre_op', 'intra_op', 'post_op', 'follow_up']
      }
    }],
    videos: [{
      type: String, // URL to video
      caption: String,
      duration: Number // in seconds
    }]
  },

  // Billing and Administrative
  administrative: {
    facility: String,
    operatingRoom: String,
    billingCode: String,
    insuranceAuthorization: String,
    costCenter: String
  },

  // Status and Workflow
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled', 'delayed'],
    default: 'scheduled'
  },

  // Revision Information
  revision: {
    isRevision: {
      type: Boolean,
      default: false
    },
    originalSurgery: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Surgery'
    },
    revisionReason: String,
    revisionNumber: {
      type: Number,
      default: 0
    }
  },

  // Follow-up and Rehabilitation
  rehabilitation: {
    required: {
      type: Boolean,
      default: false
    },
    startDate: Date,
    assignedTherapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rehabilitationPlan: String,
    expectedDuration: Number, // in weeks
    goals: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for surgery duration
surgerySchema.virtual('duration').get(function() {
  if (!this.scheduling.startTime || !this.scheduling.endTime) return null;
  const durationMs = this.scheduling.endTime - this.scheduling.startTime;
  return Math.round(durationMs / (1000 * 60)); // Duration in minutes
});

// Virtual for time since surgery
surgerySchema.virtual('daysSinceSurgery').get(function() {
  if (!this.scheduling.actualDate) return null;
  const today = new Date();
  const surgeryDate = new Date(this.scheduling.actualDate);
  const timeDiff = today.getTime() - surgeryDate.getTime();
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
});

// Virtual for complication count
surgerySchema.virtual('complicationCount').get(function() {
  let count = 0;
  if (this.operative.anesthesia.complications) count += this.operative.anesthesia.complications.length;
  if (this.operative.complications) count += this.operative.complications.length;
  if (this.postOperative.complications) count += this.postOperative.complications.length;
  return count;
});

// Pre-save middleware
surgerySchema.pre('save', function(next) {
  // Auto-set status based on dates
  const now = new Date();

  if (this.status === 'scheduled') {
    if (this.scheduling.startTime <= now && this.scheduling.endTime > now) {
      this.status = 'in_progress';
    } else if (this.scheduling.endTime <= now) {
      this.status = 'completed';
    }
  }

  // Set revision information
  if (this.revision.originalSurgery && !this.revision.isRevision) {
    this.revision.isRevision = true;
  }

  next();
});

// Instance method to add complication
surgerySchema.methods.addComplication = function(stage, complication) {
  switch(stage) {
    case 'operative':
      if (!this.operative.complications) this.operative.complications = [];
      this.operative.complications.push(complication);
      break;
    case 'postoperative':
      if (!this.postOperative.complications) this.postOperative.complications = [];
      this.postOperative.complications.push(complication);
      break;
    case 'anesthesia':
      if (!this.operative.anesthesia.complications) this.operative.anesthesia.complications = [];
      this.operative.anesthesia.complications.push(complication);
      break;
  }
  return this.save();
};

// Static method to find surgeries by surgeon
surgerySchema.statics.findBySurgeon = function(surgeonId) {
  return this.find({
    $or: [
      { primarySurgeon: surgeonId },
      { 'assistingSurgeons.surgeon': surgeonId }
    ]
  })
  .populate('patient', 'firstName lastName dateOfBirth')
  .sort({ 'scheduling.actualDate': -1 });
};

// Static method to find surgeries by patient
surgerySchema.statics.findByPatient = function(patientId) {
  return this.find({ patient: patientId })
    .populate('primarySurgeon', 'firstName lastName')
    .populate('assistingSurgeons.surgeon', 'firstName lastName')
    .sort({ 'scheduling.actualDate': -1 });
};

// Static method for surgery statistics
surgerySchema.statics.getSurgeonStats = async function(surgeonId, startDate, endDate) {
  const match = {
    primarySurgeon: mongoose.Types.ObjectId(surgeonId),
    status: 'completed'
  };

  if (startDate && endDate) {
    match['scheduling.actualDate'] = { $gte: startDate, $lte: endDate };
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSurgeries: { $sum: 1 },
        averageDuration: {
          $avg: {
            $divide: [
              { $subtract: ['$scheduling.endTime', '$scheduling.startTime'] },
              60000 // Convert to minutes
            ]
          }
        },
        totalComplications: {
          $sum: {
            $add: [
              { $size: { $ifNull: ['$operative.complications', []] } },
              { $size: { $ifNull: ['$postOperative.complications', []] } },
              { $size: { $ifNull: ['$operative.anesthesia.complications', []] } }
            ]
          }
        },
        emergencySurgeries: {
          $sum: { $cond: [{ $eq: ['$scheduling.urgency', 'emergency'] }, 1, 0] }
        }
      }
    },
    {
      $addFields: {
        complicationRate: {
          $multiply: [
            { $divide: ['$totalComplications', '$totalSurgeries'] },
            100
          ]
        }
      }
    }
  ]);
};

// Indexes for performance
surgerySchema.index({ patient: 1, 'scheduling.actualDate': -1 });
surgerySchema.index({ primarySurgeon: 1, 'scheduling.actualDate': -1 });
surgerySchema.index({ 'assistingSurgeons.surgeon': 1 });
surgerySchema.index({ surgeryType: 1 });
surgerySchema.index({ status: 1 });
surgerySchema.index({ 'scheduling.actualDate': 1 });
surgerySchema.index({ 'revision.originalSurgery': 1 });

module.exports = mongoose.model('Surgery', surgerySchema);