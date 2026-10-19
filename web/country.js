'use strict';
const PLACE_BOUNDS=[[44.2,21.9],[52.5,40.3]],placeLayer=L.layerGroup().addTo(map),placeName=p=>p[2]||p[1],placeNorm=s=>String(s||'').toLocaleLowerCase('uk').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’'`]/g,'').trim();
let uaPlaces=[],placeSearchTimer,placeActive=-1;
function clearPlaces(){placeActive=-1;$('#location-results').replaceChildren();$('#location-search').setAttribute('aria-expanded','false');$('#location-search').removeAttribute('aria-activedescendant');}
function activatePlace(index){const items=[...$('#location-results').children];if(!items.length)return;placeActive=(index+items.length)%items.length;items.forEach((item,i)=>{item.classList.toggle('active',i===placeActive);item.setAttribute('aria-selected',String(i===placeActive));});$('#location-search').setAttribute('aria-activedescendant',items[placeActive].id);items[placeActive].scrollIntoView({block:'nearest'});}
function searchPlaces(raw){
  const q=placeNorm(raw),results=$('#location-results');clearPlaces();if(q.length<2)return;
  const found=[];
  for(const p of uaPlaces){const names=[p[1],p[2],...p[3].split('|')].map(placeNorm),region=placeNorm(p[4]);let score=0;
    if(names.includes(q))score=0;else if(names.some(v=>v.startsWith(q)))score=1;else if(names.some(v=>v.includes(q)))score=2;else if(region.includes(q))score=3;else continue;
    found.push({p,score});}
  found.sort((a,b)=>a.score-b.score||b.p[8]-a.p[8]);
  for(const {p} of found.slice(0,12)){const item=document.createElement('button');item.type='button';item.className='location-result';item.id='place-option-'+p[0];item.setAttribute('role','option');item.setAttribute('aria-selected','false');item.innerHTML=`<strong>${esc(placeName(p))}</strong><span>${esc(p[4]||'Україна')}${p[1]&&p[1]!==placeName(p)?' · '+esc(p[1]):''}</span>`;item.onclick=()=>{map.setView([p[5],p[6]],13);$('#location-search').value=placeName(p);$('#map-region-title').textContent=placeName(p);clearPlaces();$('#location-status').textContent=`${placeName(p)}, ${p[4]||'Україна'} · орієнтир GeoNames. Місце перевірки вкажіть на мапі.`;window.dispatchEvent(new CustomEvent('forest:place-selected',{detail:{id:p[0]}}));refreshWeather();};results.append(item);}
  $('#location-search').setAttribute('aria-expanded',String(found.length>0));
  $('#location-status').textContent=found.length?`Знайдено: ${Math.min(found.length,12)} из ${found.length}. Виберіть місце.`:'За цим запитом нічого не знайдено. Спробуйте українську назву або латиницю.';
}
function drawPlaces(){
  placeLayer.clearLayers();if(!uaPlaces.length)return;
  const z=map.getZoom();
  if(z>=9){$('#place-count').textContent='Населені пункти — у пошуку вище';return;}
  const b=map.getBounds(),isVisible=p=>b.contains([p[5],p[6]]);
  let items=uaPlaces.filter(p=>isVisible(p)&&(p[7]==='PPLC'||p[7]==='PPLA'||(z>=7&&(p[7]==='PPLA2'||p[7]==='PPLA3'))));
  items.sort((a,b)=>b[8]-a[8]);if(items.length>4000)items=items.slice(0,4000);
  for(const p of items)L.circleMarker([p[5],p[6]],{radius:p[7]==='PPLC'||p[7]==='PPLA'?4:2.5,color:'#f9fff8',weight:1,fillColor:'#245844',fillOpacity:.92,interactive:true,bubblingMouseEvents:false}).bindPopup(`<b>${esc(placeName(p))}</b><br>${esc(p[4]||'Україна')}<br>Орієнтир населеного пункту · GeoNames<br><button class="btn primary small place-focus">Збільшити мапу</button>`).on('popupopen',e=>e.popup.getElement().querySelector('.place-focus').onclick=()=>map.setView([p[5],p[6]],13)).addTo(placeLayer);
  $('#place-count').textContent=`${items.length.toLocaleString('uk')} міських орієнтирів · GeoNames`;
}
$('#location-search').addEventListener('input',e=>{clearTimeout(placeSearchTimer);placeSearchTimer=setTimeout(()=>searchPlaces(e.target.value),100);});
$('#location-search').addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#location-results').children.length){e.stopPropagation();e.preventDefault();}clearTimeout(placeSearchTimer);clearPlaces();return;}if(['ArrowDown','ArrowUp','Enter'].includes(e.key)){e.preventDefault();clearTimeout(placeSearchTimer);if(!$('#location-results').children.length)searchPlaces(e.target.value);if(e.key==='Enter')$('#location-results').children[Math.max(0,placeActive)]?.click();else activatePlace(placeActive<0?(e.key==='ArrowDown'?0:$('#location-results').children.length-1):placeActive+(e.key==='ArrowDown'?1:-1));}});
$('.location-toolbar').addEventListener('focusout',()=>setTimeout(()=>{if(!$('.location-toolbar').contains(document.activeElement))clearPlaces();},100));
document.addEventListener('pointerdown',e=>{if(!$('.location-toolbar').contains(e.target))clearPlaces();});
$('#ukraine-view').onclick=()=>{map.fitBounds(L.latLngBounds(PLACE_BOUNDS),{padding:[8,8]});$('#location-search').value='';$('#map-region-title').textContent='Уся Україна';clearPlaces();$('#location-status').textContent=`Уся Україна · ${uaPlaces.length.toLocaleString('uk')} населених пунктів у пошуку.`;};
map.on('moveend',drawPlaces);
fetch('ua-places.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(d=>{if(d.source!=='GeoNames'||!Array.isArray(d.places))throw Error('Неправильний формат списку');uaPlaces=d.places;$('#location-status').textContent=`По всій Україні доступно ${uaPlaces.length.toLocaleString('uk')} населених пунктів: міста, селища та села. Джерело: GeoNames.`;drawPlaces();}).catch(()=>{$('#location-status').textContent='Не вдалося завантажити список населених пунктів. Перевірте інтернет і оновіть сторінку.';});
