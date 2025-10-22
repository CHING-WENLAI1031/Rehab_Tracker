const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables
dotenv.config();

// Import core modules
const { connectDatabase } = require('./core/database/connection');
const errorHandler = require('./core/middleware/errorHandler');
const authRoutes = require('./api/routes/auth');
const patientRoutes = require('./api/routes/patients');
const physiotherapistRoutes = require('./api/routes/physiotherapists');
const doctorRoutes = require('./api/routes/doctors');
const commentRoutes = require('./api/routes/comments');
const notificationRoutes = require('./api/routes/notifications');
const NotificationService = require('./services/NotificationService');
const CommentService = require('./services/CommentService');
const AccessControlService = require('./services/AccessControlService');
const { securityHeaders, roleBasedRateLimit } = require('./api/middleware/enhancedSecurityMiddleware');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware Configuration
app.use(helmet()); // Security headers
app.use(securityHeaders()); // Enhanced security headers
app.use(compression()); // Gzip compression
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);
app.use('/api/', roleBasedRateLimit()); // Role-based rate limiting

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/physiotherapists', physiotherapistRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);

// Socket.io for real-time features
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room based on user role/ID for targeted updates
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
  });

  // Handle progress updates
  socket.on('progress-update', (data) => {
    socket.to(data.room).emit('progress-updated', data);
  });

  // Handle schedule changes
  socket.on('schedule-change', (data) => {
    socket.to(data.room).emit('schedule-changed', data);
  });

  // Handle comment updates
  socket.on('comment-added', (data) => {
    socket.to(data.room).emit('comment-updated', data);
  });

  socket.on('comment-reaction', (data) => {
    socket.to(data.room).emit('reaction-updated', data);
  });

  socket.on('comment-reply', (data) => {
    socket.to(data.room).emit('reply-added', data);
  });

  // Handle notification events
  socket.on('notification-read', (data) => {
    socket.to(data.room).emit('notification-status-changed', data);
  });

  socket.on('notification-dismissed', (data) => {
    socket.to(data.room).emit('notification-status-changed', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Initialize services
const notificationService = new NotificationService(io);
const commentService = CommentService;
const accessControlService = new AccessControlService();

// Connect services
commentService.setNotificationService(notificationService);

// Make services available to routes
app.set('io', io);
app.set('notificationService', notificationService);
app.set('commentService', commentService);
app.set('accessControlService', accessControlService);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use(errorHandler);

// Database connection and server startup
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    console.log('📄 Database connected successfully');

    // Start server
    server.listen(PORT, () => {
      console.log(`
🚀 Rehab Tracker Server Running
📍 Port: ${PORT}
🌍 Environment: ${NODE_ENV}
🔗 Health Check: http://localhost:${PORT}/health
📡 API Base: http://localhost:${PORT}/api
      `);
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// Start the server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;