const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartpresence';
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI is not set in .env. Attempting fallback: mongodb://127.0.0.1:27017/smartpresence');
    console.warn('👉 Please set MONGODB_URI in server/.env with your MongoDB Atlas or local connection string.');
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    throw error;
  }
};

module.exports = connectDB;
