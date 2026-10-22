import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseWater} from '../worker/api.mjs';

test('national water snapshot contains distinct real OSM nodes with provenance',()=>{
  const data=JSON.parse(fs.readFileSync(new URL('../web/water-sites.json',import.meta.url)));
  assert.equal(data.source,'OpenStreetMap');assert.equal(data.license,'ODbL');
  assert.ok(Number.isFinite(Date.parse(data.fetchedAt)));assert.ok(data.points.length>1000);
  assert.equal(new Set(data.points.map(p=>p.id)).size,data.points.length);
  for(const p of data.points){
    assert.match(p.id,/^osm-node-\d+$/);assert.equal(p.url,'https://www.openstreetmap.org/node/'+p.id.slice(9));
    assert.ok(['fire_hydrant','suction_point','water_tank'].includes(p.kind));
    assert.ok(Number.isFinite(p.lat)&&Number.isFinite(p.lng));assert.ok(p.lat>44&&p.lat<53&&p.lng>22&&p.lng<41);
    assert.equal(p.checkedAt,undefined);assert.equal(p.status,undefined);assert.ok(!['no','private'].includes(p.access));
  }
});

test('missing OSM shoreline vertices never become a false straight segment',()=>{
  const points=parseWater({elements:[{type:'node',id:1,lat:48,lon:35},{type:'node',id:3,lat:48.1,lon:35.1},{type:'way',id:4,nodes:[1,2,3,1],tags:{natural:'water'}}]});
  assert.deepEqual(points,[]);
});
