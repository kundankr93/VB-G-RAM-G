const mongoose = require('mongoose');
const iotAlertSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  sensorType: { type: String, required: true },
  workId: { type: mongoose.Schema.Types.ObjectId, ref: 'Work', default: null },
  title: { type: String, required: true, maxlength: 180 },
  message: { type: String, required: true, maxlength: 1000 },
  severity: { type: String, enum: ['low','medium','high','critical'], default: 'medium', index: true },
  status: { type: String, enum: ['open','acknowledged','resolved'], default: 'open', index: true },
  source: { type: String, enum: ['simulation','device'], default: 'simulation' },
  observedValue: { type: mongoose.Schema.Types.Mixed, default: null },
  threshold: { type: mongoose.Schema.Types.Mixed, default: null },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null }
}, { timestamps: true });
iotAlertSchema.index({ status: 1, createdAt: -1 });
module.exports = mongoose.model('IoTAlert', iotAlertSchema);
