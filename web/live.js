'use strict';
const liveLayers={water:L.layerGroup().addTo(map),fires:L.layerGroup().addTo(map)};
const requests=new Map();
let waterData=null,fireData=null,weatherData=null;
const stamp=s=>Number.isFinite(Date.parse(s))?new Intl.DateTimeFormat('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Kyiv'}).format(new Date(s)):'неизвестно';
const num=(v,d=0)=>Number.isFinite(v)?new Intl.NumberFormat('ru',{maximumFractionDigits:d,minimumFractionDigits:d}).format(v):'—';
const sourceButtons={weather:'#weather-refresh',water:'#water-refresh',fires:'#fires-refresh',places:'#find-area'};
const buttonLabels={weather:'Обновить',water:'Найти на карте',fires:'Загрузить',places:'Найти'};
const onlineAllowed=()=>navigator.onLine&&!fieldMode;
const sourcePanel=$('#source-panel');
sourcePanel.open=readLocal('forest-sources-open')==='1';
sourcePanel.addEventListener('toggle',()=>{writePreference('forest-sources-open',sourcePanel.open?'1':'0');$('.live-pill').textContent=sourcePanel.open?'Свернуть ↑':'Открыть источники ↓';});
$('#sources-open').onclick=()=>{sourcePanel.open=true;sourcePanel.scrollIntoView({block:'start',behavior:'auto'});};

