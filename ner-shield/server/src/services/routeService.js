import { roads, places } from '../data/roads.js';
function findPath(origin, destination, avoidBlocked = true) {
  const edges = roads.filter(r => !avoidBlocked || !r.blocked).map(r => ({...r, cost:r.travelTime * (1 + r.riskScore * 2)}));
  const queue = [{ city:origin, path:[], cost:0 }]; const best = new Map();
  while (queue.length) { queue.sort((a,b)=>a.cost-b.cost); const current=queue.shift(); if(current.city===destination) return current.path;
    if (best.has(current.city) && best.get(current.city)<=current.cost) continue; best.set(current.city,current.cost);
    edges.filter(e=>e.from===current.city || e.to===current.city).forEach(e=>{ const next=e.from===current.city?e.to:e.from; if(!current.path.some(p=>p.id===e.id)) queue.push({city:next,path:[...current.path,e],cost:current.cost+e.cost}); }); }
  return [];
}
const flatten = path => path.flatMap((r,i)=>i ? r.coordinates.slice(1) : r.coordinates);
const summarize = path => ({ geojson:{type:'LineString',coordinates:flatten(path)}, segments:path, distance:path.reduce((s,r)=>s+r.distance,0), eta:path.reduce((s,r)=>s+r.travelTime,0), risk:path.length ? Math.max(...path.map(r=>r.riskScore)) : 1 });
export function calculateRoutes(origin='Guwahati', destination='Silchar') { const primary=findPath(origin,destination); const bypass=findPath(origin,destination,true); return { primary:summarize(primary), bypass:summarize(bypass.length && bypass.join('|') !== primary.join('|') ? bypass : primary) }; }
export function blockRoadForIncident() { const target=roads.find(r=>r.id==='r2') || roads[0]; target.blocked=true; target.riskScore=.94; return target; }
export { roads, places };
