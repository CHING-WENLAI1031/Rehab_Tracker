# Rehab Tracker API Documentation

## Overview
The Rehab Tracker API provides endpoints for a multi-role rehabilitation tracking system supporting patients, physiotherapists, and doctors.

## Base URL
```
Development: http://localhost:5000/api
Production: TBD
```

## Authentication
All protected endpoints require JWT authentication via Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Response Format
All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

## Rate Limiting
- 100 requests per 15 minutes per IP address
- Rate limit headers included in response

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh JWT token

### Patient Endpoints
**[View Detailed Patient API Documentation](./patients.md)**

Summary of key endpoints:
- `GET /api/patients/dashboard` - Comprehensive dashboard with analytics
- `GET /api/patients/tasks` - Get rehab tasks
- `GET /api/patients/tasks/:taskId` - Get specific task details
- `GET /api/patients/upcoming` - Get upcoming tasks
- `POST /api/patients/tasks/:taskId/notes` - Add task notes
- `POST /api/patients/notes` - Add personal note/reflection
- `GET /api/patients/notes` - Get personal notes with pagination
- `POST /api/patients/progress` - Record exercise session
- `GET /api/patients/progress` - Get progress history
- `GET /api/patients/analytics` - Get progress analytics
- `GET /api/patients/providers` - Get assigned providers

### Physiotherapist Endpoints
**[View Detailed Physiotherapist API Documentation](./physiotherapists.md)**

Summary of key endpoints:
- `GET /api/physiotherapists/dashboard` - Physiotherapist dashboard
- `GET /api/physiotherapists/patients` - Get assigned patients list
- `GET /api/physiotherapists/patients/:patientId` - Get patient details with analytics
- `POST /api/physiotherapists/feedback` - Provide patient feedback
- `POST /api/physiotherapists/schedule` - Create rehab schedule
- `PUT /api/physiotherapists/schedule/:id` - Update schedule
- `GET /api/physiotherapists/analytics` - Get analytics data

### Doctor Endpoints
**[View Detailed Doctor API Documentation](./doctors.md)**

Summary of key endpoints:
- `GET /api/doctors/dashboard` - Doctor dashboard with overview
- `GET /api/doctors/patients` - Get all patients overview
- `GET /api/doctors/patients/:patientId/recovery` - Get patient recovery progress
- `POST /api/doctors/annotations` - Add medical annotation
- `POST /api/doctors/surgery-records` - Create surgery record
- `GET /api/doctors/surgery-records/:patientId` - Get patient surgery records
- `PUT /api/doctors/surgery-records/:recordId` - Update surgery record
- `POST /api/doctors/recommendations` - Create clinical recommendation
- `GET /api/doctors/analytics/overview` - Get comprehensive analytics

### Notification Endpoints
**[View Detailed Notification API Documentation](./notifications.md)** *(Coming Soon)*

Summary of key endpoints:
- `GET /api/notifications` - Get user notifications with pagination
- `GET /api/notifications/unread-count` - Get unread notification count
- `GET /api/notifications/statistics` - Get notification statistics
- `PUT /api/notifications/:notificationId/read` - Mark notification as read
- `PUT /api/notifications/mark-all-read` - Mark all notifications as read
- `DELETE /api/notifications/:notificationId` - Dismiss notification

### Comment System Endpoints
- `POST /api/comments` - Create comment
- `GET /api/comments/:targetType/:targetId` - Get threaded comments
- `GET /api/comments/:commentId` - Get specific comment
- `PUT /api/comments/:commentId` - Edit comment
- `DELETE /api/comments/:commentId` - Delete comment
- `POST /api/comments/:commentId/reply` - Reply to comment
- `POST /api/comments/:commentId/reactions` - Add reaction
- `DELETE /api/comments/:commentId/reactions` - Remove reaction
- `POST /api/comments/:commentId/read` - Mark comment as read
- `GET /api/comments/unread` - Get unread comments
- `GET /api/comments/search` - Search comments
- `PUT /api/comments/:commentId/resolve` - Resolve comment

## Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Data Models
Detailed data models will be documented once implemented.

## Real-time Features
Socket.io integration for:
- Progress updates
- Schedule changes
- Real-time notifications

## Testing
Use the health check endpoint to verify API status:
```
GET /health
```