import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createPinIcon = (emoji, color) => 
  L.divIcon({
    className: 'map-custom-pin',
    html: `<div style="
      background: ${color};
      width: 30px;
      height: 30px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0f172a;
      font-weight: bold;
      font-size: 13px;
      border: 2px solid #ffffff;
      box-shadow: 0 0 10px rgba(0,0,0,0.5);
    ">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

const extractLatLng = (routeObj) => {
  if (!routeObj) return [];
  let rawCoords = [];
  if (Array.isArray(routeObj?.geojson?.geometry?.coordinates)) {
    rawCoords = routeObj.geojson.geometry.coordinates;
  } else if (Array.isArray(routeObj?.geojson?.coordinates)) {
    rawCoords = routeObj.geojson.coordinates;
  } else if (Array.isArray(routeObj?.coordinates)) {
    rawCoords = routeObj.coordinates;
  }
  
  return rawCoords.map((pt) => {
    if (Array.isArray(pt) && pt.length >= 2) {
      return [Number(pt[1]), Number(pt[0])];
    }
    return null;
  }).filter(pt => pt && !isNaN(pt[0]) && !isNaN(pt[1]));
};

function FitBounds({ primaryPath, bypassPath }) {
  const map = useMap();
  useEffect(() => {
    try {
      map.invalidateSize();
      const combined = [...primaryPath, ...bypassPath];
      if (combined.length > 0) {
        map.fitBounds(combined, { padding: [40, 40], maxZoom: 8 });
      }
    } catch (e) {}
  }, [primaryPath, bypassPath, map]);

  return null;
}

export default function MapView({ routes, places, incident, cargo, showRadar }) {
  const [radarPath, setRadarPath] = useState(null);
  
  const primaryRouteCoords = extractLatLng(routes?.primary);
  const bypassRouteCoords = extractLatLng(routes?.bypass);
  const defaultCenter = primaryRouteCoords.length > 0 ? primaryRouteCoords[0] : [26.1445, 91.7362];

  const riskStatus = (routes?.primary?.risk > 0.7 || incident) ? 'BLOCKED' : 'NORMAL';

  useEffect(() => {
    if (showRadar) {
      fetch('https://api.rainviewer.com/public/weather-maps.json')
        .then((res) => res.json())
        .then((data) => {
          if (data && data.radar && data.radar.past && data.radar.past.length > 0) {
            const latestFrame = data.radar.past[data.radar.past.length - 1];
            setRadarPath(latestFrame.path);
          }
        })
        .catch((err) => console.error('Error loading weather radar tile path:', err));
    }
  }, [showRadar]);

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', minHeight: '350px' }}>
      <MapContainer 
        center={defaultCenter} 
        zoom={7} 
        maxZoom={10}
        minZoom={5}
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
      >
        <TileLayer 
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

  {showRadar && radarPath && (
  <TileLayer
    attribution='&copy; <a href="https://www.rainviewer.com/">RainViewer</a>'
    url={`https://tilecache.rainviewer.com${radarPath}/256/{z}/{x}/{y}/2/2_1.png`}
    opacity={0.85}
    zIndex={500}
    maxNativeZoom={7}
    errorTileUrl=""
  />
)}

        <FitBounds primaryPath={primaryRouteCoords} bypassPath={bypassRouteCoords} />

        {primaryRouteCoords.length > 0 && (
          <Polyline 
            positions={primaryRouteCoords} 
            pathOptions={{ 
              color: riskStatus === 'BLOCKED' ? '#ef4444' : '#3b82f6', 
              dashArray: riskStatus === 'BLOCKED' ? '5, 10' : null,
              opacity: riskStatus === 'BLOCKED' ? 0.4 : 0.8,
              weight: 4 
            }} 
          />
        )}

        {bypassRouteCoords.length > 0 && (
          <Polyline 
            positions={bypassRouteCoords} 
            pathOptions={{ 
              color: '#06b6d4', 
              weight: riskStatus === 'BLOCKED' ? 6 : 4,
              opacity: 0.9 
            }} 
          />
        )}

        {Array.isArray(places) && places.map((p, idx) => {
          if (!p?.position || p.position.length < 2) return null;
          const latLng = [p.position[1], p.position[0]];
          const symbol = p.type === 'hospital' ? '✚' : p.type === 'warehouse' ? '▣' : '◈';
          const color = p.type === 'hospital' ? '#ffce56' : p.type === 'warehouse' ? '#65d6ff' : '#c990ff';

          return (
            <Marker key={p.name || idx} position={latLng} icon={createPinIcon(symbol, color)}>
              <Popup>
                <strong>{p.name}</strong>
                <br />
                <small>Type: {String(p.type).toUpperCase()}</small>
              </Popup>
            </Marker>
          );
        })}

        {incident && Array.isArray(incident.coordinates) && incident.coordinates.length >= 2 && (
          <Marker 
            position={[incident.coordinates[1], incident.coordinates[0]]} 
            icon={createPinIcon('!', '#ff5a52')}
          >
            <Popup>
              <strong style={{ color: '#ff5a52' }}>BLOCKAGE ALERT</strong>
              <br />
              {incident.type || 'Hazard Detected'}
            </Popup>
          </Marker>
        )}

        {cargo && primaryRouteCoords.length > 0 && (
          <Marker 
            position={primaryRouteCoords[0]} 
            icon={createPinIcon('▰', '#f6c453')}
          >
            <Popup>
              <strong>{cargo.id}</strong>
              <br />
              Cargo: {cargo.type} ({cargo.priority})
            </Popup>
          </Marker>
        )}

        {/* Weather Intensity Legend Indicator */}
        {showRadar && (
          <div style={{
            position: 'absolute',
            bottom: '40px',
            right: '20px',
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid #334155',
            padding: '10px 14px',
            borderRadius: '8px',
            zIndex: 1000,
            color: '#f8fafc',
            fontSize: '12px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px', borderBottom: '1px solid #334155', paddingBottom: '4px' }}>
              Weather Intensity
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ width: '12px', height: '12px', background: '#22c55e', borderRadius: '2px', display: 'inline-block' }}></span>
              <span>Light Rain (Clear / Safe)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ width: '12px', height: '12px', background: '#eab308', borderRadius: '2px', display: 'inline-block' }}></span>
              <span>Moderate Rain</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '2px', display: 'inline-block' }}></span>
              <span>Heavy Storm (Hazardous)</span>
            </div>
          </div>
        )}
      </MapContainer>
    </div>
  );
}