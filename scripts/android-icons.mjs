import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Resvg} from '@resvg/resvg-js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const res=path.join(root,'android/app/src/main/res');
const icon=fs.readFileSync(path.join(root,'web/icon.svg'),'utf8');
const foreground='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 10 16 34h8L13 46h15v9h8v-9h15L40 34h8Z" fill="#dbe7df"/></svg>';
const png=(svg,size)=>new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng();
for(const [density,size] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
  const dir=path.join(res,'mipmap-'+density);
  for(const name of ['ic_launcher.png','ic_launcher_round.png'])fs.writeFileSync(path.join(dir,name),png(icon,size));
  fs.writeFileSync(path.join(dir,'ic_launcher_foreground.png'),png(foreground,Math.round(size*2.25)));
}
console.log('Android launcher icons updated.');
