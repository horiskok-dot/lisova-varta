import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {packager} from '@electron/packager';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const stage=path.join(root,'dist/desktop-stage');
const out=path.join(root,'releases/desktop');
fs.mkdirSync(stage,{recursive:true});
fs.copyFileSync(path.join(root,'desktop/main.cjs'),path.join(stage,'main.cjs'));
fs.copyFileSync(path.join(root,'desktop/icon.ico'),path.join(stage,'icon.ico'));
fs.copyFileSync(path.join(root,'dist/server/index.js'),path.join(stage,'worker.js'));
fs.writeFileSync(path.join(stage,'package.json'),JSON.stringify({name:'forest-watch-desktop',productName:'Лесной дозор',version:'0.4.0',main:'main.cjs',private:true}));
const paths=await packager({dir:stage,out,platform:'win32',arch:'x64',name:'Lesnoy Dozor',executableName:'Lesnoy Dozor',icon:path.join(stage,'icon.ico'),asar:true,overwrite:true});
console.log('Windows application: '+path.join(paths[0],'Lesnoy Dozor.exe'));
