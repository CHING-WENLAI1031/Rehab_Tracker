# Patient API Endpoints

## Overview
Patient endpoints enable patients to manage their rehabilitation journey, track progress, create personal notes, and interact with their care team.

## Base URL
```
/api/patients
```

## Authentication
All endpoints require JWT authentication with `patient` role.

---

## Dashboard

### GET /api/patients/dashboard
Get comprehensive dashboard data with analytics and progress summaries.

**Authentication:** Required (Patient only)

**Response:**
```json
{
  "success": true,
  "data": {
    "activeTasks": [...],
    "recentProgress": [...],
    "upcomingTasks": [...],
    "providers": [...],
    "achievementStats": {...},
    "weeklyStats": {...}
  }
}
```

---

### GET /api/patients/dashboard/overview
Get lightweight dashboard overview.

**Authentication:** Required (Patient only)

**Response:**
```json
{
  "success": true,
  "data": {
    "activeTasks": [{
      "_id": "...",
      "title": "Morning Stretches",
      "status": "active",
      "scheduleType": "daily",
      "exercises": [...]
    }],
    "upcomingTasks": [...],
    "providers": [{
      "providerId": {...},
      "role": "physiotherapist",
      "assignedAt": "2024-01-01T00:00:00.000Z"
    }],
    "upcomingPeriod": {
      "startDate": "2024-01-15T00:00:00.000Z",
      "endDate": "2024-01-22T00:00:00.000Z",
      "days": 7
    }
  }
}
```

---

### GET /api/patients/dashboard/active-tasks
Get active tasks with detailed progress indicators.

**Authentication:** Required (Patient only)

**Response:**
```json
{
  "success": true,
  "data": {
    "tasks": [...],
    "summary": {
      "total": 5,
      "completed": 2,
      "inProgress": 3
    }
  }
}
```

---

### GET /api/patients/dashboard/recent-progress
Get recent progress summary (last 7 days).

**Authentication:** Required (Patient only)

**Response:**
```json
{
  "success": true,
  "data": {
    "progressRecords": [...],
    "summary": {
      "totalSessions": 12,
      "avgPainReduction": 2.5,
      "avgMobilityImprovement": 1.8
    },
    "period": {
      "startDate": "2024-01-08T00:00:00.000Z",
      "endDate": "2024-01-15T00:00:00.000Z"
    }
  }
}
```

---

### GET /api/patients/dashboard/achievements
Get achievement statistics and milestones.

**Authentication:** Required (Patient only)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSessions": 50,
    "streakDays": 7,
    "milestones": [
      {
        "type": "sessions_10",
        "achieved": true,
        "date": "2024-01-05T00:00:00.000Z"
      }
    ]
  }
}
```

---

### GET /api/patients/dashboard/weekly-stats
Get weekly progress statistics.

**Authentication:** Required (Patient only)

**Response:**
```json
{
  "success": true,
  "data": {
    "week": {
      "startDate": "2024-01-08T00:00:00.000Z",
      "endDate": "2024-01-15T00:00:00.000Z"
    },
    "sessionsCompleted": 5,
    "averages": {
      "painReduction": 2.0,
      "mobilityImprovement": 1.5,
      "sessionDuration": 35
    }
  }
}
```

---

### GET /api/patients/dashboard/overall-progress
Get overall progress summary since start.

**Authentication:** Required (Patient only)

**Response:**
```json
{
  "success": true,
  "data": {
    "startDate": "2023-12-01T00:00:00.000Z",
    "totalDays": 45,
    "totalSessions": 50,
    "overallProgress": 0.75,
    "trends": {
      "pain": "decreasing",
      "mobility": "improving",
      "energy": "stable"
    }
  }
}
```

---

## Tasks & Schedule

### GET /api/patients/tasks
Get patient's rehab tasks.

**Authentication:** Required (Patient only)

**Query Parameters:**
- `active` (optional): Filter by active status ("true" | "false")
- `status` (optional): Filter by status ("active" | "completed" | "archived")
- `category` (optional): Filter by category

**Response:**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "_id": "...",
        "title": "Morning Stretches",
        "description": "Daily morning stretching routine",
        "assignedTo": "...",
        "assignedBy": {...},
        "status": "active",
        "scheduleType": "daily",
        "exercises": [...],
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "totalCount": 5
  }
}
```

---

### GET /api/patients/tasks/:taskId
Get specific task details.

**Authentication:** Required (Patient only)

**URL Parameters:**
- `taskId` (required): MongoDB ObjectId of the task

