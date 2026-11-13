const express = require('express');
const mongoose = require('mongoose');
const SensorReading = require('../models/SensorReading');
const IoTAlert = require('../models/IoTAlert');
const Work = require('../models/Work');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
const TYPES = ['water','agriculture','energy','sanitation','weather','drainage'];
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function alertFor(reading) {
  const m = reading.metrics || {};
  const checks = [];
  if (reading.sensorType === 'water') {
    const level = finite(m.waterLevel) ? m.waterLevel : reading.waterLevel;
    if (finite(level) && level < 20) checks.push(['Low water level', `Tank level is ${level}% (configured alert threshold: 20%).`, 'high', level, 20]);
    const flow = finite(m.flowRate) ? m.flowRate : reading.flowRate;
    if (finite(flow) && flow === 0) checks.push(['No water flow detected', 'No flow was reported in the latest reading. Field inspection may be required.', 'medium', flow, '> 0']);
  }
  if (reading.sensorType === 'agriculture' && finite(m.soilMoisture) && m.soilMoisture < 25) checks.push(['Low soil moisture', `Soil moisture is ${m.soilMoisture}% (demo threshold: 25%).`, 'medium', m.soilMoisture, 25]);
  if (reading.sensorType === 'sanitation' && finite(m.binFill) && m.binFill >= 90) checks.push(['Waste bin nearly full', `Bin fill is ${m.binFill}% (threshold: 90%).`, 'high', m.binFill, 90]);
  if (reading.sensorType === 'drainage' && finite(m.drainLevel) && m.drainLevel >= 80) checks.push(['High drainage level', `Drain level is ${m.drainLevel}% (threshold: 80%).`, 'high', m.drainLevel, 80]);
  return checks;
}

router.get('/readings', async (req, res, next) => {
  try {
    const limit = Math.min(200, Math.max(1, Number.parseInt(req.query.limit, 10) || 60));
    const filter = {};
    if (req.query.deviceId) filter.deviceId = String(req.query.deviceId).slice(0,100);
    if (req.query.sensorType && TYPES.includes(req.query.sensorType)) filter.sensorType = req.query.sensorType;
    const data = await SensorReading.find(filter).sort({ recordedAt: -1 }).limit(limit).populate('workId','name status actualProgress location').lean();
    res.json({ data });
  } catch (e) { next(e); }
});

router.get('/devices', async (req, res, next) => {
  try {
    const rows = await SensorReading.aggregate([
      { $sort: { recordedAt: -1 } },
      { $group: { _id: '$deviceId', deviceName: { $first: '$deviceName' }, sensorType: { $first: '$sensorType' }, lat: { $first: '$lat' }, lng: { $first: '$lng' }, location: { $first: '$location' }, workId: { $first: '$workId' }, source: { $first: '$source' }, lastSeen: { $first: '$recordedAt' }, metrics: { $first: '$metrics' }, waterLevel: { $first: '$waterLevel' }, flowRate: { $first: '$flowRate' }, pumpOn: { $first: '$pumpOn' } } },
      { $sort: { lastSeen: -1 } }
    ]);
    const now = Date.now();
    res.json({ data: rows.map(d => ({ ...d, online: now - new Date(d.lastSeen).getTime() < 120000 })) });
  } catch (e) { next(e); }
});

