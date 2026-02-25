const mongoose = require('mongoose');

const { Schema } = mongoose;

const metadataSchema = new Schema(
  {
    columnCount: { type: Number, required: true, default: 0, min: 0 },
    firstColumn: { type: String, required: true, default: 'A', trim: true },
    lastColumn: { type: String, required: true, default: 'A', trim: true },
    hasData: { type: Boolean, required: true, default: false }
  },
  { _id: false }
);

const extractedLineSchema = new Schema(
  {
    scanId: { type: Schema.Types.ObjectId, ref: 'Scan', required: true, index: true },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    filePath: { type: String, required: true, trim: true },
    folder: { type: String, required: true, trim: true },
    filename: { type: String, required: true, trim: true },
    sheetName: { type: String, required: true, trim: true },
    rowNumber: { type: Number, required: true, min: 1 },
    data: { type: Schema.Types.Mixed, required: true, default: {} },
    display: { type: Schema.Types.Mixed, required: false, default: {} },
    displayColumnNames: { type: Schema.Types.Mixed, required: false, default: {} },
    metadata: { type: metadataSchema, required: true }
  },
  {
    collection: 'extracted_lines',
    minimize: false
  }
);

module.exports = mongoose.model('ExtractedLine', extractedLineSchema);
