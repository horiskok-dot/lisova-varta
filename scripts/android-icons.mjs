import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const res=path.join(root,'android/app/src/main/res');
const icon=fs.readFileSync(path.join(root,'web/icon.svg'),'utf8');
const mark=fs.readFileSync(path.join(root,'web/logo-foreground.svg'),'utf8');
const foreground=mark.replace('viewBox="0 0 128 128"','viewBox="-32 -32 192 192"');
const png=(svg,size)=>new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng();
for(const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
  const dir=path.join(res,'mipmap-'+density);
  for(const name of ['ic_launcher.png','ic_launcher_round.png'])fs.writeFileSync(path.join(dir,name),png(icon,size));
  fs.writeFileSync(path.join(dir,'ic_launcher_foreground.png'),png(foreground,Math.round(size*2.25)));
}
for(const entry of fs.readdirSync(res)){
  const splash=path.join(res,entry,'splash.png');if(!fs.existsSync(splash))continue;
  const previous=fs.readFileSync(splash),width=previous.readUInt32BE(16),height=previous.readUInt32BE(20),size=Math.round(Math.min(width,height)*.28);
  const nested=mark.replace('<svg ',`<svg x="${(width-size)/2}" y="${(height-size)/2}" width="${size}" height="${size}" `);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#123f35"/>${nested}</svg>`;
  fs.writeFileSync(splash,png(svg,width));
}
console.log('Android launcher icons updated.');
