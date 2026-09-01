const point = (lng, lat) => [lng, lat];
const roads = [
  { id:'r1', name:'NH-27 Guwahati Corridor', from:'Guwahati', to:'Shillong', coordinates:[point(91.7362,26.1445),point(91.8,25.95),point(91.8933,25.5788)], distance:99, riskScore:.18, blocked:false, travelTime:165 },
  { id:'r2', name:'NH-6 Shillong Link', from:'Shillong', to:'Silchar', coordinates:[point(91.8933,25.5788),point(92.2,24.9),point(92.7789,24.8333)], distance:210, riskScore:.48, blocked:false, travelTime:330 },
  { id:'r3', name:'NH-37 Barak Route', from:'Silchar', to:'Imphal', coordinates:[point(92.7789,24.8333),point(93.95,24.7),point(93.9368,24.817),], distance:225, riskScore:.27, blocked:false, travelTime:360 },
  { id:'r4', name:'NH-2 Imphal Bypass', from:'Imphal', to:'Kohima', coordinates:[point(93.9368,24.817),point(94.1,25.4),point(94.1086,25.6751)], distance:145, riskScore:.64, blocked:false, travelTime:265 },
  { id:'r5', name:'NH-2 Kohima Spur', from:'Kohima', to:'Aizawl', coordinates:[point(94.1086,25.6751),point(93.2,24.2),point(92.7176,23.7271)], distance:300, riskScore:.22, blocked:false, travelTime:480 },
  { id:'r6', name:'NH-54 Aizawl Link', from:'Aizawl', to:'Silchar', coordinates:[point(92.7176,23.7271),point(92.7789,24.8333)], distance:180, riskScore:.32, blocked:false, travelTime:290 },
  { id:'r7', name:'NH-8 Agartala Road', from:'Agartala', to:'Silchar', coordinates:[point(91.2868,23.8315),point(92.2,24.2),point(92.7789,24.8333)], distance:245, riskScore:.15, blocked:false, travelTime:390 },
  { id:'r8', name:'NH-27 Siliguri Gateway', from:'Siliguri', to:'Guwahati', coordinates:[point(88.3953,26.7271),point(89.9,26.2),point(91.7362,26.1445)], distance:470, riskScore:.12, blocked:false, travelTime:720 },
  { id:'r9', name:'Eastern Connector', from:'Siliguri', to:'Shillong', coordinates:[point(88.3953,26.7271),point(90.4,25.9),point(91.8933,25.5788)], distance:430, riskScore:.36, blocked:false, travelTime:660 },
  { id:'r10', name:'Brahmaputra Relief Link', from:'Guwahati', to:'Agartala', coordinates:[point(91.7362,26.1445),point(91.2,24.4),point(91.2868,23.8315)], distance:390, riskScore:.25, blocked:false, travelTime:620 }
];
const places = [
  { type:'hospital', name:'GMCH Emergency', position:point(91.7362,26.1445) }, { type:'hospital', name:'Silchar Medical College', position:point(92.7789,24.8333) },
  { type:'warehouse', name:'NER Relief Depot', position:point(91.78,26.18) }, { type:'warehouse', name:'Barak Cold Chain', position:point(92.75,24.86) },
  { type:'helipad', name:'Shillong Helipad', position:point(91.9,25.59) }
];
export { roads, places };
