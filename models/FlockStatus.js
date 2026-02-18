const mongoose = require('mongoose');

const { Schema } = mongoose;

const flockStatusSchema = new Schema(
  {
    filename: { type: String, required: true, unique: true, trim: true, index: true },
    filePath: { type: String, required: true, trim: true },
    folder: { type: String, required: true, trim: true },
    sheetName: { type: String, required: true, trim: true, default: 'BData_in' },

    // Flock status derived from Column A values
    flockStatus: {
      type: String,
      required: true,
      enum: ['active', 'maintenance', 'closed'],
      default: 'active',
      index: true
    },

    // Column A tracking
    lastColumnAValue: { type: String, default: null },
    hasActiveRows: { type: Boolean, default: false },
    hasMaintenanceRows: { type: Boolean, default: false },
    activeRowCount: { type: Number, default: 0 },

    // Timestamps for status transitions
    lastActiveAt: { type: Date, default: null },
    lastMaintenanceAt: { type: Date, default: null },
    statusChangedAt: { type: Date, default: Date.now },

    // Last scan info
    lastScanNumber: { type: Number, default: 0 },
    lastScanAt: { type: Date, default: null }
  },
  {
    collection: 'flock_status',
    timestamps: true,
    minimize: false
  }
);

module.exports = mongoose.model('FlockStatus', flockStatusSchema);