async function getJson(url,parent,timeout=18000){
  const controller=new AbortController(),abort=()=>controller.abort();
  if(parent.aborted)throw new DOMException('Отменено','AbortError');
  parent.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(abort,timeout);
  try{const r=await fetch(url,{signal:controller.signal,cache:'no-cache'});let data;try{data=await r.json();}catch{throw Error('Сервис вернул неожиданный ответ. Повторите позже.');}if(!r.ok)throw Error(r.status===429?'Лимит запросов источника. Подождите минуту.':data.error||data.reason||'Источник недоступен (HTTP '+r.status+').');return data;}
  finally{clearTimeout(timer);parent.removeEventListener('abort',abort);}
}
async function api(name,params,signal){
  if(!onlineAllowed())throw Error('Отключите полевой режим или подключитесь к сети для обновления.');
  if(name==='weather'){
    try{
      const q=new URLSearchParams({latitude:params.lat,longitude:params.lng,current:'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m',daily:'temperature_2m_max,precipitation_sum,wind_speed_10m_max',timezone:'Europe/Kyiv',forecast_days:'3'});
      const d=await getJson('https://api.open-meteo.com/v1/forecast?'+q,signal,12000);
      if(!Number.isFinite(d.current?.temperature_2m)||!Array.isArray(d.daily?.time))throw Error('Неполные погодные данные.');
      return {source:'Open-Meteo',sourceUrl:'https://open-meteo.com/',fetchedAt:new Date().toISOString(),location:{lat:Number(params.lat),lng:Number(params.lng)},timezone:d.timezone,current:d.current,daily:d.daily};
    }catch(e){if(signal.aborted)throw e;}
  }
  if(name==='places'){
    try{const d=await getJson('https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name:params.q,count:'5',language:'ru',format:'json'}),signal,12000);return {results:(d.results||[]).map(p=>({name:p.name,region:p.admin1||'',country:p.country||'',lat:p.latitude,lng:p.longitude}))};}
    catch(e){if(signal.aborted)throw e;}
  }
  return getJson('/api/'+name+'?'+new URLSearchParams(params),signal,28000);
}
function saveSource(name,data){try{localStorage.setItem('forest-source-'+name,JSON.stringify(data));}catch{toast('Данные получены, но копию без сети сохранить не удалось: память заполнена.');}}
function readSource(name){try{return JSON.parse(readLocal('forest-source-'+name)||'null');}catch{return null;}}
function sourceTime(name,data,cached=false){const limit={weather:3600000,water:7*86400000,fires:6*3600000}[name];const old=Date.now()-Date.parse(data.fetchedAt)>limit;return `<p class="source-time">${cached?'Сохранённая копия':'Получено'}: ${esc(stamp(data.fetchedAt))} · Киев</p>${old?'<p class="source-error age-warning">Копия устарела. Обновите источник перед использованием.</p>':''}`;}
function loadError(name,error){const el=$('#'+name+'-data');el.querySelectorAll('.load-error').forEach(e=>e.remove());const p=document.createElement('p');p.className='source-error load-error';p.textContent='Не обновлено: '+error.message;el.prepend(p);}
function updateSummary(){const bits=[];if(weatherData)bits.push(num(weatherData.current?.temperature_2m,1)+' °C');if(waterData)bits.push('OSM: '+waterData.points.length+' объектов');if(fireData)bits.push('NASA: '+fireData.count+' отметок');$('#source-summary').textContent=(fieldMode?'Сохранённые данные · ':'')+(bits.join(' · ')||'Погода · Вода OSM · Спутниковые отметки NASA');}
function updateAreaNotices(){
  const c=map.getCenter();
  for(const [name,data]of [['weather',weatherData],['water',waterData],['fires',fireData]]){
    const el=$('#'+name+'-data');el.querySelectorAll('.area-warning').forEach(e=>e.remove());if(!data)continue;
    const other=name==='weather'?C.distance(c,data.location)>2:c.lat<data.bounds.south||c.lat>data.bounds.north||c.lng<data.bounds.west||c.lng>data.bounds.east;
    if(other){const p=document.createElement('p');p.className='different-source-area area-warning';p.textContent='Карта перемещена. Эти данные относятся к ранее загруженному участку.';el.prepend(p);}
  }
}
function networkSources(){
  const allowed=onlineAllowed();
  if(!allowed)for(const controller of requests.values())controller.abort();
  for(const [name,id]of Object.entries(sourceButtons)){$(id).disabled=!allowed||requests.has(name);$(id).title=allowed?'':'Для обновления включите сеть';}
  $('#area-search').disabled=!allowed;$('#field-notice').hidden=allowed;updateSummary();
}
async function load(name,fn){
  if(!onlineAllowed()){toast('Для обновления включите сеть. Сохранённые данные доступны ниже.');return;}
  if(requests.has(name))return;
  const controller=new AbortController();requests.set(name,controller);
  const button=$(sourceButtons[name]);button.disabled=true;button.textContent='Загрузка…';button.setAttribute('aria-busy','true');
  const el=$('#'+name+'-data');el?.querySelectorAll('.load-error').forEach(e=>e.remove());
  try{await fn(controller.signal);}catch(e){if(!controller.signal.aborted){const error=e.name==='AbortError'?Error('Источник не ответил вовремя. Повторите позже.'):e;if(el)loadError(name,error);else $('#area-result').textContent=error.message;}}
  finally{requests.delete(name);button.textContent=buttonLabels[name];button.removeAttribute('aria-busy');networkSources();updateAreaNotices();}
}
function renderWeather(data,cached=false){
  const c=data.current,d=data.daily;
  if(!Number.isFinite(c?.temperature_2m)||!Array.isArray(d?.time)||!data.location||!Number.isFinite(Date.parse(data.fetchedAt)))throw Error('Неполные погодные данные.');
  weatherData=data;
  $('#weather-data').innerHTML=`<div class="weather-current"><strong>${num(c.temperature_2m,1)}<small> °C</small></strong><span>Влажность ${num(c.relative_humidity_2m)}%<br>Ветер ${num(c.wind_speed_10m,1)} км/ч · ${num(c.wind_direction_10m)}°</span></div><div class="weather-days">${d.time.slice(0,3).map((day,i)=>`<div><span>${esc(dateLabel(day))}</span><b>${num(d.temperature_2m_max?.[i],1)}°</b><small>${num(d.precipitation_sum?.[i],1)} мм осадков</small></div>`).join('')}</div><p class="source-note">Модель на ${esc(String(c.time).replace('T',' '))}, Киев.<br>Центр: ${num(data.location.lat,3)}, ${num(data.location.lng,3)}. Это расчёт модели, не замер на месте.</p>${sourceTime('weather',data,cached)}`;
  updateSummary();updateAreaNotices();
}
async function refreshWeather(){return load('weather',async signal=>{const c=map.getCenter(),data=await api('weather',{lat:c.lat.toFixed(3),lng:c.lng.toFixed(3)},signal);renderWeather(data);saveSource('weather',data);});}
function addWater(p){
  const existing=state.points.find(v=>v.id===p.id);if(existing){focusPoint(existing.id);return;}
  const note=`Источник: OpenStreetMap, ${p.url}. Тип: ${p.kind}. Доступ: ${p.access}. Координаты указывают центр объекта. Наличие воды, точка забора и проезд НЕ проверены.`;
  const point={id:p.id,name:p.name,type:'water',status:'needs',priority:'medium',lat:p.lat,lng:p.lng,owner:'',note:note.slice(0,1500),checkedAt:'',due:'',photo:''};
  openEditor(point);$('#editor-title').textContent='Добавить объект из OSM';
}
function renderWater(data,cached=false){
  if(!Array.isArray(data.points)||!data.bounds||!Number.isFinite(Date.parse(data.fetchedAt)))throw Error('Неполные данные OSM.');
  waterData=data;const listWasOpen=$('#water-data details')?.open;
  liveLayers.water.clearLayers();L.rectangle([[data.bounds.south,data.bounds.west],[data.bounds.north,data.bounds.east]],{color:'#277993',weight:1,dashArray:'4 6',fill:false,interactive:false}).addTo(liveLayers.water);
  const kindLabel={water:'Водоём',pond:'Пруд',lake:'Озеро',reservoir:'Водохранилище',fire_hydrant:'Гидрант',water_tank:'Резервуар',suction_point:'Точка забора'};
  for(const p of data.points){
    if(state.points.some(v=>v.id===p.id))continue;
    const marker=L.marker([p.lat,p.lng],{title:p.name,alt:p.name,icon:L.divIcon({className:'marker-wrap',html:'<span class="source-map-marker">≈</span>',iconSize:[26,26],iconAnchor:[13,13]})}).addTo(liveLayers.water);
    const div=document.createElement('div');div.innerHTML=`<b>${esc(p.name)}</b><br>${esc(kindLabel[p.kind]||'Водный объект')} · OSM<br>Подъезд и вода не проверены.<br>Центр объекта, не точка забора.<br>Изменение карты: ${esc(stamp(p.lastEdited))}<br><a href="${esc(p.url)}" target="_blank" rel="noopener">Открыть объект в OSM ↗</a><br><button class="btn primary small popup-button">Добавить в журнал</button>`;
    div.querySelector('button').onclick=()=>addWater(p);marker.bindPopup(div);
  }
  $('#water-data').innerHTML=`<p class="source-number"><b>${data.points.length}</b> водных объектов в загруженном участке</p><p class="source-note">Синий контур — границы поиска. Наличие воды и подъезд не проверены.${data.truncated?' Показаны первые 200 объектов; приблизьте нужное место.':''}</p>${sourceTime('water',data,cached)}`;
  const list=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Список объектов';list.append(summary);list.open=!!listWasOpen;
  for(const p of data.points){const b=document.createElement('button');b.className='source-list-item';b.textContent=p.name+(state.points.some(v=>v.id===p.id)?' → Открыть запись':' → Добавить');b.onclick=()=>addWater(p);list.append(b);}
  $('#water-data').append(list);toggleLayer('water');updateSummary();updateAreaNotices();
}
function renderFires(data,cached=false){
  if(!Array.isArray(data.points)||!data.bounds||!Number.isInteger(data.count)||!Number.isFinite(Date.parse(data.fetchedAt)))throw Error('Неполные данные NASA.');
  fireData=data;liveLayers.fires.clearLayers();L.rectangle([[data.bounds.south,data.bounds.west],[data.bounds.north,data.bounds.east]],{color:'#b34228',weight:1,dashArray:'4 8',fill:false,interactive:false}).addTo(liveLayers.fires);
  for(const p of data.points){
    const old=Date.now()-Date.parse(p.observedAt)>24*3600000;
    const dot=L.marker([p.lat,p.lng],{title:'Термоаномалия NASA',alt:'Термоаномалия NASA',icon:L.divIcon({className:'marker-wrap',html:`<span class="source-map-marker fire ${old?'old-observation':''}">✧</span>`,iconSize:[26,26],iconAnchor:[13,13]})}).addTo(liveLayers.fires);
    const div=document.createElement('div');div.innerHTML=`<b>Спутниковая термоаномалия</b><br>${esc(stamp(p.observedAt))} · Киев${old?'<br>Наблюдение старше 24 часов.':''}<br>VIIRS S-NPP · уверенность: ${esc(({nominal:'обычная',high:'высокая',low:'низкая'})[p.confidence]||p.confidence)}<br>FRP: ${num(p.frp,1)} МВт<br>Не подтверждает лесной пожар.<br><button class="btn small popup-button">Создать запись для проверки</button>`;
    div.querySelector('button').onclick=()=>{openEditor(null,{lat:p.lat,lng:p.lng});$('#point-name').value='Проверить спутниковую термоаномалию';$('#point-type').value='hotspot';$('#point-status').value='needs';$('#point-priority').value='high';$('#point-note').value=`NASA FIRMS, VIIRS S-NPP. Наблюдение: ${p.observedAt}. Уверенность: ${p.confidence}, FRP ${p.frp} МВт. Термоаномалия НЕ подтверждает лесной пожар. Требуется проверка. Источник: ${data.sourceUrl}`;editorBaseline=editorSnapshot();};dot.bindPopup(div);
  }
  const stale=data.latestObservation&&Date.now()-Date.parse(data.latestObservation)>36*3600000;
  $('#fires-data').innerHTML=`<p class="source-number"><b>${data.count}</b> спутниковых отметок в загруженных границах${data.truncated?' (показаны первые 1500)':''}</p><p class="source-note">${data.count?'Оранжевый контур — загруженный участок, маркеры — наблюдения.':'Отметок в этой выгрузке не найдено. Это не означает, что пожаров нет.'}<br>Европа · только VIIRS S-NPP. Последнее наблюдение: ${esc(stamp(data.latestObservation))}, Киев.</p>${stale?'<p class="source-error">Выгрузка содержит старые наблюдения. Не считайте её текущей обстановкой.</p>':''}${sourceTime('fires',data,cached)}`;
  toggleLayer('fires');updateSummary();updateAreaNotices();
}
function toggleLayer(name){const enabled=$('#'+name+'-visible').checked;writePreference('forest-layer-'+name,enabled?'1':'0');if(enabled&&!map.hasLayer(liveLayers[name]))liveLayers[name].addTo(map);else if(!enabled&&map.hasLayer(liveLayers[name]))map.removeLayer(liveLayers[name]);}
$('#weather-refresh').onclick=refreshWeather;
for(const name of ['water','fires']){$('#'+name+'-visible').checked=readLocal('forest-layer-'+name)!=='0';$('#'+name+'-visible').onchange=()=>toggleLayer(name);}
$('#water-refresh').onclick=()=>load('water',async signal=>{const c=map.getCenter(),data=await api('water',{lat:c.lat.toFixed(3),lng:c.lng.toFixed(3)},signal);renderWater(data);saveSource('water',data);toast('Объекты OSM загружены. Выберите маркер или запись в списке.');});
$('#fires-refresh').onclick=()=>load('fires',async signal=>{const b=map.getBounds(),data=await api('fires',{south:b.getSouth().toFixed(3),west:b.getWest().toFixed(3),north:b.getNorth().toFixed(3),east:b.getEast().toFixed(3)},signal);renderFires(data);saveSource('fires',data);});
$('#find-area').onclick=()=>load('places',async signal=>{const el=$('#area-result'),q=$('#area-search').value.trim();el.textContent='';if(q.length<2||q.length>100)throw Error('Введите название из 2–100 символов.');const data=await api('places',{q},signal);if(!data.results.length){el.textContent='Ничего не найдено. Попробуйте другое название.';return;}for(const p of data.results){if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng))continue;const b=document.createElement('button');b.className='btn small';b.textContent=[p.name,p.region,p.country].filter(Boolean).join(', ');b.onclick=()=>{map.setView([p.lat,p.lng],13);el.textContent=[p.name,p.country].filter(Boolean).join(', ');refreshWeather();};el.append(b);}});
$('#area-search').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#find-area').click();}};
for(const [name,renderer]of [['weather',renderWeather],['water',renderWater],['fires',renderFires]]){const data=readSource(name);if(data){try{renderer(data,true);}catch{}}}
const oldBackup=readLocal('forest-watch-before-live');if(oldBackup){const b=document.createElement('button');b.className='btn';b.textContent='Скачать журнал до обновления';b.onclick=()=>downloadFile(oldBackup,'forest-watch-before-live.json','application/json');$('#help-dialog .help-content').append(b);}
map.on('moveend',updateAreaNotices);
window.addEventListener('journal-changed',()=>{if(waterData)renderWater(waterData,true);});
for(const event of ['field-mode-changed','online','offline'])window.addEventListener(event,networkSources);
networkSources();if(onlineAllowed()){refreshWeather();if(!waterData&&state.points.length===0)$('#water-refresh').click();}
