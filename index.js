/**
 * Main entry for coopxv-extract: loads config and runs the monitoring loop.
 */

const { scanInterval, mongoUri, mongooseOptions } = require('./config/database');
const mongoose = require('mongoose');

mongoose.connect(mongoUri, mongooseOptions).then(() => {
  console.log('MongoDB connected. Service running (scan interval:', scanInterval, 'min).');
  setInterval(() => {
    // Placeholder: periodic scan/export logic can run here
  }, scanInterval * 60 * 1000);
}).catch((err) => {
  console.error('MongoDB connection failed:', err.message);
  process.exit(1);
});
