import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const root=path.resolve(import.meta.dirname,'..');
const svg=fs.readFileSync(path.join(root,'web/icon.svg'),'utf8');
const png=size=>new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng();
const icons=path.join(root,'web/icons');
fs.mkdirSync(icons,{recursive:true});
for(const size of [192,512])fs.writeFileSync(path.join(icons,`icon-${size}.png`),png(size));
const image=png(256),header=Buffer.alloc(22);
header.writeUInt16LE(1,4);header[6]=0;header[7]=0;header[8]=0;header[9]=0;
header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);
header.writeUInt32LE(image.length,14);header.writeUInt32LE(22,18);
fs.mkdirSync(path.join(root,'desktop'),{recursive:true});
fs.writeFileSync(path.join(root,'desktop/icon.ico'),Buffer.concat([header,image]));
console.log('Created phone and desktop icons.');