router.post('/readings', async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.deviceId || typeof b.deviceId !== 'string' || b.deviceId.length > 100) return res.status(400).json({ message: 'A valid deviceId is required.' });
    if (!TYPES.includes(b.sensorType || 'water')) return res.status(400).json({ message: 'Unsupported sensorType.' });
    if (b.source && b.source !== 'simulation') return res.status(400).json({ message: 'This authenticated demo endpoint accepts simulation readings only. Physical devices require separate device authentication.' });
    if (b.workId && !mongoose.isValidObjectId(b.workId)) return res.status(400).json({ message: 'workId must be a valid ID.' });
    const metrics = b.metrics && typeof b.metrics === 'object' && !Array.isArray(b.metrics) ? b.metrics : {};
    for (const [k,v] of Object.entries(metrics)) if (!/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(k) || !finite(v)) return res.status(400).json({ message: 'metrics must contain simple keys and finite numeric values.' });
    const reading = await SensorReading.create({
      deviceId: b.deviceId.trim(), deviceName: String(b.deviceName || b.deviceId).slice(0,160), sensorType: b.sensorType || 'water',
      workId: b.workId || null, workLabel: String(b.workLabel || '').slice(0,200), location: b.location || {},
      lat: finite(b.lat) ? b.lat : null, lng: finite(b.lng) ? b.lng : null, metrics,
      waterLevel: finite(b.waterLevel) ? b.waterLevel : (finite(metrics.waterLevel) ? metrics.waterLevel : null),
      flowRate: finite(b.flowRate) ? b.flowRate : (finite(metrics.flowRate) ? metrics.flowRate : null),
      pumpOn: typeof b.pumpOn === 'boolean' ? b.pumpOn : null, source: 'simulation', recordedAt: b.recordedAt ? new Date(b.recordedAt) : new Date()
    });
    const alerts = alertFor(reading);
    for (const a of alerts) {
      const recent = await IoTAlert.findOne({ deviceId: reading.deviceId, title: a[0], status: 'open', createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) } });
      if (!recent) await IoTAlert.create({ deviceId: reading.deviceId, sensorType: reading.sensorType, workId: reading.workId, title: a[0], message: a[1], severity: a[2], observedValue: a[3], threshold: a[4], source: 'simulation' });
    }
    res.status(201).json({ data: reading, alertsGenerated: alerts.length });
  } catch (e) { next(e); }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const filter = {};
    if (['open','acknowledged','resolved'].includes(req.query.status)) filter.status = req.query.status;
    const data = await IoTAlert.find(filter).sort({ createdAt: -1 }).limit(150).populate('workId','name status').lean();
    res.json({ data });
  } catch (e) { next(e); }
});
router.patch('/alerts/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid alert ID.' });
    if (!['acknowledged','resolved'].includes(req.body?.status)) return res.status(400).json({ message: 'status must be acknowledged or resolved.' });
    const alert = await IoTAlert.findByIdAndUpdate(req.params.id, { status: req.body.status, ...(req.body.status === 'resolved' ? { resolvedAt: new Date() } : {}) }, { new: true });
    if (!alert) return res.status(404).json({ message: 'Alert not found.' });
    res.json({ data: alert });
  } catch (e) { next(e); }
});

router.get('/verification', async (req, res, next) => {
  try {
    const works = await Work.find({}).sort({ updatedAt: -1 }).limit(200).select('name status actualProgress plannedProgress location lat lng').lean();
    const data = await Promise.all(works.map(async work => {
      const latest = await SensorReading.findOne({ workId: work._id }).sort({ recordedAt: -1 }).lean();
      let observation = 'No linked sensor readings'; let flag = 'unmonitored';
      if (latest) {
        const m = latest.metrics || {};
        const inactiveWater = latest.sensorType === 'water' && ((finite(m.waterLevel) && m.waterLevel < 5) || (finite(m.flowRate) && m.flowRate === 0));
        observation = inactiveWater ? 'Low/no water activity detected; field inspection recommended' : 'Latest sensor reading received; review operational trend';
        flag = inactiveWater ? 'inspection_required' : 'sensor_data_available';
      }
      return { work, latestReading: latest, observation, flag };
    }));
    res.json({ data });
  } catch (e) { next(e); }
});

router.get('/report', async (req, res, next) => {
  try {
    const since = req.query.since && !Number.isNaN(Date.parse(req.query.since)) ? new Date(req.query.since) : new Date(Date.now() - 30*24*60*60*1000);
    const [readings, devices, alerts, openAlerts, byType] = await Promise.all([
      SensorReading.countDocuments({ recordedAt: { $gte: since } }),
      SensorReading.distinct('deviceId'),
      IoTAlert.countDocuments({ createdAt: { $gte: since } }),
      IoTAlert.countDocuments({ status: 'open' }),
      SensorReading.aggregate([{ $match: { recordedAt: { $gte: since } } }, { $group: { _id: '$sensorType', count: { $sum: 1 }, latest: { $max: '$recordedAt' } } }])
    ]);
    res.json({ data: { generatedAt: new Date(), periodStart: since, periodEnd: new Date(), readings, deviceCount: devices.length, alertCount: alerts, openAlerts, byType, note: 'Report is based on stored readings. Simulation readings are not physical field measurements.' } });
  } catch (e) { next(e); }
});

module.exports = router;
