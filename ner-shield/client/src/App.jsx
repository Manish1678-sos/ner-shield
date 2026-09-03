import { useEffect, useState } from 'react'; 
import { io } from 'socket.io-client'; 
import { AnimatePresence, motion } from 'framer-motion'; 
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, CloudRain, Crosshair, Gauge, Layers3, Menu, Package, ShieldCheck, Truck, Wifi, X, Sliders } from 'lucide-react'; 
import { api, socketUrl } from './services/api'; 
import MapView from './components/MapView'; 
import IncidentDrawer from './components/IncidentDrawer'; 
import Telemetry from './components/Telemetry'; 
import RouteCard from './components/RouteCard';

const demoPlaces = [
  { type: 'hospital', name: 'GMCH Emergency', position: [91.7362, 26.1445] },
  { type: 'hospital', name: 'Silchar Medical College', position: [92.7789, 24.8333] },
  { type: 'warehouse', name: 'NER Relief Depot', position: [91.78, 26.18] },
  { type: 'helipad', name: 'Shillong Helipad', position: [91.9, 25.59] }
]; 

const CITY_COORDS = {
  'Guwahati': [91.7362, 26.1445],
  'Shillong': [91.8933, 25.5788],
  'Silchar': [92.7789, 24.8333],
  'Imphal': [93.9368, 24.8170],
  'Aizawl': [92.7176, 23.7271],
  'Kohima': [94.1086, 25.6751],
  'Agartala': [91.2868, 23.8315],
  'Siliguri': [88.3953, 26.7271]
};

const defaultRouteStructure = {
  primary: { geojson: { coordinates: [] }, eta: 0, distance: 0, risk: 0 },
  bypass: { geojson: { coordinates: [] }, eta: 0, distance: 0, risk: 0 }
};

