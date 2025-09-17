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
- `GET /api/patients/dashboard` - Patient dashboard data
- `GET /api/patients/schedule` - Get rehab schedule
- `POST /api/patients/checkin` - Check-in exercise completion
- `GET /api/patients/progress` - Get progress history
- `POST /api/patients/notes` - Add personal note
- `GET /api/patients/notes` - Get personal notes

### Physiotherapist Endpoints
- `GET /api/physiotherapists/dashboard` - Physiotherapist dashboard
- `GET /api/physiotherapists/patients` - Get assigned patients
- `GET /api/physiotherapists/patients/:id` - Get patient details
- `POST /api/physiotherapists/schedule` - Create rehab schedule
- `PUT /api/physiotherapists/schedule/:id` - Update schedule
- `POST /api/physiotherapists/feedback` - Add patient feedback
- `GET /api/physiotherapists/analytics` - Get analytics data

### Doctor Endpoints
- `GET /api/doctors/dashboard` - Doctor dashboard
- `GET /api/doctors/patients` - Get all patients overview
- `GET /api/doctors/patients/:id/recovery` - Get recovery progress
- `POST /api/doctors/annotations` - Add medical annotation
- `POST /api/doctors/surgery-records` - Add surgery record
- `GET /api/doctors/surgery-records/:id` - Get surgery records
- `PUT /api/doctors/surgery-records/:id` - Update surgery record
- `POST /api/doctors/recommendations` - Add recommendation
- `GET /api/doctors/analytics/overview` - Get analytics overview

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