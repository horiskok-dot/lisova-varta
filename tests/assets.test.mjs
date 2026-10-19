import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import '../scripts/build.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const code=fs.readFileSync(path.join(root,'dist/server/index.js'),'utf8');
const worker=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;

test('published app serves installable PNG icons without corrupting binary data',async()=>{
  const icon=await worker.fetch(new Request('https://forest.example/icons/icon-192.png'));
  assert.equal(icon.status,200);
  assert.equal(icon.headers.get('content-type'),'image/png');
  assert.deepEqual([...new Uint8Array(await icon.arrayBuffer()).slice(0,8)],[137,80,78,71,13,10,26,10]);
  const manifest=await worker.fetch(new Request('https://forest.example/manifest.webmanifest'));
  const data=await manifest.json();
  assert.equal(data.display,'standalone');
  assert.ok(data.icons.some(i=>i.src==='icons/icon-192.png'));
});

test('Dnipro layer contains at least 100 distinct mapped areas with real OSM geometry',async()=>{
  const response=await worker.fetch(new Request('https://forest.example/dnipro-areas.json'));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.source,'OpenStreetMap');
  assert.ok(data.areas.length>=100);
  assert.equal(new Set(data.areas.map(area=>area.id)).size,data.areas.length);
  for(const area of data.areas){
    assert.match(area.id,/^osm-way-\d+$/);
    assert.match(area.url,/^https:\/\/www\.openstreetmap\.org\/way\/\d+$/);
    assert.ok(['wood','park','water'].includes(area.kind));
    assert.ok(area.geometry.length>=4);
    assert.deepEqual(area.geometry[0],area.geometry.at(-1));
  }
});