export default function App() {
  const [routes, setRoutes] = useState(defaultRouteStructure);
  const [places, setPlaces] = useState(demoPlaces);
  const [drawer, setDrawer] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [incident, setIncident] = useState(null);
  const [metrics, setMetrics] = useState({ rainfall: 86, soil: 54, slope: 18, risk: 0.24 });
  const [origin, setOrigin] = useState('Guwahati');
  const [destination, setDestination] = useState('Silchar');
  const [priority, setPriority] = useState('P1 Medical');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [cargo, setCargo] = useState({ id: 'CVY-2048', type: 'Vaccines', priority: 'P1', temperature: '+4.1 C', eta: 165, location: 'Guwahati' });
  const [active, setActive] = useState('primary');

  useEffect(() => {
    api.get('/demo/state')
      .then(({ data }) => {
        if (data?.routes) setRoutes(data.routes);
        if (data?.places) setPlaces(data.places);
        if (data?.cargo) setCargo(data.cargo);
      })
      .catch(() => {});

    const socket = io(socketUrl, { autoConnect: true }); 
    socket.on('route:updated', setRoutes); 
    socket.on('risk:update', r => setMetrics(m => ({ ...m, risk: r?.riskScore || m.risk }))); 
    socket.on('cargo:update', d => setCargo(c => ({ ...c, ...d }))); 

    const online = () => { setOffline(false); syncQueue(); }; 
    const offlineFn = () => setOffline(true); 

    window.addEventListener('online', online);
    window.addEventListener('offline', offlineFn); 

    return () => {
      socket.disconnect();
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offlineFn);
    };
  }, []);

  async function syncQueue() {
    const queue = JSON.parse(localStorage.getItem('ner-queue') || '[]'); 
    for (const item of queue) {
      try {
        await api.post('/incidents', item); 
        localStorage.setItem('ner-queue', JSON.stringify(queue.filter(x => x !== item))); 
        setToast('INCIDENT SYNCED SUCCESSFULLY');
      } catch {
        break;
      }
    }
  }

  async function calculate() {
    setLoading(true);
    try {
      let currentRisk = metrics.risk || 0.24;

      // 1. Try FastAPI risk calculation
      try {
        const mlResponse = await fetch('http://127.0.0.1:8000/predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rainfall_24h: Number(metrics.rainfall) || 80,
            soil_moisture: Number(metrics.soil) || 50,
            slope_angle: Number(metrics.slope) || 15,
            elevation: 1200.0,
            road_condition: 0.8
          })
        });

        if (mlResponse.ok) {
          const mlData = await mlResponse.json();
          if (mlData && typeof mlData.riskScore === 'number') {
            currentRisk = mlData.riskScore;
            setMetrics(m => ({ ...m, risk: currentRisk }));
          }
        }
      } catch (err) {
        console.warn('FastAPI engine offline, fallback active');
      }

      // 2. Safe coordinate route builder
      const start = CITY_COORDS[origin] || CITY_COORDS['Guwahati'];
      const end = CITY_COORDS[destination] || CITY_COORDS['Silchar'];
      const midPrimary = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      const midBypass = [(start[0] + end[0]) / 2 + 0.3, (start[1] + end[1]) / 2 - 0.2];

      const safeFallbackRoute = {
        primary: {
          geojson: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [start, midPrimary, end] },
            coordinates: [start, midPrimary, end]
          },
          eta: 345,
          distance: 218,
          risk: currentRisk
        },
        bypass: {
          geojson: {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [start, midBypass, end] },
            coordinates: [start, midBypass, end]
          },
          eta: 390,
          distance: 242,
          risk: Math.max(0.05, Number((currentRisk - 0.15).toFixed(2)))
        }
      };

      try {
        const { data } = await api.post('/routes/calculate', { origin, destination, priority, metrics });
        if (data && data.primary && data.bypass) {
          setRoutes(data);
        } else {
          setRoutes(safeFallbackRoute);
        }
      } catch {
        setRoutes(safeFallbackRoute);
      }

      setActive('primary');
      setToast(`ROUTE GENERATED · ML RISK: ${currentRisk}`);
    } catch (error) {
      setToast('Calculation complete');
    } finally {
      setLoading(false);
    }
  }

  async function submitIncident(e) {
    if (e && e.preventDefault) e.preventDefault();
    const f = e?.currentTarget ? new FormData(e.currentTarget) : null;
    const coordsRaw = f ? f.get('coordinates') : '92.7789,24.8333';
    const [lng, lat] = (coordsRaw || '92.7789,24.8333').split(',').map(Number);

    const payload = {
      type: f ? f.get('type') : 'Landslide',
      severity: f ? f.get('severity') : 'CRITICAL',
      coordinates: [lng, lat],
      online: !offline,
      riskInput: {
        rainfall_24h: metrics.rainfall + 100,
        soil_moisture: Math.min(98, metrics.soil + 30),
        slope_angle: 32,
        elevation: 400,
        road_condition: 1
      },
      origin,
      destination
    };

    if (offline) {
      const q = JSON.parse(localStorage.getItem('ner-queue') || '[]');
      localStorage.setItem('ner-queue', JSON.stringify([...q, payload]));
      setToast('OFFLINE — INCIDENT QUEUED');
      setIncident(payload);
      setDrawer(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/incidents', payload);
      if (data?.incident) setIncident(data.incident);
      if (data?.routes) setRoutes(data.routes);
      if (data?.risk?.riskScore) {
        setMetrics({
          rainfall: metrics.rainfall + 100,
          soil: Math.min(98, metrics.soil + 30),
          slope: 32,
          risk: data.risk.riskScore
        });
      }
      setCargo(c => ({ ...c, eta: data?.routes?.bypass?.eta || 390, location: 'AI BYPASS ROUTE' }));
      setActive('bypass');
      setToast('INCIDENT VERIFIED · CARGO REROUTED');
      setDrawer(false);
    } catch {
      setToast('Unable to broadcast incident');
    } finally {
      setLoading(false);
    }
  }

  async function simulate() {
    setMetrics({ rainfall: 242, soil: 91, slope: 34, risk: 0.92 });
    setToast('SIMULATION: AI RISK ESCALATING');
    await new Promise(r => setTimeout(r, 900));
    await submitIncident({ preventDefault() {}, currentTarget: null }).catch(() => {});
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={23}/></div>
          <div>
            <div className="brand-name">NER<span>-</span>SHIELD</div>
            <div className="brand-sub">MDoNER LOGISTICS GRID</div>
          </div>
        </div>

        <div className="system-pills">
          <span><i className="live-dot"/> WEATHER <b>LIVE</b></span>
          <span><Activity size={14}/> TELEMETRY <b>ACTIVE</b></span>
          <span><Truck size={14}/> ACTIVE CONVOYS <b>05</b></span>
          <span className="critical">
            <AlertTriangle size={14}/> CRITICAL INCIDENTS <b>{incident ? '01' : '00'}</b>
          </span>
        </div>

        <div className="top-actions">
          <span className="operator">
            <span className="avatar">AR</span>
            <span><b>ANANYA RAO</b><small>COMMAND OFFICER</small></span>
          </span>
          <button className="icon-btn mobile-menu"><Menu size={18}/></button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <div className="section-label">
            <span>ROUTE DISPATCH</span>
            <span className="demo-badge">DEMO DATA</span>
          </div>

          <div className="field">
            <label>ORIGIN</label>
            <div className="select-wrap">
              <Crosshair size={15}/>
              <select value={origin} onChange={e => setOrigin(e.target.value)}>
                <option>Guwahati</option>
                <option>Shillong</option>
                <option>Silchar</option>
                <option>Imphal</option>
                <option>Aizawl</option>
                <option>Kohima</option>
                <option>Agartala</option>
                <option>Siliguri</option>
              </select>
              <ChevronDown size={14}/>
            </div>
          </div>

          <div className="field">
            <label>DESTINATION</label>
            <div className="select-wrap">
              <Layers3 size={15}/>
              <select value={destination} onChange={e => setDestination(e.target.value)}>
                <option>Silchar</option>
                <option>Guwahati</option>
                <option>Shillong</option>
                <option>Imphal</option>
                <option>Aizawl</option>
                <option>Kohima</option>
                <option>Agartala</option>
                <option>Siliguri</option>
              </select>
              <ChevronDown size={14}/>
            </div>
          </div>

          <div className="priority-head">
            <label>CARGO PRIORITY</label>
            <span>SELECT ONE</span>
          </div>
          <div className="priority-tabs">
            {['P1 Medical', 'P2 Food', 'P3 Construction'].map(p => (
              <button key={p} className={priority === p ? 'active' : ''} onClick={() => setPriority(p)}>
                {p.split(' ')[0]}
                <small>{p.slice(3)}</small>
              </button>
            ))}
          </div>

          <div className="field" style={{ marginTop: '12px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '6px' }}>
            <div className="priority-head" style={{ marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sliders size={13}/> LIVE METRICS ADJUST
              </label>
            </div>
            
            <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
              <span>Rainfall: {metrics.rainfall} mm</span>
              <span>Soil: {metrics.soil}%</span>
            </div>
            
            <input 
              type="range" 
              min="0" 
              max="300" 
              value={metrics.rainfall} 
              onChange={e => setMetrics(m => ({ ...m, rainfall: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: '#45e0d0', margin: '4px 0 8px 0' }}
            />

            <input 
              type="range" 
              min="0" 
              max="100" 
              value={metrics.soil} 
              onChange={e => setMetrics(m => ({ ...m, soil: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: '#45e0d0' }}
            />
          </div>

          <button className="route-btn" onClick={calculate} disabled={loading}>
            <Gauge size={17}/>
            {loading ? 'CALCULATING...' : 'CALCULATE SAFE ROUTE'}
            <span>↗</span>
          </button>

          <div className="routes-title">
            <span>AVAILABLE ROUTES</span>
            <span>LIVE</span>
          </div>

          <RouteCard 
            title="PRIMARY ROUTE" 
            route={routes?.primary} 
            color="#ff5a52" 
            selected={active === 'primary'} 
            onClick={() => setActive('primary')}
          />
          <RouteCard 
            title="AI BYPASS ROUTE" 
            route={routes?.bypass} 
            color="#45e0d0" 
            selected={active === 'bypass'} 
            onClick={() => setActive('bypass')}
          />

          <div className="cargo-card">
            <div className="cargo-title">
              <span><Package size={16}/> ACTIVE CARGO</span>
              <span className="pulse-label">TRACKING</span>
            </div>
            <strong>{cargo.type}</strong>
            <div className="cargo-meta">
              <span><b>{cargo.id}</b> · {cargo.priority}</span>
              <span className="temp">{cargo.temperature}</span>
            </div>
            <div className="cargo-progress">
              <i style={{ width: active === 'bypass' ? '36%' : '18%' }}/>
            </div>
            <div className="cargo-foot">
              <span>{cargo.location}</span>
              <span>ETA <b>{cargo.eta} min</b></span>
            </div>
          </div>
        </aside>

        <section className="map-area">
          <div className="map-toolbar">
            <div>
              <span className="eyebrow">NORTH EASTERN REGION</span>
              <h1>Logistics Command Map</h1>
            </div>
            <div className="map-tools">
              <button className="tool-active"><span className="map-dot cyan"/> ROUTE LAYERS</button>
              <button><CloudRain size={15}/> WEATHER RADAR</button>
            </div>
          </div>

          <div className="map-wrap">
            <MapView routes={routes} places={places} incident={incident} cargo={cargo}/>
            
            <div className="map-legend">
              <span><i className="legend-line primary"/> PRIMARY</span>
              <span><i className="legend-line bypass"/> AI BYPASS</span>
              <span><i className="legend-square blocked"/> BLOCKED</span>
              <span><i className="legend-dot hospital"/> FACILITY</span>
            </div>

            <div className="map-status">
              <span><Wifi size={14}/> LIVE NETWORK</span>
              <small>LAST SYNC 14:32:08 IST</small>
            </div>
          </div>
        </section>
      </main>

      <div className="bottom-bar">
        <Telemetry metrics={metrics}/>
        
        <div className="incident-actions">
          <button className="simulate-btn" onClick={simulate}>
            <span className="sim-icon">◉</span> SIMULATE LANDSLIDE
          </button>

          <button className="report-btn" onClick={() => setDrawer(true)}>
            <AlertTriangle size={17}/> REPORT HAZARD
          </button>

          <div className="connectivity">
            <span className={offline ? 'offline-dot' : 'live-dot'}/>
            {offline ? 'OFFLINE MODE' : 'ONLINE · SYNCED'}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {drawer && (
          <IncidentDrawer 
            open={drawer} 
            onClose={() => setDrawer(false)} 
            onSubmit={submitIncident} 
            offline={offline}
          />
        )}
      </AnimatePresence>

      {toast && (
        <motion.div 
          initial={{ y: 30, opacity: 0 }} 
          animate={{ y: 0, opacity: 1 }} 
          className="toast" 
          onAnimationComplete={() => setTimeout(() => setToast(''), 3200)}
        >
          <CheckCircle2 size={17}/>{toast}<X size={15}/>
        </motion.div>
      )}
    </div>
  );
}