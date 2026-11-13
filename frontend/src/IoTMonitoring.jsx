import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, Bell, CheckCircle2, Cpu, Download, FileText, MapPin, Play, RefreshCw, Square, Wifi, WifiOff } from 'lucide-react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const modules = [
  { type: 'water', label: 'Water infrastructure', metrics: ['waterLevel', 'flowRate'], units: ['%', 'L/min'] },
  { type: 'agriculture', label: 'Agriculture', metrics: ['soilMoisture', 'temperature', 'humidity'], units: ['%', '°C', '%'] },
  { type: 'energy', label: 'Electricity & solar', metrics: ['voltage', 'power'], units: ['V', 'W'] },
  { type: 'sanitation', label: 'Sanitation', metrics: ['binFill'], units: ['%'] },
  { type: 'drainage', label: 'Drainage', metrics: ['drainLevel'], units: ['%'] },
  { type: 'weather', label: 'Weather', metrics: ['temperature', 'humidity', 'rainfall'], units: ['°C', '%', 'mm'] },
]
const DEVICE = { deviceId: 'SIM-ESP32-WATER-001', deviceName: 'Virtual ESP32 · Village water tank', sensorType: 'water', workLabel: 'Village drinking-water infrastructure' }
const demoLocation = { state: 'Chhattisgarh', district: 'Demo District', block: 'Demo Block', gramPanchayat: 'Demo Gram Panchayat' }

