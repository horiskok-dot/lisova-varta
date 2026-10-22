'use strict';
(()=>{
  const layer=L.layerGroup(),toolbar=document.createElement('div');
  toolbar.className='water-sites-toolbar';
  toolbar.innerHTML='<div class="water-sites-actions"><label class="layer-toggle"><input id="water-sites-visible" type="checkbox"> Місця перевірки води</label><button class="btn small" id="dnipro-water" type="button">Водойми Дніпра</button><button class="btn small" id="water-nearby" type="button">Знайти водойми поруч</button></div><p id="water-sites-status" class="location-status" role="status">Завантаження водної інфраструктури OSM…</p><details id="water-sites-list"><summary>Місця в поточній ділянці</summary><div id="water-sites-items"></div></details>';
  $('.location-toolbar').append(toolbar);
  const enabled=$('#water-sites-visible'),status=$('#water-sites-status'),list=$('#water-sites-list'),items=$('#water-sites-items');
  enabled.checked=readLocal('forest-water-sites')!=='0';
  let snapshot=null,popupOpen=false,pendingRender=false;const markers=new Map();
  const kinds={fire_hydrant:'Гідрант',suction_point:'Місце забору води',water_tank:'Резервуар'};
  function render(){
    if(popupOpen){pendingRender=true;return;}
    layer.clearLayers();markers.clear();items.replaceChildren();list.hidden=true;
    if(!snapshot)return;
    if(!enabled.checked){if(map.hasLayer(layer))map.removeLayer(layer);status.textContent='Шар водної інфраструктури приховано.';return;}
    if(!map.hasLayer(layer))layer.addTo(map);
    const origin=`${snapshot.points.length.toLocaleString('uk')} об’єктів OSM в Україні · знімок ${stamp(snapshot.fetchedAt)}`;
    if(map.getZoom()<11){status.textContent=origin+'. Виберіть місто або збільште мапу, щоб побачити місця перевірки.';return;}
    const b=map.getBounds(),center=map.getCenter();
    const visible=snapshot.points.filter(p=>p.lat>=b.getSouth()&&p.lat<=b.getNorth()&&p.lng>=b.getWest()&&p.lng<=b.getEast()).sort((a,b)=>C.distance(center,a)-C.distance(center,b));
    const clustered=map.getZoom()<16;
    status.textContent=visible.length?`${C.countLabel(visible.length,{one:'місце',few:'місця',many:'місць'})} у видимій ділянці. ${clustered?'Кола з числом — групи; натисніть, щоб збільшити.':'Знак ? — стан не перевірено.'}${!clustered&&visible.length>250?' Показано 250 найближчих до центру; збільште мапу.':''} ${origin}.`:`У цій ділянці немає точкових об’єктів у знімку OSM. Це не означає відсутність води: натисніть «Знайти водойми поруч». ${origin}.`;
    list.hidden=!visible.length;
    const groups=new Map(),scale=256*2**map.getZoom()/64;
    for(const p of clustered?visible:visible.slice(0,250)){
      const sin=Math.sin(p.lat*Math.PI/180),key=clustered?`${Math.floor((p.lng+180)/360*scale)}:${Math.floor((.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale)}`:p.id;
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(p);
    }
    for(const group of groups.values()){
      if(group.length>1){
        const lat=group.reduce((sum,p)=>sum+p.lat,0)/group.length,lng=group.reduce((sum,p)=>sum+p.lng,0)/group.length;
        L.marker([lat,lng],{title:`${group.length} об’єктів OSM — збільшити`,alt:`Група: ${group.length} місць перевірки води`,icon:L.divIcon({className:'marker-wrap',html:`<span class="inspection-cluster">${group.length}</span>`,iconSize:[38,38],iconAnchor:[19,19]})}).addTo(layer).on('click',()=>map.setView([lat,lng],Math.min(18,map.getZoom()+2)));
        continue;
      }
      const p=group[0];
      const saved=state.points.find(v=>v.id===p.id),title=kinds[p.kind]||p.name;
      const div=document.createElement('div');
      div.innerHTML=`<b>${esc(p.name)}</b><br>${esc(title)} · OpenStreetMap<br>${saved?esc(C.STATUS[saved.status]):'Потрібно перевірити на місці'}<br>Доступ у OSM: ${esc(p.access)}<br>Редагування OSM: ${esc(stamp(p.lastEdited))}<br><a href="${esc(p.url)}" target="_blank" rel="noopener">Джерело в OSM ↗</a><br><button class="btn primary small popup-button">${saved?'Відкрити запис':'Додати для перевірки'}</button>`;
      div.querySelector('button').onclick=()=>addWater(p);
      const marker=L.marker([p.lat,p.lng],{title:p.name+' — '+(saved?C.STATUS[saved.status]:'не перевірено'),alt:p.name+' — місце перевірки води',icon:L.divIcon({className:'marker-wrap',html:`<span class="inspection-marker ${saved?'recorded':''}">${saved?'≈':'?'}</span>`,iconSize:[30,30],iconAnchor:[15,15]})}).addTo(layer).bindPopup(div);
      markers.set(p.id,marker);
    }
    for(const p of visible.slice(0,50)){const button=document.createElement('button');button.type='button';button.className='source-list-item';button.textContent=`${p.name} · ${num(C.distance(center,p),1)} км · ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;button.onclick=()=>{map.closePopup?.();setView('map');map.setView([p.lat,p.lng],16,{animate:false});markers.get(p.id)?.openPopup?.();};items.append(button);}
    if(visible.length>50){const note=document.createElement('p');note.className='source-note';note.textContent='У списку перші 50 місць. Збільште потрібну ділянку, щоб звузити вибір.';items.append(note);}
  }
  enabled.onchange=()=>{writePreference('forest-water-sites',enabled.checked?'1':'0');map.closePopup?.();popupOpen=false;render();};
  $('#dnipro-water').onclick=()=>showDnipro(true,true);
  const nearby=$('#water-nearby');
  nearby.onclick=()=>{sourcePanel.open=true;$('#water-refresh').click();sourcePanel.scrollIntoView({block:'start',behavior:'auto'});};
  function syncNearby(){nearby.disabled=!onlineAllowed()||map.getZoom()<11||requests.has('water');nearby.title=map.getZoom()<11?'Спочатку виберіть місто або збільште мапу':'Завантажити контури водойм поблизу центру мапи';}
  map.on('popupopen',()=>{popupOpen=true;});
  map.on('popupclose',()=>{popupOpen=false;if(pendingRender){pendingRender=false;queueMicrotask(render);}});
  map.on('moveend',()=>{if(popupOpen)pendingRender=true;else render();syncNearby();});
  for(const event of ['field-mode-changed','online','offline'])window.addEventListener(event,syncNearby);
  window.addEventListener('journal-changed',render);
  fetch('water-sites.json').then(async response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.json();}).then(data=>{
    if(data.source!=='OpenStreetMap'||!Array.isArray(data.points)||!Number.isFinite(Date.parse(data.fetchedAt)))throw Error('Неповний знімок OSM');
    snapshot={...data,points:data.points.filter(p=>/^osm-node-\d+$/.test(p.id)&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&kinds[p.kind]&&/^https:\/\/www\.openstreetmap\.org\/node\/\d+$/.test(p.url))};render();
  }).catch(()=>{status.textContent='Не вдалося відкрити знімок OSM. Можна завантажити водойми поруч через джерела даних.';});
  syncNearby();

  // A template in the existing note field survives JSON export and app transfers.
  const checklist=document.createElement('button');checklist.type='button';checklist.id='water-checklist';checklist.className='btn small';checklist.textContent='Додати чекліст огляду води';
  $('#point-note').closest('label').after(checklist);
  const text='Чекліст огляду води:\n• Наявність і рівень води: не перевірено\n• Доступ до берега / гідранта: не перевірено\n• Проїзд, шлагбаум, місце розвороту: не перевірено\n• Забруднення, замулення, перешкоди: не перевірено\n• Контакт відповідального та фото: не додано';
  checklist.onclick=()=>{const note=$('#point-note');if(note.value.includes('Чекліст огляду води:')){note.focus();return;}const combined=[note.value.trim(),text].filter(Boolean).join('\n\n');if(combined.length>1500){toast('Для чекліста бракує місця в нотатці. Скоротіть текст.');return;}note.value=combined;note.dispatchEvent(new Event('input',{bubbles:true}));note.focus();};
  function syncChecklist(){checklist.hidden=$('#point-type').value!=='water';}
  $('#point-type').addEventListener('change',syncChecklist);
  new MutationObserver(syncChecklist).observe($('#editor'),{attributes:true,attributeFilter:['open']});
  syncChecklist();
})();
