import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const source=path.join(root,'data/geonames/UA.txt');
const adminSource=path.join(root,'data/geonames/admin1CodesASCII.txt');
const output=path.join(root,'web/ua-places.json');
const admin=Object.fromEntries(fs.readFileSync(adminSource,'utf8').split(/\r?\n/).filter(line=>line.startsWith('UA.')).map(line=>{const [code,name]=line.split('\t');return [code.slice(3),name];}));
const ukrainianRegions={27:'Житомирська область',26:'Запорізька область',25:'Закарпатська область',24:'Волинська область',23:'Вінницька область',22:'Тернопільська область',21:'Сумська область',20:'Севастополь',19:'Рівненська область',18:'Полтавська область',17:'Одеська область',16:'Миколаївська область',15:'Львівська область',14:'Луганська область',13:'Київська область',12:'Київ',11:'Крим',10:'Кіровоградська область',9:'Хмельницька область',8:'Херсонська область',7:'Харківська область',6:'Івано-Франківська область',5:'Донецька область',4:'Дніпропетровська область',3:'Чернівецька область',2:'Чернігівська область',1:'Черкаська область'};
for(const code of Object.keys(admin))admin[code]=ukrainianRegions[Number(code)]||admin[code];
const cyrillic=/[А-Яа-яІіЇїЄєҐґ]/;
const places=fs.readFileSync(source,'utf8').trim().split(/\r?\n/).flatMap(line=>{
  const f=line.split('\t');if(f[6]!=='P')return [];
  const aliases=[...new Set(f[3].split(',').filter(name=>cyrillic.test(name)))];
  const ukrainian=aliases.find(name=>/[ІіЇїЄєҐґ]/.test(name))||'';
  return [[Number(f[0]),f[1],ukrainian,[...new Set(aliases)].join('|'),admin[f[10]]||'',Number(f[4]),Number(f[5]),f[7],Number(f[14])||0]];
});
fs.writeFileSync(output,JSON.stringify({source:'GeoNames',updated:new Date().toISOString().slice(0,10),places}));
console.log(`Wrote ${places.length.toLocaleString()} populated places to ${path.relative(root,output)}.`);
