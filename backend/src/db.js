const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Never log the connection string: it contains the database password.
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'ChromaCode',
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(`Connected to database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
