# Doctor API Endpoints

## Overview
Doctor endpoints provide comprehensive oversight capabilities for managing patients, surgery records, medical annotations, and clinical recommendations.

## Base URL
```
/api/doctors
```

## Authentication
All endpoints require JWT authentication with `doctor` role.

---

## Dashboard & Analytics

### GET /api/doctors/dashboard
Get comprehensive dashboard data including patient population, treatment outcomes, and critical alerts.

**Authentication:** Required (Doctor only)

**Response:**
```json
{
  "success": true,
  "data": {
    "patientPopulation": {
      "total": 150,
      "byStatus": {
        "active": 120,
        "recovering": 25,
        "completed": 5
      }
    },
    "treatmentOutcomes": {
      "successRate": 0.92,
      "avgRecoveryTime": 168
    },
    "criticalAlerts": [
      {
        "patientId": "...",
        "alertType": "delayed_recovery",
        "message": "Patient recovery behind schedule"
      }
    ]
  }
}
```

---

### GET /api/doctors/analytics/overview
Get comprehensive analytics including performance metrics, treatment outcomes, and physiotherapist metrics.

**Authentication:** Required (Doctor only)

**Response:**
```json
{
  "success": true,
  "data": {
    "performanceMetrics": {
      "totalSurgeries": 500,
      "successRate": 0.95,
      "avgRecoveryTime": 180
    },
    "treatmentOutcomes": {
      "excellent": 60,
      "good": 30,
      "fair": 8,
      "poor": 2
    },
    "physiotherapistMetrics": {
      "totalPhysiotherapists": 15,
      "avgPatientsPerPhysio": 8
    },
    "criticalAlerts": []
  }
}
```

---

## Patient Management

### GET /api/doctors/patients
Get overview of all patients in the system.

**Authentication:** Required (Doctor only)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPatients": 150,
    "demographics": {
      "ageGroups": {
        "18-30": 20,
        "31-50": 60,
        "51-70": 50,
        "70+": 20
      },
      "surgeryTypes": {
        "ACL Reconstruction": 45,
        "Knee Replacement": 35,
        "Hip Replacement": 30
      }
    }
  }
}
```

---

### GET /api/doctors/patients/:patientId/recovery
Get detailed recovery progress for a specific patient.

**Authentication:** Required (Doctor only)

**URL Parameters:**
- `patientId` (required): MongoDB ObjectId of the patient

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
      "role": "patient"
    },
    "treatmentHistory": {
      "surgeries": [...],
      "rehabTasks": [...],
      "progressRecords": [...]
    },
    "recoveryMetrics": {
      "overallProgress": 0.75,
      "painReduction": 0.60,
      "mobilityImprovement": 0.80
    }
  }
}
```

**Error Responses:**
- `403 Forbidden` - Patient not assigned to this doctor
- `404 Not Found` - Patient does not exist

---

## Medical Annotations

### POST /api/doctors/annotations
Create a medical annotation for a patient.

**Authentication:** Required (Doctor only)

**Request Body:**
```json
{
  "patientId": "ObjectId (required)",
  "content": "string (required)",
  "category": "string (required)",
  "clinicalSignificance": "low | moderate | high | critical",
  "priority": "low | normal | high | urgent",
  "visibility": "team_visible | patient_excluded | patient_visible",
  "requiresFollowUp": "boolean"
}
```

