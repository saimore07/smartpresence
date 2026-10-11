require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');

const os = require('os');

const PORT = process.env.PORT || 5000;

const getNetworkIp = () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
};

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Start Express server on all network interfaces
    app.listen(PORT, '0.0.0.0', () => {
      const networkIp = getNetworkIp();
      console.log(`\n🚀 SmartPresence Server running on port ${PORT}`);
      console.log(`📡 Local API: http://localhost:${PORT}/api`);
      console.log(`📡 Network API: http://${networkIp}:${PORT}/api`);
      console.log(`❤️  Health: http://localhost:${PORT}/api/health\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