**Response:**
```json
{
  "success": true,
  "data": {
    "task": {
      "_id": "...",
      "title": "Morning Stretches",
      "description": "Daily morning stretching routine",
      "exercises": [
        {
          "name": "Hamstring Stretch",
          "sets": 3,
          "reps": 10,
          "duration": null,
          "restBetweenSets": 60,
          "instructions": "Hold each stretch for 30 seconds"
        }
      ],
      "assignedBy": {
        "_id": "...",
        "firstName": "Jane",
        "lastName": "Physio",
        "role": "physiotherapist"
      },
      "status": "active",
      "scheduleType": "daily",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

**Error Responses:**
- `403 Forbidden` - Task not assigned to this patient
- `404 Not Found` - Task not found

---

### GET /api/patients/upcoming
Get upcoming tasks.

**Authentication:** Required (Patient only)

**Query Parameters:**
- `days` (optional): Number of days to look ahead (default: 7)

**Response:**
```json
{
  "success": true,
  "data": {
    "tasks": [...],
    "period": {
      "startDate": "2024-01-15T00:00:00.000Z",
      "endDate": "2024-01-22T00:00:00.000Z",
      "days": 7
    }
  }
}
```

---

### POST /api/patients/tasks/:taskId/notes
Add patient notes to a task.

**Authentication:** Required (Patient only)

**URL Parameters:**
- `taskId` (required): MongoDB ObjectId of the task

**Request Body:**
```json
{
  "notes": "string (required)"
}
```

**Example Request:**
```json
{
  "notes": "Felt some tightness in left hamstring during this exercise. Reduced intensity slightly."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notes added successfully",
  "data": {
    "taskId": "...",
    "notes": "Felt some tightness in left hamstring...",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## Personal Notes

### POST /api/patients/notes
Create a personal note or reflection.

**Authentication:** Required (Patient only)

**Request Body:**
```json
{
  "content": "string (required)",
  "mood": "positive | neutral | negative",
  "category": "daily_reflection | pain_log | achievement | concern | question | general",
  "tags": ["array of strings"],
  "visibility": "patient_only | patient_visible",
  "isPrivate": "boolean"
}
```

**Example Request:**
```json
{
  "content": "Feeling much better today. Pain level reduced significantly after yesterday's session.",
  "mood": "positive",
  "category": "daily_reflection",
  "tags": ["pain", "improvement"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "note": {
      "_id": "...",
      "author": {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe"
      },
      "content": "Feeling much better today...",
      "commentType": "patient_note",
      "targetType": "patient",
      "targetId": "...",
      "relatedPatient": "...",
      "visibility": "patient_only",
      "metadata": {
        "mood": "positive",
        "category": "daily_reflection",
        "isPrivate": true
      },
      "tags": ["pain", "improvement"],
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "message": "Note added successfully"
}
```

**Note Categories:**
- `daily_reflection` - Daily thoughts and observations
- `pain_log` - Pain-related notes
- `achievement` - Milestones and achievements
- `concern` - Worries or concerns
- `question` - Questions for care team
- `general` - General notes

---

### GET /api/patients/notes
Get patient's personal notes.

**Authentication:** Required (Patient only)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `category` (optional): Filter by category
- `dateFrom` (optional): Start date filter (ISO 8601)
- `dateTo` (optional): End date filter (ISO 8601)
- `mood` (optional): Filter by mood

**Response:**
```json
{
  "success": true,
  "data": {
    "notes": [
      {
        "_id": "...",
        "author": {...},
        "content": "Feeling much better today...",
        "commentType": "patient_note",
        "visibility": "patient_only",
        "metadata": {
          "mood": "positive",
          "category": "daily_reflection"
        },
        "tags": ["pain", "improvement"],
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalCount": 52,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

## Progress Tracking

### POST /api/patients/progress
Record a new exercise session.

**Authentication:** Required (Patient only)

**Request Body:**
```json
{
  "rehabTask": "ObjectId (required)",
  "sessionDate": "ISO 8601 date",
  "completionStatus": "completed | partially_completed | skipped",
  "assessments": {
    "painBefore": "number (1-10)",
    "painAfter": "number (1-10)",
    "mobilityBefore": "number (1-10)",
    "mobilityAfter": "number (1-10)",
    "energyBefore": "number (1-10)",
    "energyAfter": "number (1-10)"
  },
  "sessionDuration": "number (minutes)",
  "notes": "string",
  "exerciseDetails": [
    {
      "exercise": "string",
      "setsCompleted": "number",
      "repsCompleted": "number",
      "difficulty": "easy | moderate | challenging | very_hard"
    }
  ]
}
```

**Example Request:**
```json
{
  "rehabTask": "507f1f77bcf86cd799439011",
  "sessionDate": "2024-01-15T09:00:00.000Z",
  "completionStatus": "completed",
  "assessments": {
    "painBefore": 5,
    "painAfter": 3,
    "mobilityBefore": 6,
    "mobilityAfter": 8,
    "energyBefore": 7,
    "energyAfter": 6
  },
  "sessionDuration": 35,
  "notes": "Good session overall. Felt stronger today."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "progress": {
      "_id": "...",
      "patient": "...",
      "rehabTask": {...},
      "sessionDate": "2024-01-15T09:00:00.000Z",
      "completionStatus": "completed",
      "assessments": {...},
      "sessionDuration": 35,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "message": "Session recorded successfully"
}
```

---

### GET /api/patients/progress
Get patient's progress history.

**Authentication:** Required (Patient only)

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `dateFrom` (optional): Start date filter
- `dateTo` (optional): End date filter
- `taskId` (optional): Filter by specific task

**Response:**
```json
{
  "success": true,
  "data": {
    "progressRecords": [...],
    "pagination": {...}
  }
}
```

---

### GET /api/patients/progress/:progressId
Get specific progress record.

**Authentication:** Required (Patient only)

**URL Parameters:**
- `progressId` (required): MongoDB ObjectId of the progress record

**Response:**
```json
{
  "success": true,
  "data": {
    "progress": {
      "_id": "...",
      "patient": {...},
      "rehabTask": {...},
      "sessionDate": "2024-01-15T09:00:00.000Z",
      "completionStatus": "completed",
      "assessments": {...},
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

---

### PUT /api/patients/progress/:progressId
Update a progress record.

**Authentication:** Required (Patient only)

**URL Parameters:**
- `progressId` (required): MongoDB ObjectId of the progress record

**Request Body:**
```json
{
  "notes": "string",
  "completionStatus": "completed | partially_completed | skipped",
  "assessments": {...}
}
```

---

### DELETE /api/patients/progress/:progressId
Delete a progress record.

**Authentication:** Required (Patient only)

**URL Parameters:**
- `progressId` (required): MongoDB ObjectId of the progress record

**Response:**
```json
{
  "success": true,
  "message": "Progress record deleted successfully"
}
```

---

## Analytics

### GET /api/patients/analytics
Get patient's progress analytics.

**Authentication:** Required (Patient only)

**Query Parameters:**
- `dateFrom` (optional): Start date for analytics
- `dateTo` (optional): End date for analytics
- `groupBy` (optional): "day" | "week" | "month"

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalSessions": 50,
      "avgPainReduction": 2.5,
      "avgMobilityImprovement": 1.8,
      "completionRate": 0.92
    },
    "trends": {
      "pain": [...],
      "mobility": [...],
      "energy": [...]
    },
    "period": {
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-15T00:00:00.000Z"
    }
  }
}
```

---

### GET /api/patients/tasks/:taskId/progress
Get progress for a specific task.

**Authentication:** Required (Patient only)

**URL Parameters:**
- `taskId` (required): MongoDB ObjectId of the task

**Response:**
```json
{
  "success": true,
  "data": {
    "task": {...},
    "progressRecords": [...],
    "summary": {
      "totalSessions": 12,
      "avgCompletionRate": 0.95,
      "trends": {...}
    }
  }
}
```

---

## Providers

### GET /api/patients/providers
Get patient's assigned healthcare providers.

**Authentication:** Required (Patient only)

**Response:**
```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "providerId": {
          "_id": "...",
          "firstName": "Dr",
          "lastName": "Smith",
          "role": "doctor",
          "specialization": "Orthopedics",
          "email": "doctor@example.com",
          "phoneNumber": "+1234567890"
        },
        "role": "doctor",
        "assignedAt": "2024-01-01T00:00:00.000Z"
      },
      {
        "providerId": {
          "_id": "...",
          "firstName": "Jane",
          "lastName": "Physio",
          "role": "physiotherapist",
          "email": "physio@example.com",
          "phoneNumber": "+1234567891"
        },
        "role": "physiotherapist",
        "assignedAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

## Common Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Access denied",
  "message": "You do not have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Resource not found"
}
```

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Required field 'content' is missing"
}
```
