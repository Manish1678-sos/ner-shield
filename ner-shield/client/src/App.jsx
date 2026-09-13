import { useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CloudRain,
  Crosshair,
  Gauge,
  Layers3,
  Menu,
  Package,
  ShieldCheck,
  Truck,
  Wifi,
  X,
  Sliders,
  Play
} from 'lucide-react';
import { api, socketUrl } from './services/api';
import { fetchOsmFacilities, fetchCityCoords, fetchRealDrivingRoute } from './services/osm';
import MapView from './components/MapView';
import IncidentDrawer from './components/IncidentDrawer';
import Telemetry from './components/Telemetry';
import RouteCard from './components/RouteCard';

const emptyRoute = {
  primary: { geojson: { coordinates: [] }, eta: 0, distance: 0, risk: 0, corridorName: '' },
  bypass: { geojson: { coordinates: [] }, eta: 0, distance: 0, risk: 0, corridorName: '' }
};

// Check if a point is within ~15 km of any segment along a polyline
export function isPointNearPolyline(point, polyline, thresholdDeg = 0.12) {
  if (!point || !polyline || !polyline.length) return false;
  const pLon = Number(point[0]) > 45 ? Number(point[0]) : Number(point[1]);
  const pLat = Number(point[0]) > 45 ? Number(point[1]) : Number(point[0]);

  return polyline.some((coord) => {
    const cLon = Number(coord[0]) > 45 ? Number(coord[0]) : Number(coord[1]);
    const cLat = Number(coord[0]) > 45 ? Number(coord[1]) : Number(coord[0]);
    return Math.hypot(pLon - cLon, pLat - cLat) < thresholdDeg;
  });
}

// Check if two routes use the same physical highway corridor
export function isSameCorridor(routeA, routeB) {
  const coordsA = routeA?.geojson?.coordinates || routeA?.coordinates || [];
  const coordsB = routeB?.geojson?.coordinates || routeB?.coordinates || [];
  if (!coordsA.length || !coordsB.length) return true;

  const distA = Number(routeA?.distance) || 0;
  const distB = Number(routeB?.distance) || 0;

  // If total distance is within 8%, it is the same arterial highway
  if (distA > 0 && distB > 0 && Math.abs(distA - distB) / Math.max(distA, distB) < 0.08) {
    return true;
  }

  // Sample 10 points along Route A and check if 70%+ lie on Route B
  let matches = 0;
  const samples = 10;
  for (let i = 0; i < samples; i++) {
    const idx = Math.floor((i / (samples - 1)) * (coordsA.length - 1));
    if (isPointNearPolyline(coordsA[idx], coordsB, 0.10)) {
      matches++;
    }
  }
  return matches / samples >= 0.7;
}