**Example Request:**
```json
{
  "patientId": "507f1f77bcf86cd799439011",
  "content": "Patient showing excellent progress. Recommend continuing current rehab protocol.",
  "category": "progress_review",
  "clinicalSignificance": "moderate",
  "priority": "normal"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "annotation": {
      "_id": "...",
      "author": {...},
      "content": "Patient showing excellent progress...",
      "commentType": "medical_annotation",
      "targetType": "patient",
      "targetId": "507f1f77bcf86cd799439011",
      "visibility": "team_visible",
      "priority": "normal",
      "metadata": {
        "category": "progress_review",
        "clinicalSignificance": "moderate",
        "requiresFollowUp": false
      },
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "message": "Annotation created successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields
- `404 Not Found` - Patient not found

**Categories:**
- `progress_review` - General progress assessment
- `treatment_plan` - Treatment plan annotations
- `complications` - Complications or concerns
- `medication_notes` - Medication-related notes
- `diagnostic_findings` - Diagnostic observations
- `discharge_planning` - Discharge-related notes

---

## Clinical Recommendations

### POST /api/doctors/recommendations
Create a clinical recommendation that will be sent to patient and assigned physiotherapist.

**Authentication:** Required (Doctor only)

**Request Body:**
```json
{
  "patientId": "ObjectId (required)",
  "content": "string (required)",
  "category": "string (required)",
  "recommendationType": "treatment | lifestyle | medication | referral",
  "priority": "low | normal | high | urgent",
  "visibility": "patient_visible | team_visible",
  "requiresResponse": "boolean",
  "targetDate": "ISO 8601 date (optional)"
}
```

**Example Request:**
```json
{
  "patientId": "507f1f77bcf86cd799439011",
  "content": "Increase exercise intensity gradually over next 4 weeks. Monitor for any pain or discomfort.",
  "category": "treatment_adjustment",
  "recommendationType": "treatment",
  "priority": "high",
  "requiresResponse": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendation": {
      "_id": "...",
      "author": {...},
      "content": "Increase exercise intensity...",
      "commentType": "clinical_recommendation",
      "targetType": "patient",
      "targetId": "507f1f77bcf86cd799439011",
      "visibility": "patient_visible",
      "priority": "high",
      "metadata": {
        "category": "treatment_adjustment",
        "recommendationType": "treatment",
        "requiresResponse": true
      },
      "createdAt": "2024-01-15T10:30:00.000Z"
    },
    "notification": {
      "patientNotification": {...},
      "physiotherapistNotification": {...}
    }
  },
  "message": "Recommendation created and notifications sent"
}
```

**Automatic Notifications:**
- Patient receives `recommendation_received` notification
- Assigned physiotherapist receives `recommendation_received` notification
- High priority recommendations are marked as urgent

**Categories:**
- `treatment_adjustment` - Changes to treatment plan
- `exercise_modification` - Exercise regimen changes
- `lifestyle_recommendation` - Lifestyle guidance
- `medication_change` - Medication adjustments
- `specialist_referral` - Referral recommendations
- `precaution` - Safety precautions

---

## Surgery Records

### POST /api/doctors/surgery-records
Create a new surgery record for a patient.

**Authentication:** Required (Doctor only)

**Request Body:**
```json
{
  "patient": "ObjectId (required)",
  "surgeryType": "string (required)",
  "surgeryDate": "ISO 8601 date (required)",
  "diagnosis": "string (required)",
  "procedure": {
    "technique": "string",
    "graftType": "string",
    "duration": "number (minutes)",
    "anesthesiaType": "string"
  },
  "postOpInstructions": "string",
  "expectedRecoveryTime": {
    "weeks": "number",
    "months": "number"
  },
  "notes": "string",
  "complications": ["array of strings"]
}
```

**Example Request:**
```json
{
  "patient": "507f1f77bcf86cd799439011",
  "surgeryType": "ACL Reconstruction",
  "surgeryDate": "2024-01-10T09:00:00.000Z",
  "diagnosis": "Complete ACL tear with associated meniscal damage",
  "procedure": {
    "technique": "Arthroscopic",
    "graftType": "Hamstring autograft",
    "duration": 120,
    "anesthesiaType": "General"
  },
  "postOpInstructions": "Rest for 2 weeks, then start gentle PT. Weight bearing as tolerated with crutches.",
  "expectedRecoveryTime": {
    "weeks": 24
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "surgery": {
      "_id": "...",
      "patient": "507f1f77bcf86cd799439011",
      "performingDoctor": "...",
      "surgeryType": "ACL Reconstruction",
      "surgeryDate": "2024-01-10T09:00:00.000Z",
      "status": "completed",
      "procedure": {...},
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  },
  "message": "Surgery record created successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Missing required fields or invalid data
- `404 Not Found` - Patient not found

---

### GET /api/doctors/surgery-records/:patientId
Get all surgery records for a specific patient.

**Authentication:** Required (Doctor only)

**URL Parameters:**
- `patientId` (required): MongoDB ObjectId of the patient

**Response:**
```json
{
  "success": true,
  "data": {
    "surgeries": [
      {
        "_id": "...",
        "patient": {...},
        "performingDoctor": {...},
        "surgeryType": "ACL Reconstruction",
        "surgeryDate": "2024-01-10T09:00:00.000Z",
        "status": "completed",
        "procedure": {...},
        "createdAt": "2024-01-15T10:30:00.000Z"
      }
    ],
    "totalRecords": 1
  }
}
```

---

### PUT /api/doctors/surgery-records/:recordId
Update an existing surgery record.

**Authentication:** Required (Doctor only - must be performing doctor)

**URL Parameters:**
- `recordId` (required): MongoDB ObjectId of the surgery record

**Request Body:**
```json
{
  "notes": "string",
  "complications": ["array of strings"],
  "status": "scheduled | completed | cancelled",
  "followUpNotes": "string"
}
```

**Example Request:**
```json
{
  "notes": "Patient recovering well. No complications observed.",
  "complications": [],
  "status": "completed",
  "followUpNotes": "Schedule follow-up in 6 weeks"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "surgery": {
      "_id": "...",
      "notes": "Patient recovering well...",
      "complications": [],
      "status": "completed",
      "updatedAt": "2024-01-20T14:30:00.000Z"
    }
  },
  "message": "Surgery record updated successfully"
}
```

**Error Responses:**
- `403 Forbidden` - Not the performing doctor
- `404 Not Found` - Surgery record not found

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
  "error": "Forbidden",
  "message": "Access denied. Doctor role required."
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

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```
