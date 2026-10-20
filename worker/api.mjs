const NASA_URL='https://firms.modaps.eosdis.nasa.gov/data/active_fire/viirs/csv/SUOMI_VIIRS_C2_Europe_24h.csv';
const memo=new Map(),pending=new Map(),cooldowns=new Map();
const headers={'User-Agent':'ForestWatch/0.2 (educational field-inspection app; forest-watch-field.shrewd-earth-4564.chatgpt.site)','Accept':'application/json'};
class ApiError extends Error{constructor(message,status=502){super(message);this.status=status;}}
export function coordinates(params){const lat=Number(params.get('lat')),lng=Number(params.get('lng'));if(!params.has('lat')||!params.has('lng')||params.get('lat').trim()===''||params.get('lng').trim()===''||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>84||Math.abs(lng)>179)throw new ApiError('Некоректні координати.',400);return {lat:Math.round(lat*1000)/1000,lng:Math.round(lng*1000)/1000};}
export function bounds(params){const values=['south','west','north','east'].map(k=>params.get(k));if(values.some(v=>v===null||v.trim()===''))throw new ApiError('Укажіть межі ділянки.',400);const [south,west,north,east]=values.map(Number);if(![south,west,north,east].every(Number.isFinite)||south>=north||west>=east||south< -85||north>85||west< -180||east>180||north-south>10||east-west>15)throw new ApiError('Збільште мапу: ділянка не більш як 10° × 15°.',400);return {south,west,north,east};}
async function cached(key,ttl,fn){const hit=memo.get(key);if(hit&&Date.now()-hit.time<ttl)return hit.value;if(pending.has(key))return pending.get(key);const task=fn().then(value=>{if(memo.size>100)memo.delete(memo.keys().next().value);memo.set(key,{time:Date.now(),value});return value;}).finally(()=>pending.delete(key));pending.set(key,task);return task;}
async function get(url,type='json'){const host=new URL(url).host;if((cooldowns.get(host)||0)>Date.now())throw new ApiError('Перевищено ліміт запитів до джерела. Повторіть через хвилину.',429);const r=await fetch(url,{headers,signal:AbortSignal.timeout(25000)});if(r.status===429){cooldowns.set(host,Date.now()+60000);throw new ApiError('Перевищено ліміт запитів до джерела. Повторіть через хвилину.',429);}if(!r.ok){const error=new ApiError(`Джерело тимчасово недоступне (HTTP ${r.status}). Спробуйте пізніше.`);error.sourceStatus=r.status;throw error;}if(Number(r.headers.get('content-length'))>15*1024*1024)throw new ApiError('Джерело повернуло завелику ділянку.');const text=await r.text();if(text.length>15*1024*1024)throw new ApiError('Джерело повернуло завелику ділянку.');try{return {data:type==='json'?JSON.parse(text):text,lastModified:r.headers.get('last-modified')};}catch{throw new ApiError('Джерело повернуло некоректні дані.');}}
export function parseFires(csv){const rows=csv.trim().split(/\r?\n/),head=rows.shift()?.replace(/^\uFEFF/,'').split(',');if(!head||!['latitude','longitude','acq_date','acq_time'].every(k=>head.includes(k)))throw new ApiError('Неправильний формат даних NASA.');const idx=k=>head.indexOf(k);const result=[];for(const row of rows){const a=row.split(','),lat=Number(a[idx('latitude')]),lng=Number(a[idx('longitude')]),date=a[idx('acq_date')],time=a[idx('acq_time')]?.padStart(4,'0');if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{4}$/.test(time))continue;const observedAt=`${date}T${time.slice(0,2)}:${time.slice(2)}:00Z`;if(isNaN(Date.parse(observedAt))||Number(time.slice(0,2))>23||Number(time.slice(2))>59||new Date(observedAt).toISOString().slice(0,10)!==date)continue;result.push({lat,lng,observedAt,confidence:a[idx('confidence')]||'unknown',frp:Number.isFinite(Number(a[idx('frp')]))?Math.max(0,Number(a[idx('frp')])):0,satellite:a[idx('satellite')]||'Suomi NPP'});}return result;}
export function parseWater(data){
  if(data.error||!Array.isArray(data.elements))throw new ApiError('OSM повернув неповні дані про ділянку.');
  const nodes=new Map(data.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));
  const ways=new Map(data.elements.filter(e=>e.type==='way').map(e=>[e.id,e]));
  const isWater=e=>e.tags&&(e.tags.natural==='water'||e.tags.landuse==='reservoir'||['fire_hydrant','water_tank','suction_point'].includes(e.tags.emergency));
  const used=new Set();
  for(const r of data.elements.filter(e=>e.type==='relation'&&isWater(e)))for(const m of r.members||[])if(m.type==='way')used.add(m.ref);
  const pathFor=way=>(way?.nodes||[]).map(id=>nodes.get(id)).filter(n=>Number.isFinite(n?.lat)&&Number.isFinite(n?.lon));
  const result=[];
  for(const e of data.elements){
    if(!isWater(e)||e.type==='way'&&used.has(e.id))continue;
    const paths=e.type==='way'?[pathFor(e)]:e.type==='relation'?(e.members||[]).filter(m=>m.type==='way').map(m=>pathFor(ways.get(m.ref))):[];
    const validPaths=paths.filter(path=>path.length>=2);
    const coords=e.type==='node'?[e]:validPaths.flat();
    if(!coords.length||e.type!=='node'&&!validPaths.length)continue;
    const lat=coords.reduce((sum,n)=>sum+n.lat,0)/coords.length,lng=coords.reduce((sum,n)=>sum+n.lon,0)/coords.length;
    if(!Number.isFinite(lat)||!Number.isFinite(lng))continue;
    const t=e.tags;
    result.push({id:`osm-${e.type}-${e.id}`,name:(t['name:uk']||t.name||(t.emergency==='fire_hydrant'?'Гідрант':t.emergency==='water_tank'?'Резервуар води':t.emergency==='suction_point'?'Місце забору води':'Водний об’єкт OSM')).slice(0,100),lat,lng,geometryType:e.type,geometry:e.type==='node'?null:validPaths.map(path=>path.map(n=>[n.lat,n.lon])),kind:t.emergency||t.water||'water',access:t.access||'не вказано',lastEdited:e.timestamp||null,url:`https://www.openstreetmap.org/${e.type}/${e.id}`});
  }
  return result;
}
async function places(params){const q=params.get('q')?.trim();if(!q||q.length<2||q.length>100)throw new ApiError('Введіть назву завдовжки від 2 до 100 символів.',400);return cached('places:'+q.toLowerCase(),3600000,async()=>{const {data}=await get('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:q,count:'5',countryCode:'UA',language:'uk',format:'json'}));return {results:(data.results||[]).map(p=>({name:p.name,region:p.admin1||'',country:p.country||'',lat:p.latitude,lng:p.longitude}))};});}
async function weather(params){const {lat,lng}=coordinates(params);return cached(`weather:${lat}:${lng}`,15*60000,async()=>{const q=new URLSearchParams({latitude:String(lat),longitude:String(lng),current:'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m',daily:'temperature_2m_max,precipitation_sum,wind_speed_10m_max',timezone:'Europe/Kyiv',forecast_days:'3'});const {data}=await get('https://api.open-meteo.com/v1/forecast?'+q);if(!data.current||!data.daily||!Number.isFinite(data.current.temperature_2m))throw new ApiError('Неповні дані про погоду.');return {source:'Open-Meteo',sourceUrl:'https://open-meteo.com/',fetchedAt:new Date().toISOString(),location:{lat,lng},timezone:data.timezone,current:data.current,daily:data.daily};});}
async function water(params){
  const {lat,lng}=coordinates(params);
  return cached(`water-v3:${lat}:${lng}`,24*3600000,async()=>{
    let data,b;
    for(const [latRadius,lngRadius] of [[.005,.007],[.003,.004]]){
      b={south:lat-latRadius,west:lng-lngRadius,north:lat+latRadius,east:lng+lngRadius};
      const bbox=[b.west,b.south,b.east,b.north].map(v=>v.toFixed(3)).join(',');
      try{({data}=await get('https://api.openstreetmap.org/api/0.6/map.json?bbox='+bbox));break;}
      catch(e){if(latRadius===.003||e.sourceStatus!==400&&!e.message.includes('завелику ділянку'))throw e;}
    }
    const points=parseWater(data);
    return {source:'OpenStreetMap',sourceUrl:'https://www.openstreetmap.org/copyright',fetchedAt:new Date().toISOString(),bounds:b,count:points.length,truncated:points.length>200,points:points.slice(0,200),note:'Контур водойми або координата точкового об’єкта OSM не вказують перевірене місце забору. Наявність води та доступність під’їзду потрібно перевірити на місці.'};
  });
}
async function fires(params){const b=bounds(params);const feed=await cached('firms-europe',15*60000,async()=>{const {data,lastModified}=await get(NASA_URL,'text');const all=parseFires(data);return {all,fetchedAt:new Date().toISOString(),lastModified};});const matched=feed.all.filter(p=>p.lat>=b.south&&p.lat<=b.north&&p.lng>=b.west&&p.lng<=b.east);return {source:'NASA FIRMS · VIIRS S-NPP · Europe 24h',sourceUrl:NASA_URL,fetchedAt:feed.fetchedAt,lastModified:feed.lastModified,latestObservation:feed.all.reduce((s,p)=>p.observedAt>s?p.observedAt:s,'')||null,coverage:'Європа, один супутниковий набір S-NPP. Це не повний перелік пожеж.',bounds:b,count:matched.length,points:matched.slice(0,1500),truncated:matched.length>1500};}
export async function handleApi(request){try{if(request.method!=='GET')return Response.json({error:'Дозволено лише GET.'},{status:405,headers:{Allow:'GET'}});const url=new URL(request.url);const fn={'/api/weather':weather,'/api/water':water,'/api/fires':fires,'/api/places':places}[url.pathname];if(!fn)return Response.json({error:'Джерело не знайдено.'},{status:404});const data=await fn(url.searchParams);return Response.json(data,{headers:{'Cache-Control':url.pathname==='/api/water'?'private, max-age=3600':'private, max-age=300','X-Content-Type-Options':'nosniff'}});}catch(e){return Response.json({error:e instanceof ApiError?e.message:'Не вдалося зв’язатися з джерелом. Повторіть запит пізніше.'},{status:e instanceof ApiError?e.status:502,headers:{'Cache-Control':'no-store',...(e.status===429?{'Retry-After':'60'}:{})}});}}
