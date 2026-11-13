const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, trim: true, maxlength: 100, index: true },
  deviceName: { type: String, required: true, trim: true, maxlength: 160 },
  sensorType: { type: String, required: true, enum: ['water','agriculture','energy','sanitation','weather','drainage'], default: 'water', index: true },
  workId: { type: mongoose.Schema.Types.ObjectId, ref: 'Work', default: null, index: true },
  workLabel: { type: String, trim: true, maxlength: 200, default: '' },
  location: { state: {type:String,default:''}, district:{type:String,default:''}, block:{type:String,default:''}, gramPanchayat:{type:String,default:''} },
  lat: { type: Number, min: -90, max: 90, default: null },
  lng: { type: Number, min: -180, max: 180, default: null },
  metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
  waterLevel: { type: Number, min: 0, max: 100, default: null },
  flowRate: { type: Number, min: 0, max: 500, default: null },
  pumpOn: { type: Boolean, default: null },
  source: { type: String, enum: ['simulation','device'], default: 'simulation', index: true },
  recordedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true, strict: true });

sensorReadingSchema.index({ deviceId: 1, recordedAt: -1 });
sensorReadingSchema.index({ sensorType: 1, recordedAt: -1 });
module.exports = mongoose.model('SensorReading', sensorReadingSchema);
