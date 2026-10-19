'use strict';
const PLACE_BOUNDS=[[44.2,21.9],[52.5,40.3]],placeLayer=L.layerGroup().addTo(map),placeName=p=>p[2]||p[1],placeNorm=s=>String(s||'').toLocaleLowerCase('uk').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’'`]/g,'').trim();
let uaPlaces=[],placeSearchTimer;
function searchPlaces(raw){
  const q=placeNorm(raw),results=$('#location-results');results.replaceChildren();if(q.length<2)return;
  const found=[];
  for(const p of uaPlaces){const names=[p[1],p[2],...p[3].split('|')].map(placeNorm),region=placeNorm(p[4]);let score=0;
    if(names.includes(q))score=0;else if(names.some(v=>v.startsWith(q)))score=1;else if(names.some(v=>v.includes(q)))score=2;else if(region.includes(q))score=3;else continue;
    found.push({p,score});}
  found.sort((a,b)=>a.score-b.score||b.p[8]-a.p[8]);
  for(const {p} of found.slice(0,12)){const item=document.createElement('button');item.type='button';item.className='location-result';item.setAttribute('role','option');item.innerHTML=`<strong>${esc(placeName(p))}</strong><span>${esc(p[4]||'Украина')}${p[1]&&p[1]!==placeName(p)?' · '+esc(p[1]):''}</span>`;item.onclick=()=>{map.setView([p[5],p[6]],13);$('#location-search').value=placeName(p);results.replaceChildren();$('#location-status').textContent=`${placeName(p)}, ${p[4]||'Украина'} · ориентир GeoNames. Точку проверки укажите на карте.`;refreshWeather();};results.append(item);}
  $('#location-status').textContent=found.length?`Найдено: ${Math.min(found.length,12)} из ${found.length}. Выберите место.`:'По этому запросу ничего не найдено. Попробуйте украинское название или латиницу.';
}
function drawPlaces(){
  placeLayer.clearLayers();if(!uaPlaces.length)return;
  const z=map.getZoom();
  if(z>=9){$('#place-count').textContent='Населённые пункты — в поиске выше';return;}
  const b=map.getBounds(),isVisible=p=>b.contains([p[5],p[6]]);
  let items=uaPlaces.filter(p=>isVisible(p)&&(p[7]==='PPLC'||p[7]==='PPLA'||(z>=7&&(p[7]==='PPLA2'||p[7]==='PPLA3'))));
  items.sort((a,b)=>b[8]-a[8]);if(items.length>4000)items=items.slice(0,4000);
  for(const p of items)L.circleMarker([p[5],p[6]],{radius:p[7]==='PPLC'||p[7]==='PPLA'?4:2.5,color:'#f9fff8',weight:1,fillColor:'#245844',fillOpacity:.92,interactive:true,bubblingMouseEvents:false}).bindPopup(`<b>${esc(placeName(p))}</b><br>${esc(p[4]||'Украина')}<br>Ориентир населённого пункта · GeoNames<br><button class="btn primary small place-focus">Приблизить карту</button>`).on('popupopen',e=>e.popup.getElement().querySelector('.place-focus').onclick=()=>map.setView([p[5],p[6]],13)).addTo(placeLayer);
  $('#place-count').textContent=`${items.length.toLocaleString('ru')} городских ориентиров · GeoNames`;
}
$('#location-search').addEventListener('input',e=>{clearTimeout(placeSearchTimer);placeSearchTimer=setTimeout(()=>searchPlaces(e.target.value),100);});
$('#location-search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const first=$('#location-results .location-result');if(first)first.click();}});
$('#location-search').addEventListener('blur',()=>setTimeout(()=>$('#location-results').replaceChildren(),150));
$('#ukraine-view').onclick=()=>{map.fitBounds(L.latLngBounds(PLACE_BOUNDS),{padding:[8,8]});$('#location-search').value='';$('#location-results').replaceChildren();$('#location-status').textContent=`Вся Украина · ${uaPlaces.length.toLocaleString('ru')} населённых пунктов в поиске.`;};
map.on('moveend',drawPlaces);
fetch('ua-places.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(d=>{if(d.source!=='GeoNames'||!Array.isArray(d.places))throw Error('Неверный формат списка');uaPlaces=d.places;$('#location-status').textContent=`По всей Украине доступно ${uaPlaces.length.toLocaleString('ru')} населённых пунктов: города, посёлки и сёла. Источник: GeoNames.`;drawPlaces();}).catch(()=>{$('#location-status').textContent='Список мест не загрузился. Проверьте интернет и обновите страницу.';});
