# Development Setup Guide

## Prerequisites
- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- MongoDB 5.0 or higher
- Git

## Quick Start

### 1. Clone Repository
```bash
git clone git@github.com:CHING-WENLAI1031/Rehab_Tracker.git
cd Rehab_Tracker
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 4. Database Setup
Ensure MongoDB is running on your system:
```bash
# Start MongoDB (varies by installation)
brew services start mongodb/brew/mongodb-community
# OR
sudo systemctl start mongod
```

### 5. Start Development Server
```bash
npm run dev
```

The server will start on `http://localhost:5000`

## Available Scripts

### Development
```bash
npm run dev          # Start development server with nodemon
npm start           # Start production server
npm run lint        # Run ESLint
npm run lint:fix    # Fix ESLint issues
npm run format      # Format code with Prettier
```

### Testing
```bash
npm test           # Run tests
npm run test:watch # Run tests in watch mode
```

### Database
```bash
npm run seed       # Seed database with sample data (when implemented)
```

## Project Structure
```
Rehab_Tracker/
├── src/main/js/              # Main application code
│   ├── api/                  # API routes and middleware
│   │   ├── routes/           # Express routes
│   │   └── middleware/       # Custom middleware
│   ├── core/                 # Core application logic
│   │   ├── auth/             # Authentication logic
│   │   ├── database/         # Database configuration
│   │   └── middleware/       # Global middleware
│   ├── models/               # Database models
│   ├── services/             # Business logic services
│   ├── utils/                # Utility functions
│   └── server.js             # Main server file
├── src/test/                 # Test files
├── docs/                     # Documentation
├── output/                   # Generated files
└── logs/                     # Log files
```

## Environment Variables

### Required
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret

### Optional
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS

## Development Workflow

1. **Follow CLAUDE.md Rules**
   - Read CLAUDE.md before starting any task
   - Use proper module structure
   - Search before creating new files

2. **Code Style**
   - Use ESLint and Prettier configurations
   - Follow Airbnb JavaScript style guide
   - Use meaningful variable names

3. **Git Workflow**
   - Commit after each completed feature
   - Use descriptive commit messages
   - Push to GitHub after each commit

4. **Testing**
   - Write tests for new features
   - Ensure all tests pass before committing

## API Testing

### Health Check
```bash
curl http://localhost:5000/health
```

### Test Authentication Endpoints
```bash
# Register (when implemented)
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password","role":"patient"}'

# Login (when implemented)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

## Debugging

### Server Logs
Development logs are output to console with Morgan middleware.

### Database Connection
Check MongoDB connection in server startup logs.

### Common Issues

1. **Port Already in Use**
   ```bash
   # Find and kill process using port 5000
   lsof -ti:5000 | xargs kill -9
   ```

2. **MongoDB Connection Failed**
   - Ensure MongoDB is running
   - Check MONGODB_URI in .env
   - Verify database permissions

3. **Module Not Found Errors**
   ```bash
   # Clear node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

## Next Steps
Once Phase 1 is complete, proceed to:
1. Phase 2: Core API Development
2. Phase 3: Role-Specific Features
3. Phase 4: Calendar & UI Components
4. Phase 5: Advanced Features & Polish