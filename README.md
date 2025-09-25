# Rehab Tracker API

A comprehensive multi-role rehabilitation tracking system for patients, physiotherapists, and doctors built with Node.js, Express, and MongoDB.

## 🚀 Features

### Core Functionality
- **Multi-role Authentication**: Secure JWT-based authentication for patients, physiotherapists, and doctors
- **Rehab Task Management**: Create, assign, and track rehabilitation exercises and schedules
- **Progress Tracking**: Detailed session recording with pain assessments, mobility tracking, and performance metrics
- **Real-time Updates**: Socket.io integration for live progress updates and schedule changes
- **Comment System**: Collaborative feedback and notes between healthcare providers and patients
- **File Uploads**: Support for exercise images, progress photos, and documents

### Security & Validation
- **Input Validation**: Comprehensive validation using custom middleware and schemas
- **Rate Limiting**: Protection against API abuse with configurable limits
- **Data Sanitization**: XSS prevention through input sanitization
- **Password Security**: bcrypt hashing with configurable complexity
- **CORS & Security Headers**: Helmet.js integration for enhanced security

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0
- MongoDB >= 5.0

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/CHING-WENLAI1031/Rehab_Tracker.git
   cd Rehab_Tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   # Server Configuration
   PORT=5000
   NODE_ENV=development

   # Database
   MONGODB_URI=mongodb://localhost:27017/rehab_tracker

   # Authentication
   JWT_SECRET=your-super-secure-jwt-secret-key
   JWT_EXPIRES_IN=7d

   # Frontend URL for CORS
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start MongoDB**
   ```bash
   # Using MongoDB Community Edition
   mongod

   # Or using Docker
   docker run -d -p 27017:27017 mongo:latest
   ```

5. **Seed the database (optional)**
   ```bash
   npm run seed
   ```

## 🏃‍♂️ Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "SecurePass123",
  "role": "patient",
  "phoneNumber": "+1234567890",
  "dateOfBirth": "1990-01-15"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "SecurePass123"
}
```

### Rehab Task Endpoints

#### Create Rehab Task
```http
POST /api/patients/rehab-tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Shoulder Strengthening",
  "description": "Daily shoulder strengthening exercises for post-surgery recovery",
  "category": "strength_training",
  "assignedTo": "patient_user_id",
  "instructions": [
    {
      "step": 1,
      "instruction": "Warm up with arm circles for 2 minutes"
    }
  ],
  "schedule": {
    "startDate": "2024-01-15T09:00:00Z",
    "endDate": "2024-02-15T09:00:00Z"
  }
}
```

### Progress Tracking Endpoints

#### Record Progress Session
```http
POST /api/patients/progress
Authorization: Bearer <token>
Content-Type: application/json

{
  "rehabTaskId": "task_id",
  "sessionDuration": 45,
  "completionStatus": "completed",
  "completionPercentage": 100,
  "assessments": {
    "painBefore": 3,
    "painDuring": 2,
    "painAfter": 1,
    "mobilityBefore": 7,
    "mobilityAfter": 8,
    "energyBefore": 6,
    "energyAfter": 5
  }
}
```

## 🧪 Testing

The application includes comprehensive test coverage:

### Test Structure
```
src/test/
├── validation/
│   ├── validators.test.js     # Unit tests for validation utilities
│   ├── schemas.test.js        # Tests for validation schemas
│   └── middleware.test.js     # Tests for validation middleware
├── api/
│   └── integration.test.js    # API integration tests
├── setup.js                   # Test setup and utilities
├── globalSetup.js            # Global test configuration
└── globalTeardown.js         # Global test cleanup
```

### Coverage Report
- **Validators**: 82.81% line coverage
- **Schemas**: 88.54% line coverage
- **Middleware**: Comprehensive validation testing
- **Integration**: API endpoint testing

## 📊 Database Schema

### User Model
```javascript
{
  firstName: String,
  lastName: String,
  email: String (unique),
  password: String (hashed),
  role: ['patient', 'physiotherapist', 'doctor'],
  phoneNumber: String,
  dateOfBirth: Date,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### RehabTask Model
```javascript
{
  title: String,
  description: String,
  category: ['strength_training', 'flexibility', 'balance', ...],
  assignedTo: ObjectId (User),
  assignedBy: ObjectId (User),
  instructions: [{
    step: Number,
    instruction: String
  }],
  schedule: {
    startDate: Date,
    endDate: Date
  },
  status: ['active', 'completed', 'paused'],
  createdAt: Date,
  updatedAt: Date
}
```

### Progress Model
```javascript
{
  user: ObjectId (User),
  rehabTask: ObjectId (RehabTask),
  sessionDate: Date,
  sessionDuration: Number,
  completionStatus: ['completed', 'partially_completed', 'skipped'],
  assessments: {
    painBefore: Number (0-10),
    painDuring: Number (0-10),
    painAfter: Number (0-10),
    mobilityBefore: Number (0-10),
    mobilityAfter: Number (0-10),
    energyBefore: Number (0-10),
    energyAfter: Number (0-10)
  }
}
```

## 🔒 Security Features

### Input Validation
- Email format validation
- Password strength requirements
- ObjectId format validation
- File type and size restrictions
- Rate limiting per IP address

### Authentication & Authorization
- JWT token-based authentication
- Role-based access control
- Password hashing with bcrypt
- Secure session management

## 🏗️ Project Structure

### Current Implementation
```
Rehab_Tracker/
├── src/
│   ├── main/js/
│   │   ├── api/
│   │   │   ├── middleware/       # Validation middleware
│   │   │   └── routes/          # API route handlers
│   │   ├── core/
│   │   │   ├── auth/            # JWT & password utilities
│   │   │   ├── database/        # MongoDB connection
│   │   │   ├── middleware/      # Error handling
│   │   │   └── validation/      # Schemas and validators
│   │   ├── models/              # Mongoose models
│   │   ├── services/            # Business logic
│   │   ├── server.js            # Main server
│   │   └── server-test.js       # Test server
│   └── test/                    # Comprehensive test suite
├── jest.config.js               # Jest configuration
├── package.json                 # Dependencies and scripts
└── README.md                    # This documentation
```

## 🚀 Deployment

### Health Check Endpoint
```http
GET /health
```

Response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure test coverage stays above 70%
5. Run linting and formatting
6. Submit a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For issues or questions, please create an issue on the [GitHub repository](https://github.com/CHING-WENLAI1031/Rehab_Tracker/issues).