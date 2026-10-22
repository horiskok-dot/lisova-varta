'use strict';
const liveLayers={water:L.layerGroup().addTo(map),fires:L.layerGroup().addTo(map)};
const requests=new Map();
let waterData=null,fireData=null,weatherData=null;
const stamp=s=>Number.isFinite(Date.parse(s))?new Intl.DateTimeFormat('uk',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Kyiv'}).format(new Date(s)):'невідомо';
const num=(v,d=0)=>Number.isFinite(v)?new Intl.NumberFormat('uk',{maximumFractionDigits:d,minimumFractionDigits:d}).format(v):'—';
const sourceButtons={weather:'#weather-refresh',water:'#water-refresh',fires:'#fires-refresh',places:'#find-area'};
const buttonLabels={weather:'Оновити',water:'Знайти на мапі',fires:'Завантажити',places:'Знайти'};
const onlineAllowed=()=>navigator.onLine&&!fieldMode;
const sourcePanel=$('#source-panel');
sourcePanel.open=readLocal('forest-sources-open')==='1';
sourcePanel.addEventListener('toggle',()=>{writePreference('forest-sources-open',sourcePanel.open?'1':'0');$('.live-pill').textContent=sourcePanel.open?'Згорнути ↑':'Відкрити джерела ↓';});
$('#sources-open').onclick=()=>{sourcePanel.open=true;sourcePanel.scrollIntoView({block:'start',behavior:'auto'});};

async function getJson(url,parent,timeout=18000){
  const controller=new AbortController(),abort=()=>controller.abort();
  if(parent.aborted)throw new DOMException('Скасовано','AbortError');
  parent.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeout);
  try{const r=await fetch(url,{signal:controller.signal,cache:'no-cache'});let data;try{data=await r.json();}catch{throw Error('Сервіс повернув неочікувану відповідь. Спробуйте пізніше.');}if(!r.ok)throw Error(r.status===429?'Перевищено ліміт запитів до джерела. Зачекайте хвилину.':data.error||data.reason||'Джерело недоступне (HTTP '+r.status+').');return data;}
  finally{clearTimeout(timer);parent.removeEventListener('abort',abort);}
}
async function api(name,params,signal){
  if(!onlineAllowed())throw Error('Вимкніть польовий режим або під’єднайтеся до мережі, щоб оновити дані.');
  if(window.ForestNative?.isNative)return window.ForestNative.api(name,params,signal);
  if(name==='weather'){
    try{
      const q=new URLSearchParams({latitude:params.lat,longitude:params.lng,current:'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m',daily:'temperature_2m_max,precipitation_sum,wind_speed_10m_max',timezone:'Europe/Kyiv',forecast_days:'3'});
      const d=await getJson('https://api.open-meteo.com/v1/forecast?'+q,signal,12000);
      if(!Number.isFinite(d.current?.temperature_2m)||!Array.isArray(d.daily?.time))throw Error('Неповні дані про погоду.');
      return {source:'Open-Meteo',sourceUrl:'https://open-meteo.com/',fetchedAt:new Date().toISOString(),location:{lat:Number(params.lat),lng:Number(params.lng)},timezone:d.timezone,current:d.current,daily:d.daily};
    }catch(e){if(signal.aborted)throw e;}
  }
  if(name==='places'){
    try{const d=await getJson('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:params.q,count:'100',countryCode:'UA',language:'uk',format:'json'}),signal,12000);return {results:(d.results||[]).map(p=>({name:p.name,region:p.admin1||'',country:p.country||'',lat:p.latitude,lng:p.longitude}))};}
    catch(e){if(signal.aborted)throw e;}
  }
  return getJson('/api/'+name+'?'+new URLSearchParams(params),signal,28000);
}
function saveSource(name,data){try{localStorage.setItem('forest-source-'+name,JSON.stringify(data));}catch{toast('Дані отримано, але не вдалося зберегти офлайн-копію: пам’ять заповнена.');}}
function readSource(name){try{return JSON.parse(readLocal('forest-source-'+name)||'null');}catch{return null;}}
function sourceTime(name,data,cached=false){const limit={weather:3600000,water:7*86400000,fires:6*3600000}[name];const old=Date.now()-Date.parse(data.fetchedAt)>limit;return `<p class="source-time">${cached?'Збережена копія':'Отримано'}: ${esc(stamp(data.fetchedAt))} · Київ</p>${old?'<p class="source-error age-warning">Копія застаріла. Оновіть джерело перед використанням.</p>':''}`;}
function loadError(name,error){const el=$('#'+name+'-data');el.querySelectorAll('.load-error').forEach(e=>e.remove());const p=document.createElement('p');p.className='source-error load-error';p.textContent='Не оновлено: '+error.message;el.prepend(p);}
function updateSummary(){const bits=[];if(weatherData)bits.push(num(weatherData.current?.temperature_2m,1)+' °C');if(waterData)bits.push('OSM: '+C.countLabel(waterData.points.length,{one:'об’єкт',few:'об’єкти',many:'об’єктів',other:'об’єктів'}));if(fireData)bits.push('NASA: '+C.countLabel(fireData.count,{one:'позначка',few:'позначки',many:'позначок',other:'позначок'}));$('#source-summary').textContent=(fieldMode?'Збережені дані · ':'')+(bits.join(' · ')||'Погода · вода OSM · супутникові позначки NASA');}
function updateAreaNotices(){
  const c=map.getCenter();
  for(const [name,data]of [['weather',weatherData],['water',waterData],['fires',fireData]]){
    const el=$('#'+name+'-data');el.querySelectorAll('.area-warning').forEach(e=>e.remove());if(!data)continue;
    const other=name==='weather'?C.distance(c,data.location)>2:c.lat<data.bounds.south||c.lat>data.bounds.north||c.lng<data.bounds.west||c.lng>data.bounds.east;
    if(other){const p=document.createElement('p');p.className='different-source-area area-warning';p.textContent='Мапу переміщено. Ці дані стосуються раніше завантаженої ділянки.';el.prepend(p);}
  }
}
function networkSources(){
  const allowed=onlineAllowed();
  if(!allowed)for(const controller of requests.values())controller.abort();
  for(const [name,id]of Object.entries(sourceButtons)){const areaReady=name!=='water'||map.getZoom()>=11;$(id).disabled=!allowed||requests.has(name)||!areaReady;$(id).title=!allowed?'Щоб оновити, під’єднайтеся до мережі':!areaReady?'Спочатку виберіть населений пункт і збільште мапу':'Оновити дані';}
  $('#area-search').disabled=!allowed;$('#field-notice').hidden=allowed;updateSummary();
}
async function load(name,fn){
  if(!onlineAllowed()){toast('Щоб оновити дані, під’єднайтеся до мережі. Збережені дані доступні нижче.');return;}
  if(requests.has(name))return;
  const controller=new AbortController();requests.set(name,controller);
  const button=$(sourceButtons[name]);button.disabled=true;button.textContent='Завантаження…';button.setAttribute('aria-busy','true');
  const el=$('#'+name+'-data');el?.querySelectorAll('.load-error').forEach(e=>e.remove());
  try{await fn(controller.signal);}catch(e){if(!controller.signal.aborted){const error=e.name==='AbortError'?Error('Джерело не відповіло вчасно. Спробуйте пізніше.'):e;if(el)loadError(name,error);else $('#area-result').textContent=error.message;}}
  finally{requests.delete(name);button.textContent=buttonLabels[name];button.removeAttribute('aria-busy');networkSources();updateAreaNotices();}
}
function renderWeather(data,cached=false){
  const c=data.current,d=data.daily;
  if(!Number.isFinite(c?.temperature_2m)||!Array.isArray(d?.time)||!data.location||!Number.isFinite(Date.parse(data.fetchedAt)))throw Error('Неповні дані про погоду.');
  weatherData=data;
  $('#weather-data').innerHTML=`<div class="weather-current"><strong>${num(c.temperature_2m,1)}<small> °C</small></strong><span>Вологість ${num(c.relative_humidity_2m)}%<br>Вітер ${num(c.wind_speed_10m,1)} км/год · ${num(c.wind_direction_10m)}°</span></div><div class="weather-days">${d.time.slice(0,3).map((day,i)=>`<div><span>${esc(dateLabel(day))}</span><b>${num(d.temperature_2m_max?.[i],1)}°</b><small>${num(d.precipitation_sum?.[i],1)} мм опадів</small></div>`).join('')}</div><p class="source-note">Модель станом на ${esc(String(c.time).replace('T',' '))}, Київ.<br>Центр: ${num(data.location.lat,3)}, ${num(data.location.lng,3)}. Це розрахунок моделі, а не вимірювання на місці.</p>${sourceTime('weather',data,cached)}`;
  updateSummary();updateAreaNotices();
}
async function refreshWeather(){return load('weather',async signal=>{const c=map.getCenter(),data=await api('weather',{lat:c.lat.toFixed(3),lng:c.lng.toFixed(3)},signal);renderWeather(data);saveSource('weather',data);});}
function isWaterNode(p){return p.geometryType==='node'||p.id?.startsWith('osm-node-');}
const cancelWaterButton=document.createElement('button');
cancelWaterButton.className='btn small map-cancel-pick';cancelWaterButton.type='button';cancelWaterButton.textContent='Скасувати вибір точки';cancelWaterButton.hidden=true;$('#map-hint').after(cancelWaterButton);
window.ForestCancelMapClick=()=>{window.ForestMapClick=null;cancelWaterButton.hidden=true;$('#map-hint').textContent='Натисніть на мапу, щоб додати об’єкт';};
window.ForestBeginMapClick=(handler,hint)=>{window.ForestCancelMapClick();pickBase=false;$('#pick-base').textContent=state.baseSet?'Змінити на мапі':'Вибрати на мапі';window.ForestMapClick=handler;cancelWaterButton.hidden=false;$('#map-hint').textContent=hint;};
cancelWaterButton.onclick=window.ForestCancelMapClick;
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&window.ForestMapClick)window.ForestCancelMapClick();});
window.addEventListener('view-changed',e=>{if(e.detail!=='map')window.ForestCancelMapClick();});
function waterDraft(p,coords){
  const locatedByUser=!isWaterNode(p);
  const note=`Джерело: OpenStreetMap, ${p.url}. Тип: ${p.kind}. Доступ: ${p.access}. ${locatedByUser?'Можливе місце доступу користувач позначив на мапі.':'Координати об’єкта взято з OSM.'} Наявність води, місце забору та під’їзд не перевірено.`;
  const point={id:locatedByUser?'':p.id,name:p.name,type:'water',status:'needs',priority:'medium',lat:coords.lat,lng:coords.lng,owner:'',note:note.slice(0,1500),checkedAt:'',due:'',photo:''};
  openEditor(point);$('#editor-title').textContent=locatedByUser?'Додати місце доступу для перевірки':'Додати об’єкт OSM для перевірки';
}
function addWater(p){
  window.ForestCancelMapClick();
  const existing=isWaterNode(p)&&state.points.find(v=>v.id===p.id);if(existing){focusPoint(existing.id);return;}
  if(isWaterNode(p)){waterDraft(p,{lat:p.lat,lng:p.lng});return;}
  if(!Array.isArray(p.geometry)||!p.geometry.length){toast('У збереженої водойми немає контуру. Оновіть дані OSM, перш ніж вибирати місце доступу.');return;}
  setView('map');map.fitBounds(L.latLngBounds(p.geometry.flat()),{padding:[45,45],maxZoom:16});
  window.ForestBeginMapClick(coords=>{window.ForestCancelMapClick();waterDraft(p,coords);return true;},'Виберіть на мапі місце доступу до водойми');
  $('#map').scrollIntoView({block:'center',behavior:'smooth'});
  toast('Натисніть на мапі в місці, де потрібно перевірити доступ до води. Сам контур OSM не вказує місце забору.');
}
function renderWater(data,cached=false){
  if(!Array.isArray(data.points)||!data.bounds||!Number.isFinite(Date.parse(data.fetchedAt)))throw Error('Неповні дані OSM.');
  waterData=data;const listWasOpen=$('#water-data details')?.open;
  liveLayers.water.clearLayers();L.rectangle([[data.bounds.south,data.bounds.west],[data.bounds.north,data.bounds.east]],{color:'#277993',weight:1,dashArray:'4 6',fill:false,interactive:false}).addTo(liveLayers.water);
  const kindLabel={water:'Водойма',pond:'Ставок',lake:'Озеро',reservoir:'Водосховище',fire_hydrant:'Гідрант',water_tank:'Резервуар',suction_point:'Місце забору'};
  const legacyAreas=data.points.some(p=>!isWaterNode(p)&&(!Array.isArray(p.geometry)||!p.geometry.length));
  for(const p of data.points){
    if(isWaterNode(p)&&state.points.some(v=>v.id===p.id))continue;
    const node=isWaterNode(p),shape=Array.isArray(p.geometry)&&p.geometry.length?p.geometry:null;
    if(!node&&!shape)continue;
    const div=document.createElement('div');div.innerHTML=`<b>${esc(p.name)}</b><br>${esc(kindLabel[p.kind]||'Водний об’єкт')} · OSM<br>${node?'Координати об’єкта OSM.':'Контур об’єкта OSM; місце доступу не вказано.'}<br>Під’їзд і наявність води не перевірено.<br>Зміни на мапі: ${esc(stamp(p.lastEdited))}<br><a href="${esc(p.url)}" target="_blank" rel="noopener">Відкрити об’єкт в OSM ↗</a><br><button class="btn primary small popup-button">${node?'Додати для перевірки':'Вказати місце доступу'}</button>`;
    div.querySelector('button').onclick=()=>addWater(p);
    if(node){L.marker([p.lat,p.lng],{title:p.name,alt:p.name,icon:L.divIcon({className:'marker-wrap',html:'<span class="source-map-marker">≈</span>',iconSize:[26,26],iconAnchor:[13,13]})}).addTo(liveLayers.water).bindPopup(div);continue;}
    const ring=shape.length===1?shape[0]:null,closed=ring?.length>=4&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1];
    const options={color:'#277993',weight:2,opacity:.9,fillColor:'#4cabc5',fillOpacity:.2,bubblingMouseEvents:false};
    (closed?L.polygon(ring,options):L.polyline(shape,options)).addTo(liveLayers.water).bindPopup(div);
  }
