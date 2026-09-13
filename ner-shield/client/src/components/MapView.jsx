import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, Tooltip, SVGOverlay, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createPinIcon = (text, bg, border = '#ffffff', pulse = false) =>
  L.divIcon({
    className: 'custom-map-pin',
    html: `<div style="
      background: ${bg};
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #0b1114;
      font-weight: 800;
      font-size: 11px;
      border: 2px solid ${border};
      box-shadow: 0 0 ${pulse ? '14px ' + bg : '6px rgba(0,0,0,0.6)'};
      pointer-events: auto;
    ">${text}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
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

  return rawCoords
    .map((pt) => {
      if (Array.isArray(pt) && pt.length >= 2) {
        const first = Number(pt[0]);
        const second = Number(pt[1]);
        return first > 45 ? [second, first] : [first, second];
      }
      return null;
    })
    .filter((pt) => pt && !isNaN(pt[0]) && !isNaN(pt[1]));
};

function getMinDistanceToCorridor(latLng, pathCoords) {
  if (!pathCoords || pathCoords.length === 0) return 999;
  let minDistance = 999;
  const [lat, lon] = latLng;
  for (const [pLat, pLon] of pathCoords) {
    const d = Math.hypot(lat - pLat, lon - pLon);
    if (d < minDistance) minDistance = d;
  }
  return minDistance;
}

function MapController({ primaryPath, bypassPath, originCoords, destCoords, originName, destName }) {
  const map = useMap();

  useEffect(() => {
    map.closePopup();

    try {
      map.invalidateSize();
      const combined = [...primaryPath, ...bypassPath];
      if (originCoords) combined.push(originCoords);
      if (destCoords) combined.push(destCoords);

      if (combined.length > 1) {
        map.fitBounds(combined, { padding: [55, 55], maxZoom: 9 });
      }
    } catch { }
  }, [primaryPath, bypassPath, originCoords, destCoords, originName, destName, map]);

  return null;
}

export default function MapView({
  routes,
  places,
  incident,
  cargo,
  showRadar,
  originName,
  destName,
  originCoords,
  destCoords,
  rainfall = 86,
  soil = 54
}) {
  const primaryRouteCoords = useMemo(() => extractLatLng(routes?.primary), [routes?.primary]);
  const bypassRouteCoords = useMemo(() => extractLatLng(routes?.bypass), [routes?.bypass]);
  const defaultCenter = originCoords || [26.1445, 91.7362];

  const riskScore = Number(routes?.primary?.risk || 0);
  const isBlocked = riskScore > 0.8 || Boolean(incident);
  const isHighRisk = riskScore > 0.45 && !isBlocked;
  const isElevatedHazard = isBlocked || isHighRisk;

  // Determine whether bypass is merely an identical path
  const isSamePath = useMemo(() => {
    if (!primaryRouteCoords.length || !bypassRouteCoords.length) return true;
    if (primaryRouteCoords.length !== bypassRouteCoords.length) return false;
    const midA = primaryRouteCoords[Math.floor(primaryRouteCoords.length / 2)];
    const midB = bypassRouteCoords[Math.floor(bypassRouteCoords.length / 2)];
    if (!midA || !midB) return true;
    return Math.hypot(midA[0] - midB[0], midA[1] - midB[1]) < 0.005;
  }, [primaryRouteCoords, bypassRouteCoords]);

  let primaryColor = '#10b981';
  let statusText = 'SAFE / OPERATIONAL';
  if (isBlocked) {
    primaryColor = '#ef4444';
    statusText = 'BLOCKED / SEVERED';
  } else if (isHighRisk) {
    primaryColor = '#f59e0b';
    statusText = 'HIGH RISK / SATURATED';
  }

  const bypassEmergencyFacilities = useMemo(() => {
    if (!isElevatedHazard || !bypassRouteCoords.length || !Array.isArray(places)) {
      return [];
    }
    return places
      .filter((p) => p.type === 'hospital' || p.type === 'helipad')
      .map((p) => {
        const first = Number(p.position[0]);
        const second = Number(p.position[1]);
        const latLng = first > 45 ? [second, first] : [first, second];
        const dist = getMinDistanceToCorridor(latLng, bypassRouteCoords);
        return { ...p, latLng, dist };
      })
      .filter((p) => p.dist < 0.45);
  }, [places, bypassRouteCoords, isElevatedHazard, originName, destName]);

  const radarBounds = useMemo(() => {
    const allLats = [];
    const allLons = [];

    if (primaryRouteCoords.length > 0) {
      primaryRouteCoords.forEach(([lat, lon]) => {
        allLats.push(lat);
        allLons.push(lon);
      });
    }
    if (originCoords) {
      allLats.push(originCoords[0]);
      allLons.push(originCoords[1]);
    }
    if (destCoords) {
      allLats.push(destCoords[0]);
      allLons.push(destCoords[1]);
    }

    if (allLats.length === 0) {
      return [
        [24.0, 90.0],
        [27.5, 94.5]
      ];
    }

    const minLat = Math.min(...allLats) - 0.75;
    const maxLat = Math.max(...allLats) + 0.75;
    const minLon = Math.min(...allLons) - 0.85;
    const maxLon = Math.max(...allLons) + 0.85;

    return [
      [minLat, minLon],
      [maxLat, maxLon]
    ];
  }, [primaryRouteCoords, originCoords, destCoords, originName, destName]);

  const radarGlobalOpacity = Math.min(0.25 + (rainfall / 300) * 0.25, 0.50);
  const intensityScale = Math.min(0.75 + (rainfall / 300) * 0.45, 1.25);

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', minHeight: '400px' }}>
      <MapContainer
        center={defaultCenter}
        zoom={7}
        maxZoom={12}
        minZoom={5}
        style={{ height: '100%', width: '100%', background: '#0b1114' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {showRadar && (
          <SVGOverlay
            key={`weather-radar-${originName}-${destName}-${Math.round(rainfall)}`}
            bounds={radarBounds}
            opacity={radarGlobalOpacity}
          >
            <svg
              viewBox="0 0 1200 900"
              xmlns="http://www.w3.org/2000/svg"
              style={{ pointerEvents: 'none', width: '100%', height: '100%' }}
            >
              <defs>
                <filter id="organicDopplerTurbulence" x="-30%" y="-30%" width="160%" height="160%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.016 0.024" numOctaves="4" seed="42" result="noise" />
                  <feDisplacementMap in="SourceGraphic" in2="noise" scale="65" xChannelSelector="R" yChannelSelector="G" result="displaced" />
                  <feGaussianBlur in="displaced" stdDeviation="5" />
                </filter>
              </defs>

              <g transform={`scale(${intensityScale}) translate(${120 * (1 - intensityScale)}, ${90 * (1 - intensityScale)})`}>
                <path
                  d="M 280,360 C 190,290 260,180 430,220 C 570,160 740,180 880,240 C 970,300 1020,430 950,540 C 890,640 790,620 710,580 C 650,680 520,740 400,700 C 290,650 330,510 260,430 Z"
                  fill="#00b4d8"
                  fillOpacity="0.28"
                  filter="url(#organicDopplerTurbulence)"
                />
                <path
                  d="M 340,360 C 290,290 350,220 470,240 C 580,200 710,220 830,270 C 900,330 920,430 870,510 C 810,580 730,540 660,520 C 600,600 490,650 400,620 C 320,570 380,470 320,380 Z"
                  fill="#f59e0b"
                  fillOpacity="0.38"
                  filter="url(#organicDopplerTurbulence)"
                />
                <path
                  d="M 470,330 C 440,280 530,270 590,290 C 650,300 690,350 640,400 C 580,430 500,410 460,370 Z"
                  fill="#dc2626"
                  fillOpacity="0.55"
                  filter="url(#organicDopplerTurbulence)"
                />
              </g>
            </svg>
          </SVGOverlay>
        )}

        <MapController
          primaryPath={primaryRouteCoords}
          bypassPath={isBlocked && isSamePath ? [] : bypassRouteCoords}
          originCoords={originCoords}
          destCoords={destCoords}
          originName={originName}
          destName={destName}
        />

        {primaryRouteCoords.length > 0 && (
          <Polyline
            key={`primary-${originName}-${destName}-${riskScore}-${isBlocked}`}
            positions={primaryRouteCoords}
            pathOptions={{
              color: primaryColor,
              dashArray: isBlocked ? '6, 12' : null,
              opacity: isBlocked ? 0.85 : 0.95,
              weight: isBlocked ? 6 : 6
            }}
          >
            <Tooltip direction="top">
              <span>
                {isBlocked ? '⛔ BLOCKED: ' : isHighRisk ? '⚠️ CAUTION: ' : '✓ '}
                {routes?.primary?.corridorName || 'Primary Corridor'}
              </span>
            </Tooltip>
            <Popup>
              <strong>{routes?.primary?.corridorName}</strong>
              <br />
              Status: <b style={{ color: primaryColor }}>{statusText}</b>
              <br />
              Disruption Risk: {riskScore.toFixed(2)}
            </Popup>
          </Polyline>
        )}

        {/* Never paint cyan line if the highway is blocked and bypass shares the same path */}
        {bypassRouteCoords.length > 0 && (!isBlocked || !isSamePath) && (
          <Polyline
            key={`bypass-${originName}-${destName}`}
            positions={bypassRouteCoords}
            pathOptions={{
              color: '#00f0ff',
              weight: isBlocked ? 6 : 4,
              dashArray: '8, 10',
              opacity: 0.95
            }}
          >
            <Tooltip direction="bottom">
              <span>⚡ AI BYPASS: {routes?.bypass?.corridorName || 'Strategic Alternate'}</span>
            </Tooltip>
            <Popup>
              <strong>{routes?.bypass?.corridorName}</strong>
              <br />
              All-Weather Heavy Transit Bypass
            </Popup>
          </Polyline>
        )}

        {originCoords && (
          <Marker
            key={`origin-${originName}`}
            position={originCoords}
            icon={createPinIcon('A', '#10b981', '#ffffff', true)}
          >
            <Popup>
              <strong>ORIGIN: {originName}</strong>
              <br />
              Central Logistics Depot
            </Popup>
          </Marker>
        )}

        {destCoords && (
          <Marker
            key={`dest-${destName}`}
            position={destCoords}
            icon={createPinIcon('B', '#ef4444', '#ffffff', true)}
          >
            <Popup>
              <strong>DESTINATION: {destName}</strong>
              <br />
              Critical Delivery Point
            </Popup>
          </Marker>
        )}

        {isElevatedHazard &&
          bypassEmergencyFacilities.map((facility, idx) => {
            const isHelipad = facility.type === 'helipad';
            const symbol = isHelipad ? '◈' : '✚';
            const bg = isHelipad ? '#a855f7' : '#eab308';
            const border = isBlocked ? (isSamePath ? '#ef4444' : '#00f0ff') : '#ffffff';

            return (
              <Marker
                key={`bypass-facility-${originName}-${destName}-${facility.id || facility.name || 'fac'}-${idx}`}
                position={facility.latLng}
                icon={createPinIcon(symbol, bg, border, true)}
              >
                <Tooltip permanent direction="top">
                  <span>
                    {isHelipad ? '🚁 AIR-DROP HELIPAD' : '🏥 BYPASS TRAUMA CENTER'}
                  </span>
                </Tooltip>
                <Popup>
                  <div style={{ minWidth: '170px' }}>
                    <span
                      style={{
                        background: isHelipad ? '#7e22ce' : '#ca8a04',
                        color: '#fff',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        display: 'inline-block',
                        marginBottom: '4px'
                      }}
                    >
                      {isHelipad ? 'AIR-DROP CONTINGENCY' : 'HIGH-RISK TRIAGE STATION'}
                    </span>
                    <br />
                    <strong>{facility.name}</strong>
                    <br />
                    <small style={{ color: '#94a3b8' }}>
                      Positioned along transit corridor ({routes?.bypass?.corridorName || 'NH Alternate'}).
                    </small>
                    <div style={{ color: '#38bdf8', fontSize: '10px', marginTop: '4px' }}>
                      Status: Ready for convoy emergency diversion or air replenishment.
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {incident && Array.isArray(incident.coordinates) && (
          <Marker
            key={`hazard-${originName}-${destName}-${incident.coordinates.join(',')}`}
            position={
              Number(incident.coordinates[0]) > 45
                ? [Number(incident.coordinates[1]), Number(incident.coordinates[0])]
                : [Number(incident.coordinates[0]), Number(incident.coordinates[1])]
            }
            icon={createPinIcon('!', '#ff0033', '#ffffff', true)}
          >
            <Popup>
              <strong style={{ color: '#ef4444' }}>CRITICAL LANDSLIDE SEVERED</strong>
              <br />
              {incident.type || 'Rockfall / Debris Flow'}
              <br />
              Corridor impassable on {routes?.primary?.corridorName || 'Primary Route'}.
            </Popup>
          </Marker>
        )}

        {cargo && primaryRouteCoords.length > 0 && (
          <Marker
            key={`cargo-${cargo.id}`}
            position={
              isBlocked
                ? isSamePath
                  ? primaryRouteCoords[0]
                  : bypassRouteCoords[0] || primaryRouteCoords[0]
                : primaryRouteCoords[0]
            }
            icon={createPinIcon('🚚', isBlocked && isSamePath ? '#ef4444' : '#f6c453')}
          >
            <Popup>
              <strong>{cargo.id}</strong> ({cargo.type})<br />
              Status:{' '}
              {isBlocked
                ? isSamePath
                  ? 'Convoy Halted: All Road Access Severed'
                  : 'Diverted onto AI Bypass'
                : 'En Route on Primary Corridor'}
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {showRadar && (
        <div
          style={{
            position: 'absolute',
            bottom: '18px',
            right: '18px',
            background: 'rgba(11, 17, 20, 0.94)',
            border: '1px solid #26363b',
            padding: '8px 14px',
            borderRadius: '6px',
            zIndex: 500,
            fontFamily: 'DM Mono, monospace',
            fontSize: '9px',
            color: '#e9f0ef'
          }}
        >
          <div style={{ fontWeight: 'bold', color: '#45e0d0', marginBottom: '3px' }}>
            DOPPLER PRECIPITATION REFLECTIVITY
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <span style={{ width: '8px', height: '8px', background: '#dc2626', borderRadius: '2px' }} />
            <span>Heavy Core ({rainfall} mm)</span>
            <span style={{ width: '8px', height: '8px', background: '#f59e0b', borderRadius: '2px', marginLeft: '6px' }} />
            <span>Mid Rainband</span>
            <span style={{ width: '8px', height: '8px', background: '#00b4d8', borderRadius: '2px', marginLeft: '6px' }} />
            <span>Cyan Fringe</span>
          </div>
          <div style={{ color: isBlocked ? '#ef4444' : isHighRisk ? '#f59e0b' : '#10b981' }}>
            Corridor State:{' '}
            {isBlocked
              ? isSamePath
                ? 'SEVERED · NO ALTERNATE BYPASS'
                : 'SEVERED · AI BYPASS ACTIVE'
              : isHighRisk
                ? 'HIGH SATURATION RISK'
                : 'NORMAL PASSABLE'}
          </div>
        </div>
      )}
    </div>
  );
}