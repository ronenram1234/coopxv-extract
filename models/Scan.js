const mongoose = require('mongoose');

const { Schema } = mongoose;

const fileProcessedSchema = new Schema(
  {
    folder: { type: String, required: true, trim: true },
    filename: { type: String, required: true, trim: true },
    fullPath: { type: String, required: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: ['success', 'error', 'no_data'],
      index: true
    },
    rowsExtracted: { type: Number, required: true, default: 0, min: 0 },
    error: { type: String, default: null }
  },
  { _id: false }
);

const statisticsSchema = new Schema(
  {
    totalFiles: { type: Number, required: true, default: 0, min: 0 },
    successfulFiles: { type: Number, required: true, default: 0, min: 0 },
    errorFiles: { type: Number, required: true, default: 0, min: 0 },
    fieldNamesFound: { type: Number, required: true, default: 0, min: 0 },
    lastRowsFound: { type: Number, required: true, default: 0, min: 0 }
  },
  { _id: false }
);

const scanSchema = new Schema(
  {
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    scanNumber: { type: Number, required: true, index: true },
    environment: { type: String, required: true, trim: true },
    statistics: { type: statisticsSchema, required: true },
    filesProcessed: { type: [fileProcessedSchema], required: true, default: [] },
    duration: { type: Number, required: true, default: 0, min: 0 }
  },
  {
    collection: 'scans',
    minimize: false
  }
);

module.exports = mongoose.model('Scan', scanSchema);
