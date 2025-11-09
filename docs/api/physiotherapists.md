# Physiotherapist API Endpoints

## Overview
Physiotherapist endpoints provide comprehensive patient management capabilities including patient monitoring, feedback provision, schedule management, and progress tracking.

## Base URL
```
/api/physiotherapists
```

## Authentication
All endpoints require JWT authentication with `physiotherapist` role.

---

## Patient Management

### GET /api/physiotherapists/patients/:patientId
Get detailed information about an assigned patient.

**Authentication:** Required (Physiotherapist only)

**URL Parameters:**
- `patientId` (required): MongoDB ObjectId of the patient

**Authorization Check:**
- Patient must be assigned to the requesting physiotherapist

**Response:**
```json
{
  "success": true,
  "data": {
    "patient": {
      "_id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "role": "patient",
      "phoneNumber": "+1234567890"
    },
    "activeTasks": [
      {
        "_id": "...",
        "title": "Morning Stretches",
        "description": "Daily morning routine",
        "status": "active",
        "scheduleType": "daily",
        "exercises": [...],
        "assignedBy": "...",
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "recentTasks": [
      {
        "_id": "...",
        "title": "Strength Training",
        "status": "completed",
        "completedAt": "2024-01-10T00:00:00.000Z"
      }
    ],
    "recentProgress": [
      {
        "_id": "...",
        "rehabTask": {...},
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
        "sessionDuration": 35
      }
    ],
    "analytics": {
      "totalSessions": 50,
      "completionRate": 0.92,
      "avgPainReduction": 2.5,
      "avgMobilityImprovement": 1.8,
      "currentStreak": 7,
      "trends": {
        "pain": "decreasing",
        "mobility": "improving",
        "energy": "stable"
      }
    }
  }
}
```

**Data Limits:**
- `activeTasks`: Maximum 10 most recent active tasks
- `recentTasks`: Last 5 completed tasks
- `recentProgress`: Last 10 progress records

**Error Responses:**
- `403 Forbidden` - Patient is not assigned to this physiotherapist
- `404 Not Found` - Patient does not exist

