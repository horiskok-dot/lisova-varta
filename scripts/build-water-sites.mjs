import fs from 'node:fs/promises';
import {parseWater} from '../worker/api.mjs';

// Manual snapshot refresh, never part of a regular build or page load.
const query='[out:json][timeout:60];area["ISO3166-1"="UA"]["admin_level"="2"]->.ua;node(area.ua)["emergency"~"^(fire_hydrant|water_tank|suction_point)$"];out meta;';
const response=await fetch('https://overpass-api.de/api/interpreter',{
  method:'POST',body:new URLSearchParams({data:query}),
  headers:{'User-Agent':'ForestWatch/0.8 (educational open-data inspection map)'},
  signal:AbortSignal.timeout(90000)
});
if(!response.ok)throw Error('OSM snapshot request failed: HTTP '+response.status);
const raw=await response.json();
if(raw.remark||!Array.isArray(raw.elements))throw Error('Incomplete OSM snapshot');
const allowed=raw.elements.filter(e=>e.type==='node'&&Number.isFinite(e.lat)&&Number.isFinite(e.lon)&&!['yes','room'].includes(e.tags?.indoor)&&e.tags?.location!=='indoor'&&!['private','no'].includes(e.tags?.access));
const points=parseWater({elements:allowed});
if(!points.length)throw Error('Empty OSM snapshot');
const snapshot={source:'OpenStreetMap',sourceUrl:'https://www.openstreetmap.org/copyright',license:'ODbL',fetchedAt:new Date().toISOString(),dataTimestamp:raw.osm3s?.timestamp_osm_base||null,query,excluded:raw.elements.length-allowed.length,points};
await fs.writeFile(new URL('../web/water-sites.json',import.meta.url),JSON.stringify(snapshot));
console.log(JSON.stringify({count:points.length,excluded:snapshot.excluded,kinds:points.reduce((counts,p)=>(counts[p.kind]=(counts[p.kind]||0)+1,counts),{}),dnipro:points.filter(p=>p.lat>=48.35&&p.lat<=48.58&&p.lng>=34.74&&p.lng<=35.25).length}));