$('#water-data').innerHTML=`<p class="source-number"><b>${data.points.length}</b> ${C.plural(data.points.length,{one:'водний об’єкт',few:'водні об’єкти',many:'водних об’єктів',other:'водних об’єктів'})} на завантаженій ділянці</p><p class="source-note">Пунктиром позначено межі пошуку. Блакитні лінії — контури водойм OSM, порожні кружки — точкові об’єкти OSM. Для водойми вкажіть місце доступу на мапі. Наявність води та під’їзд не перевірено.${legacyAreas?' У збереженій копії немає контурів: оновіть дані OSM.':''}${data.truncated?' Показано перші 200 об’єктів; збільште потрібну ділянку.':''}</p>${sourceTime('water',data,cached)}`;
  const list=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Список об’єктів';list.append(summary);list.open=!!listWasOpen;
  for(const p of data.points){const b=document.createElement('button');b.className='source-list-item';b.textContent=p.name+(state.points.some(v=>v.id===p.id)?' → Відкрити запис':isWaterNode(p)?' → Додати для перевірки':' → Вказати місце доступу');b.disabled=!isWaterNode(p)&&(!Array.isArray(p.geometry)||!p.geometry.length);b.onclick=()=>addWater(p);list.append(b);}
  $('#water-data').append(list);toggleLayer('water');updateSummary();updateAreaNotices();
}
function renderFires(data,cached=false){
  if(!Array.isArray(data.points)||!data.bounds||!Number.isInteger(data.count)||!Number.isFinite(Date.parse(data.fetchedAt)))throw Error('Неповні дані NASA.');
  fireData=data;liveLayers.fires.clearLayers();L.rectangle([[data.bounds.south,data.bounds.west],[data.bounds.north,data.bounds.east]],{color:'#b34228',weight:1,dashArray:'4 8',fill:false,interactive:false}).addTo(liveLayers.fires);
  for(const p of data.points){
    const old=Date.now()-Date.parse(p.observedAt)>24*3600000;
    const dot=L.marker([p.lat,p.lng],{title:'Теплова аномалія NASA',alt:'Теплова аномалія NASA',icon:L.divIcon({className:'marker-wrap',html:`<span class="source-map-marker fire ${old?'old-observation':''}">✧</span>`,iconSize:[26,26],iconAnchor:[13,13]})}).addTo(liveLayers.fires);
    const div=document.createElement('div');div.innerHTML=`<b>Супутникова теплова аномалія</b><br>${esc(stamp(p.observedAt))} · Київ${old?'<br>Спостереження старше 24 годин.':''}<br>VIIRS S-NPP · рівень впевненості: ${esc(({nominal:'звичайний',high:'високий',low:'низький'})[p.confidence]||p.confidence)}<br>FRP: ${num(p.frp,1)} МВт<br>Не підтверджує лісову пожежу.<br><button class="btn small popup-button">Створити запис для перевірки</button>`;
    div.querySelector('button').onclick=()=>{openEditor(null,{lat:p.lat,lng:p.lng});$('#point-name').value='Перевірити супутникову теплову аномалію';$('#point-type').value='hotspot';$('#point-status').value='needs';$('#point-priority').value='high';$('#point-note').value=`NASA FIRMS, VIIRS S-NPP. Спостереження: ${p.observedAt}. Рівень впевненості: ${p.confidence}, FRP ${p.frp} МВт. Теплова аномалія НЕ підтверджує лісову пожежу. Потрібна перевірка. Джерело: ${data.sourceUrl}`;editorBaseline=editorSnapshot();};dot.bindPopup(div);
  }
  const stale=data.latestObservation&&Date.now()-Date.parse(data.latestObservation)>36*3600000;
  $('#fires-data').innerHTML=`<p class="source-number"><b>${data.count}</b> ${C.plural(data.count,{one:'супутникова позначка',few:'супутникові позначки',many:'супутникових позначок',other:'супутникових позначок'})} у завантажених межах${data.truncated?' (показано перші 1500)':''}</p><p class="source-note">${data.count?'Помаранчевий контур — завантажена ділянка, маркери — спостереження.':'У цьому наборі позначок не знайдено. Це не означає, що пожеж немає.'}<br>Європа · лише VIIRS S-NPP. Останнє спостереження: ${esc(stamp(data.latestObservation))}, Київ.</p>${stale?'<p class="source-error">Набір містить застарілі спостереження. Не вважайте його поточною обстановкою.</p>':''}${sourceTime('fires',data,cached)}`;
  toggleLayer('fires');updateSummary();updateAreaNotices();
}
function toggleLayer(name){const enabled=$('#'+name+'-visible').checked;writePreference('forest-layer-'+name,enabled?'1':'0');if(enabled&&!map.hasLayer(liveLayers[name]))liveLayers[name].addTo(map);else if(!enabled&&map.hasLayer(liveLayers[name]))map.removeLayer(liveLayers[name]);}
$('#weather-refresh').onclick=refreshWeather;
for(const name of ['water','fires']){$('#'+name+'-visible').checked=readLocal('forest-layer-'+name)!=='0';$('#'+name+'-visible').onchange=()=>toggleLayer(name);}
$('#water-refresh').onclick=()=>{if(map.getZoom()<11){toast('Виберіть місто або збільште потрібну ділянку до рівня вулиць.');return;}return load('water',async signal=>{const c=map.getCenter(),data=await api('water',{lat:c.lat.toFixed(3),lng:c.lng.toFixed(3)},signal);renderWater(data);saveSource('water',data);toast('Об’єкти OSM завантажено. Виберіть маркер або запис у списку.');});};
$('#fires-refresh').onclick=()=>load('fires',async signal=>{const b=map.getBounds(),data=await api('fires',{south:b.getSouth().toFixed(3),west:b.getWest().toFixed(3),north:b.getNorth().toFixed(3),east:b.getEast().toFixed(3)},signal);renderFires(data);saveSource('fires',data);});
$('#find-area').onclick=()=>load('places',async signal=>{const el=$('#area-result'),q=$('#area-search').value.trim();el.textContent='';if(q.length<2||q.length>100)throw Error('Введіть назву довжиною від 2 до 100 символів.');const data=await api('places',{q},signal);if(!data.results.length){el.textContent='Нічого не знайдено. Спробуйте іншу назву.';return;}for(const p of data.results){if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng))continue;const b=document.createElement('button');b.className='btn small';b.textContent=[p.name,p.region,p.country].filter(Boolean).join(', ');b.onclick=()=>{map.setView([p.lat,p.lng],13);el.textContent=[p.name,p.country].filter(Boolean).join(', ');refreshWeather();};el.append(b);}});
$('#area-search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#find-area').click();}};
for(const [name,renderer]of [['weather',renderWeather],['water',renderWater],['fires',renderFires]]){const data=readSource(name);if(data){try{renderer(data,true);}catch{}}}
const oldBackup=readLocal('forest-watch-before-live');if(oldBackup){const b=document.createElement('button');b.className='btn';b.textContent='Завантажити журнал перед оновленням';b.onclick=()=>downloadFile(oldBackup,'forest-watch-before-live.json','application/json');$('#help-dialog .help-content').append(b);}
map.on('moveend',()=>{updateAreaNotices();networkSources();});
window.addEventListener('journal-changed',()=>{if(waterData)renderWater(waterData,true);});
for(const event of ['field-mode-changed','online','offline'])window.addEventListener(event,networkSources);
networkSources();if(onlineAllowed())refreshWeather();
