const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const dotenv = require('dotenv');
const http = require('http');

// Load environment variables
dotenv.config();

// Import middleware and routes (without database dependency)
const errorHandler = require('./core/middleware/errorHandler');
const authRoutes = require('./api/routes/auth');
const patientRoutes = require('./api/routes/patients');
const physiotherapistRoutes = require('./api/routes/physiotherapists');
const doctorRoutes = require('./api/routes/doctors');

const app = express();
const server = http.createServer(app);

// Middleware Configuration
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    database: 'Not connected (test mode)'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/physiotherapists', physiotherapistRoutes);
app.use('/api/doctors', doctorRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`
🚀 Rehab Tracker Test Server Running
📍 Port: ${PORT}
🌍 Environment: test
🔗 Health Check: http://localhost:${PORT}/health
📡 API Base: http://localhost:${PORT}/api
⚠️  Database: Not connected (test mode)
  `);
});

module.exports = app;