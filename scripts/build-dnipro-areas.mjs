import fs from 'node:fs/promises';

// One-off, reproducible OSM snapshot for the Dnipro preparation layer.
// Run manually; it never runs as part of an app build.
const ua='ForestWatch/0.5 (educational field-inspection app; forest-watch-field.shrewd-earth-4564.chatgpt.site)';
const boundaryUrl='https://nominatim.openstreetmap.org/search?city=Dnipro&country=Ukraine&format=jsonv2&polygon_geojson=1&limit=1';
const boundary=(await (await fetch(boundaryUrl,{headers:{'User-Agent':ua}})).json())[0];
if(boundary?.osm_id!==1017311||!boundary.geojson)throw Error('Dnipro city boundary unavailable');
const rings=boundary.geojson.type==='Polygon'?[boundary.geojson.coordinates]:boundary.geojson.coordinates;
function inRing(x,y,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function inCity(lat,lng){return rings.some(poly=>inRing(lng,lat,poly[0])&&!poly.slice(1).some(hole=>inRing(lng,lat,hole)));}
const tiles=[];
for(const lat of [48.39,48.42,48.45,48.48,48.51,48.54])for(const lng of [34.80,34.86,34.92,34.98,35.04,35.10,35.16,35.22])if(inCity(lat,lng))tiles.push({lat,lng});
const features=new Map(),tagsKind=t=>t.leisure==='park'?'park':t.natural==='wood'||t.landuse==='forest'?'wood':t.natural==='water'||t.landuse==='reservoir'?'water':null;
async function getTile({lat,lng}){
  const bbox=[lng-.025,lat-.015,lng+.025,lat+.015].map(v=>v.toFixed(5)).join(',');
  let response=await fetch('https://api.openstreetmap.org/api/0.6/map.json?bbox='+bbox,{headers:{'User-Agent':ua}});
  if(!response.ok)throw Error(`OSM tile ${lat},${lng}: ${response.status}`);
  const data=await response.json(),nodes=new Map(data.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));
  for(const e of data.elements){
    if(e.type!=='way'||!e.tags||!tagsKind(e.tags)||features.has(e.id))continue;
    const raw=e.nodes?.map(id=>nodes.get(id)).filter(Boolean);
    if(!raw||raw.length<4||raw[0].id!==raw.at(-1).id)continue;
    const ring=raw.map(n=>[n.lat,n.lon]);
    const bounds={south:Math.min(...ring.map(p=>p[0])),north:Math.max(...ring.map(p=>p[0])),west:Math.min(...ring.map(p=>p[1])),east:Math.max(...ring.map(p=>p[1]))};
    const latMid=(bounds.south+bounds.north)/2,lngMid=(bounds.west+bounds.east)/2;
    if(!inCity(latMid,lngMid))continue;
    const size=(bounds.north-bounds.south)*111000*(bounds.east-bounds.west)*74000;
    if(size<800||size>20_000_000)continue;
    features.set(e.id,{id:`osm-way-${e.id}`,name:(e.tags['name:uk']||e.tags.name||({wood:'Лесной участок',park:'Парк',water:'Водоём'})[tagsKind(e.tags)]).slice(0,100),kind:tagsKind(e.tags),lat:latMid,lng:lngMid,geometry:ring,areaM2:Math.round(size),lastEdited:e.timestamp||null,url:`https://www.openstreetmap.org/way/${e.id}`});
  }
  console.log(`${lat},${lng}: ${data.elements.length} elements, ${features.size} eligible city areas`);
}
for(const tile of tiles){try{await getTile(tile);}catch(error){console.warn(error.message);}}
const all=[...features.values()].sort((a,b)=>a.id.localeCompare(b.id));
const output={source:'OpenStreetMap',boundary:'https://www.openstreetmap.org/relation/1017311',fetchedAt:new Date().toISOString(),count:all.length,areas:all};
await fs.writeFile(new URL('../web/dnipro-areas.json',import.meta.url),JSON.stringify(output));
console.log(`Saved ${all.length} Dnipro areas from ${tiles.length} tiles`);
