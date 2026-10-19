import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const source=path.join(root,'data/geonames/UA.txt');
const adminSource=path.join(root,'data/geonames/admin1CodesASCII.txt');
const output=path.join(root,'web/ua-places.json');
const admin=Object.fromEntries(fs.readFileSync(adminSource,'utf8').split(/\r?\n/).filter(line=>line.startsWith('UA.')).map(line=>{const [code,name]=line.split('\t');return [code.slice(3),name];}));
const russianRegions={27:'Житомирская область',26:'Запорожская область',25:'Закарпатская область',24:'Волынская область',23:'Винницкая область',22:'Тернопольская область',21:'Сумская область',20:'Севастополь',19:'Ровенская область',18:'Полтавская область',17:'Одесская область',16:'Николаевская область',15:'Львовская область',14:'Луганская область',13:'Киевская область',12:'Киев',11:'Крым',10:'Кировоградская область',9:'Хмельницкая область',8:'Херсонская область',7:'Харьковская область',6:'Ивано-Франковская область',5:'Донецкая область',4:'Днепропетровская область',3:'Черновицкая область',2:'Черниговская область',1:'Черкасская область'};
for(const code of Object.keys(admin))admin[code]=russianRegions[Number(code)]||admin[code];
const cyrillic=/[А-Яа-яІіЇїЄєҐґ]/;
const places=fs.readFileSync(source,'utf8').trim().split(/\r?\n/).flatMap(line=>{
  const f=line.split('\t');if(f[6]!=='P')return [];
  const aliases=[...new Set(f[3].split(',').filter(name=>cyrillic.test(name)))];
  const ukrainian=aliases.find(name=>/[ІіЇїЄєҐґ]/.test(name))||'';
  const russian=aliases.find(name=>name!==ukrainian)||'';
  return [[Number(f[0]),f[1],ukrainian,russian,admin[f[10]]||'',Number(f[4]),Number(f[5]),f[7],Number(f[14])||0]];
});
fs.writeFileSync(output,JSON.stringify({source:'GeoNames',updated:new Date().toISOString().slice(0,10),places}));
console.log(`Wrote ${places.length.toLocaleString()} populated places to ${path.relative(root,output)}.`);