**Example Usage:**
```bash
curl -X GET \
  http://localhost:5000/api/physiotherapists/patients/507f1f77bcf86cd799439011 \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

---

## Feedback Management

### POST /api/physiotherapists/feedback
Provide feedback to an assigned patient.

**Authentication:** Required (Physiotherapist only)

**Authorization Check:**
- Patient must be assigned to the requesting physiotherapist

**Request Body:**
```json
{
  "patientId": "ObjectId (required)",
  "content": "string (required)",
  "feedbackType": "encouragement | improvement_needed | technique_correction | general",
  "category": "progress_review | technique_correction | motivation | safety_concern | general",
  "priority": "low | normal | high",
  "visibility": "patient_visible | team_visible",
  "requiresResponse": "boolean",
  "relatedTask": "ObjectId (optional)"
}
```

**Example Request:**
```json
{
  "patientId": "507f1f77bcf86cd799439011",
  "content": "Great progress this week! Your form has improved significantly on the hamstring stretches. Keep up the excellent work!",
  "feedbackType": "encouragement",
  "category": "progress_review",
  "priority": "normal",
  "requiresResponse": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "feedback": {
      "_id": "...",
      "author": {
        "_id": "...",
        "firstName": "Jane",
        "lastName": "Physio",
        "role": "physiotherapist"
      },
      "content": "Great progress this week!...",
      "commentType": "feedback",
      "targetType": "patient",
      "targetId": "507f1f77bcf86cd799439011",
      "relatedPatient": "507f1f77bcf86cd799439011",
      "visibility": "patient_visible",
      "priority": "normal",
      "visibleTo": [
        {
          "user": "507f1f77bcf86cd799439011",
          "role": "patient"
        },
        {
          "user": "...",
          "role": "physiotherapist"
        }
      ],
      "metadata": {
        "feedbackType": "encouragement",
        "category": "progress_review",
        "requiresResponse": false
      },
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "notification": {
      "_id": "...",
      "recipient": "507f1f77bcf86cd799439011",
      "recipientRole": "patient",
      "sender": "...",
      "title": "New Feedback from Jane Physio",
      "message": "You have received new feedback from your physiotherapist",
      "type": "feedback_received",
      "category": "communication",
      "priority": "normal",
      "isRead": false,
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "message": "Feedback added successfully and notification sent"
}
```

**Automatic Actions:**
- Creates `feedback_received` notification for patient
- Notification priority matches feedback priority
- Feedback is visible to both patient and physiotherapist
- Notification includes link to view feedback

**Feedback Types:**
- `encouragement` - Positive reinforcement
- `improvement_needed` - Areas for improvement
- `technique_correction` - Exercise technique guidance
- `general` - General feedback

**Categories:**
- `progress_review` - Overall progress assessment
- `technique_correction` - Exercise form and technique
- `motivation` - Motivational support
- `safety_concern` - Safety-related feedback
- `general` - General comments

**Error Responses:**
- `400 Bad Request` - Missing required fields (patientId or content)
- `403 Forbidden` - Patient is not assigned to this physiotherapist
- `404 Not Found` - Patient not found

**Example Usage:**
```bash
curl -X POST \
  http://localhost:5000/api/physiotherapists/feedback \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "patientId": "507f1f77bcf86cd799439011",
    "content": "Great progress this week!",
    "feedbackType": "encouragement",
    "category": "progress_review",
    "priority": "normal"
  }'
```

---

### POST /api/physiotherapists/feedback (with requiresResponse)
Request patient response to feedback.

**Example Request:**
```json
{
  "patientId": "507f1f77bcf86cd799439011",
  "content": "Please let me know how you feel about the new exercises I've added. Are they too challenging?",
  "feedbackType": "general",
  "category": "general",
  "priority": "normal",
  "requiresResponse": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "feedback": {
      "_id": "...",
      "metadata": {
        "requiresResponse": true
      },
      "status": "active",
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "notification": {...}
  }
}
```

**When requiresResponse is true:**
- Feedback status is set to `active`
- Patient is notified to respond
- Feedback appears in patient's action items
- Can be resolved by patient response

---

### POST /api/physiotherapists/feedback (technique correction)
Provide technique corrections with safety concerns.

**Example Request:**
```json
{
  "patientId": "507f1f77bcf86cd799439011",
  "content": "I noticed in your last video that you're rounding your back during the hamstring stretch. Please keep your spine neutral to avoid strain. Watch the demonstration video again.",
  "feedbackType": "technique_correction",
  "category": "safety_concern",
  "priority": "high",
  "relatedTask": "507f1f77bcf86cd799439012"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "feedback": {
      "_id": "...",
      "content": "I noticed in your last video...",
      "priority": "high",
      "metadata": {
        "feedbackType": "technique_correction",
        "category": "safety_concern"
      },
      "relatedEntity": {
        "entityType": "rehabTask",
        "entityId": "507f1f77bcf86cd799439012"
      }
    },
    "notification": {
      "priority": "high",
      "isUrgent": false
    }
  }
}
```

---

## Dashboard & Analytics

### GET /api/physiotherapists/dashboard
Get physiotherapist dashboard with patient overview.

**Authentication:** Required (Physiotherapist only)

**Response:**
```json
{
  "success": true,
  "data": {
    "assignedPatients": {
      "total": 8,
      "active": 7,
      "recovering": 1
    },
    "recentActivity": [
      {
        "patientId": "...",
        "patientName": "John Doe",
        "activity": "completed_session",
        "timestamp": "2024-01-15T09:00:00.000Z"
      }
    ],
    "alerts": [
      {
        "patientId": "...",
        "alertType": "missed_sessions",
        "message": "Patient has missed 3 consecutive sessions"
      }
    ],
    "upcomingTasks": [...]
  }
}
```

---

### GET /api/physiotherapists/patients
Get list of all assigned patients.

**Authentication:** Required (Physiotherapist only)

**Response:**
```json
{
  "success": true,
  "data": {
    "patients": [
      {
        "_id": "...",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "assignedAt": "2024-01-01T00:00:00.000Z",
        "currentStatus": "active",
        "recentActivity": "2024-01-15T09:00:00.000Z"
      }
    ],
    "totalCount": 8
  }
}
```

---

### GET /api/physiotherapists/analytics
Get analytics data for all assigned patients.

**Authentication:** Required (Physiotherapist only)

**Query Parameters:**
- `dateFrom` (optional): Start date filter
- `dateTo` (optional): End date filter

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalPatients": 8,
      "avgCompletionRate": 0.88,
      "totalSessions": 450,
      "avgSessionDuration": 32
    },
    "patientPerformance": [
      {
        "patientId": "...",
        "patientName": "John Doe",
        "completionRate": 0.95,
        "progressTrend": "improving"
      }
    ],
    "alerts": [...]
  }
}
```

