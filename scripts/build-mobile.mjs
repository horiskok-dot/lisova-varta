import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const src=path.join(root,'web'),out=path.join(root,'dist/mobile');
fs.rmSync(out,{recursive:true,force:true});
fs.cpSync(src,out,{recursive:true});
fs.rmSync(path.join(out,'sw.js'));
const index=path.join(out,'index.html');
let html=fs.readFileSync(index,'utf8');
html=html.replace('<script src="vendor/leaflet.js"></script>','<script src="native.js"></script><script src="vendor/leaflet.js"></script>');
fs.writeFileSync(index,html);
await build({entryPoints:[path.join(root,'mobile/entry.mjs')],outfile:path.join(out,'native.js'),bundle:true,format:'iife',platform:'browser',target:'chrome100',minify:true});
console.log('Android web assets: '+out);