export default function IoTMonitoring({ session, api }) {
  const [tab, setTab] = useState('overview')
  const [running, setRunning] = useState(false)
  const [readings, setReadings] = useState([])
  const [devices, setDevices] = useState([])
  const [alerts, setAlerts] = useState([])
  const [verification, setVerification] = useState([])
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const levelRef = useRef(72)
  const token = session?.token

  const refresh = useCallback(async () => {
    if (!token) return
    setBusy(true); setError('')
    try {
      const [r,d,a,v,p] = await Promise.all([
        api('/api/iot/readings?limit=100', {}, token), api('/api/iot/devices', {}, token),
        api('/api/iot/alerts', {}, token), api('/api/iot/verification', {}, token), api('/api/iot/report', {}, token),
      ])
      setReadings((r.data || []).slice().reverse()); setDevices(d.data || []); setAlerts(a.data || []); setVerification(v.data || []); setReport(p.data || null)
      const latest = (r.data || [])[0]; if (latest?.waterLevel != null) levelRef.current = latest.waterLevel
    } catch (e) { setError(e.message || 'Unable to load IoT data.') }
    finally { setBusy(false) }
  }, [api, token])
  useEffect(() => { refresh() }, [refresh])

  const sendReading = useCallback(async (sensorType = 'water') => {
    const level = Math.max(5, Math.min(96, levelRef.current + Math.round((Math.random() - .5) * 12)))
    levelRef.current = level
    const metrics = sensorType === 'water' ? { waterLevel: level, flowRate: level < 20 ? 0 : Number((7 + Math.random()*10).toFixed(1)) } :
      sensorType === 'agriculture' ? { soilMoisture: Math.round(15 + Math.random()*70), temperature: Number((22 + Math.random()*15).toFixed(1)), humidity: Math.round(35 + Math.random()*50) } :
      sensorType === 'energy' ? { voltage: Number((210 + Math.random()*25).toFixed(1)), power: Math.round(100 + Math.random()*900) } :
      sensorType === 'sanitation' ? { binFill: Math.round(20 + Math.random()*80) } :
      sensorType === 'drainage' ? { drainLevel: Math.round(10 + Math.random()*90) } :
      { temperature: Number((20 + Math.random()*16).toFixed(1)), humidity: Math.round(35 + Math.random()*55), rainfall: Number((Math.random()*15).toFixed(1)) }
    const deviceId = `SIM-${sensorType.toUpperCase()}-001`
    await api('/api/iot/readings', { method: 'POST', body: JSON.stringify({ deviceId, deviceName: `Virtual ${sensorType} sensor`, sensorType, workLabel: `${sensorType} monitoring · demonstration asset`, location: demoLocation, lat: 21.2514, lng: 81.6296, metrics, waterLevel: sensorType === 'water' ? metrics.waterLevel : undefined, flowRate: sensorType === 'water' ? metrics.flowRate : undefined, pumpOn: sensorType === 'water' ? metrics.flowRate > 0 : undefined, source: 'simulation' }) }, token)
  }, [api, token])

  useEffect(() => {
    if (!running) return undefined
    const timer = window.setInterval(async () => { try { await sendReading('water'); await refresh() } catch (e) { setError(e.message || 'Simulation submission failed.') } }, 5000)
    return () => window.clearInterval(timer)
  }, [running, sendReading, refresh])

  const latest = readings[readings.length - 1]
  const chartData = useMemo(() => readings.slice(-30).map(r => ({ time: new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), level: r.waterLevel ?? r.metrics?.waterLevel ?? null })), [readings])
  const openAlerts = alerts.filter(a => a.status === 'open').length
  const downloadReport = () => { window.print() }
  const resolveAlert = async (id, status) => { try { await api(`/api/iot/alerts/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token); await refresh() } catch (e) { setError(e.message) } }

  return <section className="iot-page">
    <div className="page-heading iot-heading"><div><h1>IoT Ground Monitoring</h1><p>Ground-level sensor monitoring, work verification, alerts and rural development reports.</p></div><div className="iot-actions"><span className={`iot-device-state ${running ? 'online' : 'offline'}`}><span />{running ? 'Simulation running' : 'Simulation stopped'}</span><button className="button secondary" onClick={refresh} disabled={busy}><RefreshCw size={15}/> Refresh</button></div></div>
    <div className="iot-notice"><AlertTriangle size={17}/><span><strong>Demo data:</strong> The virtual devices generate simulated readings. These are not physical field measurements. Physical devices require separately authenticated ingestion.</span></div>
    {error && <div className="iot-error" role="alert">{error}</div>}
    <nav className="iot-tabs" aria-label="IoT sections">{[['overview','Overview'],['devices','Devices & GIS'],['verification','Work verification'],['alerts','Alerts & maintenance'],['reports','Ground-level reports']].map(([id,label]) => <button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}{id==='alerts' && openAlerts>0 ? ` (${openAlerts})`:''}</button>)}</nav>
    {tab==='overview' && <>
      <div className="iot-module-grid">{modules.map(m => <article className="panel iot-module" key={m.type}><div><span className="iot-module-icon"><Activity size={19}/></span><h3>{m.label}</h3></div><p>{m.metrics.join(' · ')}</p><button className="button secondary" onClick={async()=>{try{await sendReading(m.type);await refresh()}catch(e){setError(e.message)}}}>Add simulated reading</button></article>)}</div>
      <div className="iot-actions" style={{margin:'14px 0'}}><button className="button primary" onClick={()=>setRunning(v=>!v)}>{running?<><Square size={15}/> Stop water simulation</>:<><Play size={15}/> Start water simulation</>}</button><span className="iot-muted">Water device sends a reading every 5 seconds.</span></div>
      <div className="iot-kpi-grid"><article className="panel"><span>Registered devices</span><strong>{devices.length}</strong></article><article className="panel"><span>Readings stored</span><strong>{readings.length}</strong></article><article className="panel"><span>Open alerts</span><strong>{openAlerts}</strong></article><article className="panel"><span>Device status</span><strong>{devices.some(d=>d.online)?'Online':'No recent signal'}</strong></article></div>
      <div className="panel iot-chart-panel"><div className="panel-heading"><div><h2>Water tank history</h2><p>Latest stored water-level readings</p></div><Activity size={18}/></div>{chartData.length?<ResponsiveContainer width="100%" height={250}><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="time"/><YAxis domain={[0,100]}/><Tooltip/><Line type="monotone" dataKey="level" name="Water level (%)" stroke="#16865b" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer>:<p className="iot-muted">No readings yet. Start simulation or add a simulated reading.</p>}</div>
    </>}
    {tab==='devices' && <div className="panel iot-table-panel"><div className="panel-heading"><div><h2>Devices and GIS locations</h2><p>Device locations are shown where coordinates have been supplied.</p></div><MapPin size={18}/></div>{devices.length===0?<p className="iot-muted">No registered devices. Add a simulated reading to register a device.</p>:<><div className="iot-device-list">{devices.map(d=><div className="iot-device-row" key={d._id}><div><strong>{d.deviceName}</strong><p>{d._id} · {d.sensorType} · {d.location?.gramPanchayat || 'Location not specified'}</p></div><span className={d.online?'iot-online':'iot-offline'}>{d.online?<Wifi size={14}/>:<WifiOff size={14}/>} {d.online?'Online':'Offline'}</span></div>)}</div><MapContainer center={[21.2514,81.6296]} zoom={6} scrollWheelZoom={false} style={{height:320,width:'100%',borderRadius:12,marginTop:16}}><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{devices.filter(d=>Number.isFinite(d.lat)&&Number.isFinite(d.lng)).map(d=><Marker key={d._id} position={[d.lat,d.lng]}><Popup><strong>{d.deviceName}</strong><br/>{d.sensorType}<br/>{d.online?'Online':'Offline'}</Popup></Marker>)}</MapContainer></>}</div>}
    {tab==='verification' && <div className="panel iot-table-panel"><div className="panel-heading"><div><h2>Development work verification</h2><p>Compare work records with the latest linked sensor observations.</p></div></div>{verification.length===0?<p className="iot-muted">No work records found.</p>:verification.map(v=><div className="iot-verification-row" key={v.work._id}><div><strong>{v.work.name}</strong><p>{v.work.location?.gramPanchayat || 'Village not specified'} · Reported: {v.work.status} · {v.work.actualProgress}%</p><small>{v.observation}</small></div><span className={`iot-flag ${v.flag}`}>{v.flag.replaceAll('_',' ')}</span></div>)}</div>}
    {tab==='alerts' && <div className="panel iot-table-panel"><div className="panel-heading"><div><h2>Automatic alerts and maintenance</h2><p>Threshold alerts created from incoming sensor readings.</p></div><Bell size={18}/></div>{alerts.length===0?<p className="iot-muted">No alerts. Alerts are generated when configured thresholds are crossed.</p>:alerts.map(a=><div className="iot-alert-row" key={a._id}><div><strong>{a.title}</strong><p>{a.message}</p><small>{a.deviceId} · {new Date(a.createdAt).toLocaleString()}</small></div><div className="iot-alert-actions"><span className={`iot-severity ${a.severity}`}>{a.severity}</span>{a.status==='open'&&<button className="button secondary" onClick={()=>resolveAlert(a._id,'acknowledged')}>Acknowledge</button>}{a.status!=='resolved'&&<button className="button secondary" onClick={()=>resolveAlert(a._id,'resolved')}><CheckCircle2 size={14}/> Resolve</button>}</div></div>)}</div>}
    {tab==='reports' && <div className="panel iot-report-panel"><div className="panel-heading"><div><h2>Ground-level monitoring report</h2><p>Summary of stored readings and alerts for the last 30 days.</p></div><button className="button primary" onClick={downloadReport}><Download size={15}/> Print / Save PDF</button></div>{report&&<><div className="iot-kpi-grid"><article><span>Sensor readings</span><strong>{report.readings}</strong></article><article><span>Devices observed</span><strong>{report.deviceCount}</strong></article><article><span>Alerts generated</span><strong>{report.alertCount}</strong></article><article><span>Open alerts</span><strong>{report.openAlerts}</strong></article></div><h3>Category-wise readings</h3>{(report.byType||[]).map(x=><div className="iot-report-line" key={x._id}><span>{x._id}</span><strong>{x.count} readings</strong></div>)}<p className="iot-muted">{report.note}</p><p className="iot-muted">Generated: {new Date(report.generatedAt).toLocaleString()}</p></>}</div>}
  </section>
}