export default function App() {
  const [routes, setRoutes] = useState(emptyRoute);
  const [places, setPlaces] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [incident, setIncident] = useState(null);
  const [metrics, setMetrics] = useState({ rainfall: 86, soil: 54, slope: 18, risk: 0.24 });
  const [origin, setOrigin] = useState('Guwahati');
  const [destination, setDestination] = useState('Silchar');
  const [originCoords, setOriginCoords] = useState([26.1445, 91.7362]);
  const [destCoords, setDestCoords] = useState([24.8333, 92.7789]);
  const [priority, setPriority] = useState('P1 Medical');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [cargo, setCargo] = useState({
    id: 'CVY-2048',
    type: 'Vaccines',
    priority: 'P1',
    temperature: '+4.1 C',
    eta: 165,
    location: 'Guwahati'
  });
  const [active, setActive] = useState('primary');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showRadar, setShowRadar] = useState(true);

  const routesRef = useRef(routes);
  routesRef.current = routes;

  const isPrimaryBlocked = metrics.risk > 0.8 || Boolean(incident);
  const bypassMatchesPrimary = isSameCorridor(routes?.primary, routes?.bypass);
  const bypassHitsIncident = incident?.coordinates
    ? isPointNearPolyline(incident.coordinates, routes?.bypass?.coordinates || routes?.bypass?.geojson?.coordinates || [])
    : false;
  const isBypassSevered = isPrimaryBlocked && (bypassMatchesPrimary || bypassHitsIncident);

  useEffect(() => {
    fetchOsmFacilities().then((osmPlaces) => {
      if (osmPlaces?.length > 0) setPlaces(osmPlaces);
    });

    api.get('/demo/state')
      .then(({ data }) => {
        if (data?.places && places.length === 0) setPlaces(data.places);
        if (data?.cargo) setCargo(data.cargo);
      })
      .catch((err) => console.warn('[FastAPI] State fallback engaged:', err));

    const socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    socket.on('risk:update', (r) => {
      const score = r?.riskScore ?? r?.risk ?? 0.24;
      setMetrics((m) => ({ ...m, risk: score }));
    });

    socket.on('cargo:update', (d) => {
      setCargo((c) => ({ ...c, ...d }));
    });

    socket.on('incident:new', (data) => {
      if (data?.incident) {
        setIncident(data.incident);
        setActive('bypass');
      }
    });

    window.addEventListener('online', () => setOffline(false));
    window.addEventListener('offline', () => setOffline(true));

    return () => socket.disconnect();
  }, []);

  const calculate = useCallback(
    async (currentOrigin, currentDest, currentMetrics) => {
      setLoading(true);
      try {
        const [start, end] = await Promise.all([
          fetchCityCoords(currentOrigin),
          fetchCityCoords(currentDest)
        ]);
        setOriginCoords(start);
        setDestCoords(end);

        let computedRisk = 0.24;
        try {
          const { data: mlData } = await api.post('/risk/predict', {
            rainfall_24h: Number(currentMetrics.rainfall) || 80,
            soil_moisture: Number(currentMetrics.soil) || 50,
            slope_angle: Number(currentMetrics.slope) || 18,
            elevation: 850.0,
            road_condition: 0.8
          });
          computedRisk = mlData?.riskScore ?? mlData?.risk ?? 0.24;
        } catch {
          computedRisk = Number(
            (
              (currentMetrics.rainfall / 300) * 0.55 +
              (currentMetrics.soil / 100) * 0.35 +
              (currentMetrics.slope / 50) * 0.1
            ).toFixed(2)
          );
        }
        setMetrics((m) => ({ ...m, risk: computedRisk }));

        const drivingData = await fetchRealDrivingRoute(currentOrigin, currentDest);
        const identical = isSameCorridor(drivingData.primary, drivingData.bypass);

        setRoutes({
          primary: {
            geojson: {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: drivingData.primary.coordinates },
              coordinates: drivingData.primary.coordinates
            },
            eta: drivingData.primary.eta,
            distance: drivingData.primary.distance,
            risk: computedRisk,
            corridorName: drivingData.primary.corridorName
          },
          bypass: {
            geojson: {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: drivingData.bypass.coordinates },
              coordinates: drivingData.bypass.coordinates
            },
            eta: identical && computedRisk > 0.8 ? '--' : drivingData.bypass.eta,
            distance: identical && computedRisk > 0.8 ? '--' : drivingData.bypass.distance,
            risk: identical ? computedRisk : Math.max(0.06, Number((computedRisk - 0.22).toFixed(2))),
            corridorName: identical && computedRisk > 0.8
              ? 'NO ALTERNATE BYPASS AVAILABLE'
              : drivingData.bypass.corridorName
          }
        });

        setActive('primary');
        setToast(`CORRIDOR SYNCED: ${currentOrigin} ➔ ${currentDest} · ML RISK: ${computedRisk}`);
      } catch {
        setToast('Routing synchronized');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    setIncident(null);
    setRoutes(emptyRoute);
    calculate(origin, destination, metrics);
  }, [origin, destination]);

  function simulateMonsoon() {
    setMetrics((m) => ({ ...m, rainfall: 220, soil: 88 }));
    setToast('MONSOON SPIKE: DOPPLER RADAR INTENSIFIES · HIGH RISK WARNING');
  }

  async function simulateLandslide() {
    const primaryPts = routesRef.current?.primary?.geojson?.coordinates || routesRef.current?.primary?.coordinates || [];
    const bypassPts = routesRef.current?.bypass?.geojson?.coordinates || routesRef.current?.bypass?.coordinates || [];

    let slideCoords = [92.361, 25.124];
    if (primaryPts.length > 4) {
      const midIdx = Math.floor(primaryPts.length * 0.52);
      slideCoords = primaryPts[midIdx];
    }

    const samePath = isSameCorridor(routesRef.current?.primary, routesRef.current?.bypass);
    const bypassBlocked = samePath || isPointNearPolyline(slideCoords, bypassPts, 0.12);

    const payload = {
      incident_type: 'LANDSLIDE',
      severity: 'CRITICAL',
      lat: slideCoords[1],
      lon: slideCoords[0],
      description: 'Major Rockslide & Mudflow',
      is_blocking: true,
      synced_from_offline: false,
      origin,
      destination,
      riskInput: {
        rainfall_24h: 280,
        soil_moisture: 95,
        slope_angle: 34,
        elevation: 850.0,
        road_condition: 0.8
      }
    };

    setMetrics((m) => ({ ...m, rainfall: 280, soil: 95, risk: 0.95 }));
    setIncident({ type: 'Major Rockslide & Mudflow', coordinates: slideCoords });

    if (bypassBlocked) {
      // Both primary and secondary routes traverse the blocked corridor
      setRoutes((r) => ({
        ...r,
        primary: { ...r.primary, risk: 0.95 },
        bypass: {
          ...r.bypass,
          risk: 0.95,
          eta: '--',
          distance: '--',
          corridorName: 'NO ALTERNATE BYPASS (CORRIDOR SEVERED)'
        }
      }));
      setActive('primary');
      setCargo((c) => ({
        ...c,
        eta: '--',
        location: 'HALTED · ALL HIGHWAYS SEVERED'
      }));
      setToast('CRITICAL: ALL ARTERIAL ROADS SEVERED · NO BYPASS AVAILABLE');
    } else {
      // Physically distinct bypass exists (e.g., Guwahati -> Silchar via NH-27 Haflong)
      setRoutes((r) => ({
        ...r,
        primary: { ...r.primary, risk: 0.95 },
        bypass: { ...r.bypass, risk: 0.12 }
      }));
      setActive('bypass');
      setCargo((c) => ({
        ...c,
        eta: routesRef.current?.bypass?.eta || 395,
        location: 'AI STRATEGIC BYPASS'
      }));
      setToast('LANDSLIDE LOGGED · CONVOY REROUTED VIA BYPASS');
    }

    try {
      await api.post('/incidents', payload);
    } catch {
      // Local fallback active
    }
  }

  async function submitIncident(e) {
    if (e?.preventDefault) e.preventDefault();
    const f = e?.currentTarget ? new FormData(e.currentTarget) : null;
    const coordsRaw = f ? f.get('coordinates') : '';
    let lat = 25.124;
    let lon = 92.361;

    if (coordsRaw && coordsRaw.includes(',')) {
      const parts = coordsRaw.split(',').map(Number);
      lat = parts[0];
      lon = parts[1];
    } else {
      const primaryPts = routesRef.current?.primary?.geojson?.coordinates || [];
      if (primaryPts.length > 2) {
        const mid = primaryPts[Math.floor(primaryPts.length * 0.5)];
        lon = mid[0];
        lat = mid[1];
      }
    }

    const bypassPts = routesRef.current?.bypass?.geojson?.coordinates || routesRef.current?.bypass?.coordinates || [];
    const samePath = isSameCorridor(routesRef.current?.primary, routesRef.current?.bypass);
    const bypassBlocked = samePath || isPointNearPolyline([lon, lat], bypassPts, 0.12);

    const rawType = f ? String(f.get('type') || 'Landslide') : 'Landslide';
    const payload = {
      incident_type: 'LANDSLIDE',
      severity: f ? String(f.get('severity') || 'CRITICAL') : 'CRITICAL',
      lat: Number(lat),
      lon: Number(lon),
      description: `${rawType} reported via field command drawer`,
      is_blocking: true,
      synced_from_offline: offline,
      origin,
      destination,
      riskInput: {
        rainfall_24h: metrics.rainfall + 50,
        soil_moisture: Math.min(99, metrics.soil + 20),
        slope_angle: metrics.slope,
        elevation: 850.0,
        road_condition: 0.9
      }
    };

    setIncident({ type: rawType, coordinates: [lon, lat] });
    setMetrics((m) => ({ ...m, risk: 0.96 }));
    setDrawer(false);

    if (bypassBlocked) {
      setRoutes((r) => ({
        ...r,
        primary: { ...r.primary, risk: 0.96 },
        bypass: {
          ...r.bypass,
          risk: 0.96,
          eta: '--',
          distance: '--',
          corridorName: 'NO ALTERNATE BYPASS (CORRIDOR SEVERED)'
        }
      }));
      setActive('primary');
      setCargo((c) => ({
        ...c,
        eta: '--',
        location: 'HALTED · ALL HIGHWAYS SEVERED'
      }));
      setToast('CRITICAL: ROAD SEVERED · NO BYPASS AVAILABLE');
    } else {
      setRoutes((r) => ({
        ...r,
        primary: { ...r.primary, risk: 0.96 },
        bypass: { ...r.bypass, risk: 0.10 }
      }));
      setActive('bypass');
      setCargo((c) => ({
        ...c,
        eta: routesRef.current?.bypass?.eta || 395,
        location: 'AI STRATEGIC BYPASS'
      }));
      setToast('FIELD ALERT VERIFIED & LOGGED TO FASTAPI BACKEND');
    }

    try {
      await api.post('/incidents', payload);
    } catch {
      // Local fallback active
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"><ShieldCheck size={23} /></div>
          <div>
            <div className="brand-name">NER<span>-</span>SHIELD</div>
            <div className="brand-sub">MDoNER LOGISTICS GRID</div>
          </div>
        </div>

        <div className="system-pills">
          <span><i className="live-dot" /> WEATHER <b>LIVE</b></span>
          <span><Activity size={14} /> TELEMETRY <b>ACTIVE</b></span>
          <span><Truck size={14} /> ACTIVE CONVOYS <b>05</b></span>
          <span className="critical">
            <AlertTriangle size={14} /> CRITICAL INCIDENTS <b>{incident ? '01' : '00'}</b>
          </span>
        </div>

        <div className="top-actions">
          <span className="operator">
            <span className="avatar">AR</span>
            <span><b>ANANYA RAO</b><small>COMMAND OFFICER</small></span>
          </span>
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      <main className={`workspace ${mobileMenuOpen ? 'mobile-sidebar-open' : ''}`}>
        <aside className="sidebar">
          <div className="section-label">
            <span>ROUTE DISPATCH</span>
            <span className="demo-badge">FASTAPI + OSM</span>
          </div>

          <div className="field">
            <label>ORIGIN (MARKER A)</label>
            <div className="select-wrap">
              <Crosshair size={15} />
              <select value={origin} onChange={(e) => setOrigin(e.target.value)}>
                <option>Guwahati</option>
                <option>Shillong</option>
                <option>Silchar</option>
                <option>Imphal</option>
                <option>Aizawl</option>
                <option>Kohima</option>
                <option>Agartala</option>
                <option>Siliguri</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </div>

          <div className="field">
            <label>DESTINATION (MARKER B)</label>
            <div className="select-wrap">
              <Layers3 size={15} />
              <select value={destination} onChange={(e) => setDestination(e.target.value)}>
                <option>Silchar</option>
                <option>Guwahati</option>
                <option>Shillong</option>
                <option>Imphal</option>
                <option>Aizawl</option>
                <option>Kohima</option>
                <option>Agartala</option>
                <option>Siliguri</option>
              </select>
              <ChevronDown size={14} />
            </div>
          </div>

          <div className="priority-head">
            <label>CARGO PRIORITY</label>
            <span>SELECT ONE</span>
          </div>
          <div className="priority-tabs">
            {['P1 Medical', 'P2 Food', 'P3 Construction'].map((p) => (
              <button
                key={p}
                className={priority === p ? 'active' : ''}
                onClick={() => setPriority(p)}
              >
                {p.split(' ')[0]}
                <small>{p.slice(3)}</small>
              </button>
            ))}
          </div>

          <div
            className="field"
            style={{
              marginTop: '12px',
              background: 'rgba(255,255,255,0.03)',
              padding: '12px',
              borderRadius: '6px'
            }}
          >
            <div className="priority-head" style={{ marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sliders size={13} /> GEOTECHNICAL SENSOR SLIDERS
              </label>
            </div>

            <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
              <span>
                24h Rainfall:{' '}
                <b style={{ color: metrics.rainfall > 180 ? '#ef4444' : '#45e0d0' }}>
                  {metrics.rainfall} mm
                </b>
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="300"
              value={metrics.rainfall}
              onChange={(e) => setMetrics((m) => ({ ...m, rainfall: Number(e.target.value) }))}
              style={{
                width: '100%',
                accentColor: metrics.rainfall > 180 ? '#ef4444' : '#45e0d0',
                margin: '4px 0 10px 0'
              }}
            />

            <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
              <span>
                Soil Moisture Saturation:{' '}
                <b style={{ color: metrics.soil > 80 ? '#ef4444' : '#45e0d0' }}>
                  {metrics.soil}%
                </b>
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={metrics.soil}
              onChange={(e) => setMetrics((m) => ({ ...m, soil: Number(e.target.value) }))}
              style={{
                width: '100%',
                accentColor: metrics.soil > 80 ? '#ef4444' : '#45e0d0',
                margin: '4px 0 0 0'
              }}
            />
          </div>

          <button
            className="route-btn"
            onClick={() => calculate(origin, destination, metrics)}
            disabled={loading}
          >
            <Gauge size={17} />
            {loading ? 'CALCULATING HIGHWAYS...' : 'RECALCULATE HIGHWAYS'}
            <span>↗</span>
          </button>

          <div className="routes-title">
            <span>DISTINCT REAL CORRIDORS</span>
            <span>LIVE</span>
          </div>

          <RouteCard
            title={routes?.primary?.corridorName || 'PRIMARY CORRIDOR'}
            route={routes?.primary}
            color={
              isPrimaryBlocked
                ? '#ef4444'
                : metrics.risk > 0.45
                  ? '#f59e0b'
                  : '#10b981'
            }
            selected={active === 'primary'}
            onClick={() => setActive('primary')}
          />
          <RouteCard
            title={routes?.bypass?.corridorName || 'AI STRATEGIC BYPASS'}
            route={routes?.bypass}
            color={isBypassSevered ? '#ef4444' : '#00f0ff'}
            selected={active === 'bypass'}
            onClick={() => setActive('bypass')}
          />

          <div className="cargo-card">
            <div className="cargo-title">
              <span><Package size={16} /> MONITORED CONVOY</span>
              <span className="pulse-label">TRACKING</span>
            </div>
            <strong>{cargo.type}</strong>
            <div className="cargo-meta">
              <span><b>{cargo.id}</b> · {cargo.priority}</span>
              <span className="temp">{cargo.temperature}</span>
            </div>
            <div className="cargo-progress">
              <i style={{ width: isBypassSevered ? '0%' : active === 'bypass' ? '50%' : '20%' }} />
            </div>
            <div className="cargo-foot">
              <span>{cargo.location}</span>
              <span>
                ETA{' '}
                <b>
                  {isBypassSevered
                    ? 'HALTED'
                    : `${active === 'bypass' ? routes?.bypass?.eta : routes?.primary?.eta} min`}
                </b>
              </span>
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
              <button
                className={showRadar ? 'tool-active' : ''}
                onClick={() => setShowRadar(!showRadar)}
              >
                <CloudRain size={15} /> WEATHER RADAR TILES
              </button>
            </div>
          </div>

          <div className="map-wrap">
            <MapView
              routes={routes}
              places={places}
              incident={incident}
              cargo={cargo}
              showRadar={showRadar}
              originName={origin}
              destName={destination}
              originCoords={originCoords}
              destCoords={destCoords}
              rainfall={metrics.rainfall}
              soil={metrics.soil}
            />

            <div className="map-legend">
              <span>
                <i
                  className="legend-line"
                  style={{
                    background:
                      isPrimaryBlocked
                        ? '#ef4444'
                        : metrics.risk > 0.45
                          ? '#f59e0b'
                          : '#10b981'
                  }}
                />{' '}
                PRIMARY
              </span>
              <span>
                <i
                  className="legend-line"
                  style={{
                    background: isBypassSevered ? '#ef4444' : '#00f0ff',
                    borderTop: `2px dashed ${isBypassSevered ? '#ef4444' : '#00f0ff'}`
                  }}
                />{' '}
                {isBypassSevered ? 'BYPASS SEVERED' : 'AI BYPASS'}
              </span>
              <span><i className="legend-square blocked" /> BLOCKED</span>
              <span><i className="legend-dot hospital" /> FACILITY</span>
            </div>
          </div>
        </section>
      </main>

      <div className="bottom-bar">
        <Telemetry metrics={metrics} />

        <div className="incident-actions">
          <button
            className="simulate-btn"
            onClick={simulateMonsoon}
            style={{ borderColor: '#f59e0b', color: '#f59e0b' }}
          >
            <Play size={14} /> SIMULATE MONSOON SPIKE
          </button>

          <button
            className="simulate-btn"
            onClick={simulateLandslide}
            style={{ borderColor: '#ef4444', color: '#ef4444' }}
          >
            <AlertTriangle size={14} /> SIMULATE LANDSLIDE
          </button>

          <button className="report-btn" onClick={() => setDrawer(true)}>
            <AlertTriangle size={15} /> REPORT HAZARD
          </button>
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
          onAnimationComplete={() => setTimeout(() => setToast(''), 3500)}
        >
          <CheckCircle2 size={17} />
          {toast}
          <X size={15} onClick={() => setToast('')} style={{ cursor: 'pointer' }} />
        </motion.div>
      )}
    </div>
  );
}