---

## Schedule Management

### POST /api/physiotherapists/schedule
Create a new rehab schedule/task for a patient.

**Authentication:** Required (Physiotherapist only)

**Request Body:**
```json
{
  "patientId": "ObjectId (required)",
  "title": "string (required)",
  "description": "string",
  "scheduleType": "once | daily | weekly | custom (required)",
  "scheduledDate": "ISO 8601 date",
  "exercises": [
    {
      "name": "string (required)",
      "sets": "number",
      "reps": "number",
      "duration": "number (seconds)",
      "restBetweenSets": "number (seconds)",
      "instructions": "string"
    }
  ],
  "category": "strength | flexibility | balance | cardio | recovery",
  "priority": "low | normal | high"
}
```

---

### PUT /api/physiotherapists/schedule/:scheduleId
Update an existing rehab schedule.

**Authentication:** Required (Physiotherapist only)

**URL Parameters:**
- `scheduleId` (required): MongoDB ObjectId of the schedule/task

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "status": "active | paused | completed | archived",
  "exercises": [...],
  "notes": "string"
}
```

---

## Common Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "Patient ID and content are required"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden - Not Assigned
```json
{
  "success": false,
  "error": "Access denied",
  "message": "Patient is not assigned to you"
}
```

### 403 Forbidden - Wrong Role
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "Access denied. Physiotherapist role required."
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Patient not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## Best Practices

### Feedback Guidelines
1. **Be Specific**: Provide clear, actionable feedback
2. **Be Timely**: Provide feedback shortly after patient activity
3. **Balance Positive and Corrective**: Mix encouragement with areas for improvement
4. **Use Appropriate Priority**:
   - `high` for safety concerns or important corrections
   - `normal` for regular feedback
   - `low` for general encouragement

### Patient Assignment Verification
All patient-related endpoints automatically verify:
- Patient is assigned to the requesting physiotherapist
- Returns `403 Forbidden` if not assigned
- Prevents unauthorized access to patient data

### Notification System
- Feedback automatically creates patient notifications
- Priority levels are preserved in notifications
- Patients are notified in real-time via Socket.io
- Notification history is tracked for auditing

---

## Example Workflows

### Daily Patient Check-In
```bash
# 1. Get list of assigned patients
GET /api/physiotherapists/patients

# 2. Review specific patient details
GET /api/physiotherapists/patients/507f1f77bcf86cd799439011

# 3. Provide feedback based on recent progress
POST /api/physiotherapists/feedback
{
  "patientId": "507f1f77bcf86cd799439011",
  "content": "Great session today!",
  "feedbackType": "encouragement"
}
```

### Weekly Progress Review
```bash
# 1. Get patient details with analytics
GET /api/physiotherapists/patients/507f1f77bcf86cd799439011

# 2. Review analytics data
GET /api/physiotherapists/analytics?dateFrom=2024-01-08&dateTo=2024-01-15

# 3. Provide comprehensive feedback
POST /api/physiotherapists/feedback
{
  "patientId": "507f1f77bcf86cd799439011",
  "content": "Weekly review: Excellent progress...",
  "category": "progress_review",
  "priority": "normal"
}
```
