const mongoose = require('mongoose');

/**
 * Connect to MongoDB database
 * @returns {Promise} Database connection promise
 */
const connectDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/rehab_tracker';

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4 // Use IPv4, skip trying IPv6
    };

    const connection = await mongoose.connect(mongoUri, options);

    // Connection event listeners
    mongoose.connection.on('connected', () => {
      console.log('✅ Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️  Mongoose disconnected from MongoDB');
    });

    // If the Node process ends, close the Mongoose connection
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('Mongoose connection closed through app termination');
        process.exit(0);
      } catch (error) {
        console.error('Error closing mongoose connection:', error);
        process.exit(1);
      }
    });

    return connection;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

/**
 * Close database connection
 * @returns {Promise} Promise that resolves when connection is closed
 */
const closeDatabase = async () => {
  try {
    await mongoose.connection.close();
    console.log('Database connection closed successfully');
  } catch (error) {
    console.error('Error closing database connection:', error);
    throw error;
  }
};

/**
 * Check if database is connected
 * @returns {boolean} Connection status
 */
const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

module.exports = {
  connectDatabase,
  closeDatabase,
  isConnected
};