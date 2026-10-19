'use strict';
const dniproLayer=L.layerGroup(),dniproRenderer=L.canvas({padding:.5}),dniproButton=$('#dnipro-show'),dniproStatus=$('#dnipro-status');
let dniproData=null,dniproLoading=null;
const dniproNames={wood:'Лесной участок',park:'Парк',water:'Водоём'};
const dniproColors={wood:'#bfdc62',park:'#efbe55',water:'#54c8e6'};
function dniproDraft(area,coords){
  openEditor(null,coords);
  $('#point-name').value=area.name;
  $('#point-type').value=area.kind==='water'?'water':'vegetation';
  $('#point-status').value='needs';
  $('#point-note').value=`Контур из OpenStreetMap: ${area.url}. Место проверки выбрано на карте. Состояние участка, доступность прохода и наличие воды на месте не проверены.`;
  $('#editor-title').textContent='Проверить участок';
  editorBaseline=editorSnapshot();
}
function dniproPopup(area,shape){
  const div=document.createElement('div');
  div.innerHTML=`<b>${esc(area.name)}</b><br>${esc(dniproNames[area.kind])} · OpenStreetMap<br>Контур OSM, фактическое состояние не проверено.<br><a href="${esc(area.url)}" target="_blank" rel="noopener">Открыть объект в OSM ↗</a><br><button class="btn primary small popup-button">Выбрать место проверки</button>`;
  div.querySelector('button').onclick=()=>{
    map.closePopup();setView('map');map.fitBounds(shape.getBounds(),{padding:[45,45],maxZoom:16});
    window.ForestBeginMapClick(coords=>{window.ForestCancelMapClick();dniproDraft(area,coords);return true;},'Нажмите на карту в месте будущей проверки');
    toast('Укажите на карте конкретное место для проверки участка.');
  };
  return div;
}
async function loadDnipro(){
  if(dniproData)return dniproData;
  if(dniproLoading)return dniproLoading;
  dniproStatus.textContent='Загрузка контуров…';
  dniproLoading=fetch('dnipro-areas.json').then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(data=>{
    if(data.source!=='OpenStreetMap'||!Array.isArray(data.areas)||data.areas.length<100)throw Error('Неполные данные участков Днепра');
    dniproData=data;
    for(const area of data.areas){
      if(!dniproNames[area.kind]||!Array.isArray(area.geometry)||area.geometry.length<4||!/^osm-way-\d+$/.test(area.id))continue;
      const color=dniproColors[area.kind];
      const shape=L.polygon(area.geometry,{renderer:dniproRenderer,color,weight:1.8,opacity:.95,fillColor:color,fillOpacity:.25,bubblingMouseEvents:false});
      shape.bindPopup(dniproPopup(area,shape));
      shape.bindTooltip(area.name,{sticky:true,direction:'top'});
      shape.on('click',e=>{if(window.ForestMapClick){window.ForestMapClick(e.latlng);map.closePopup();}});
      shape.addTo(dniproLayer);
    }
    $('#dnipro-count').textContent=data.areas.length.toLocaleString('ru');
    dniproStatus.textContent=`${data.areas.length.toLocaleString('ru')} контуров OSM · данные ${stamp(data.fetchedAt)}`;
    return data;
  }).finally(()=>{dniproLoading=null;});
  return dniproLoading;
}
async function showDnipro(focus=true){
  dniproButton.disabled=true;
  try{
    await loadDnipro();
    if(!map.hasLayer(dniproLayer))dniproLayer.addTo(map);
    dniproButton.setAttribute('aria-pressed','true');
    dniproButton.textContent='Скрыть участки Днепра';
    if(focus){map.fitBounds([[48.3558547,34.7489459],[48.5763901,35.2421952]],{padding:[20,20]});$('#location-search').value='Дніпро';$('#map-region-title').textContent='Дніпро';}
  }catch(error){dniproStatus.textContent='Не удалось загрузить участки: '+error.message;}
  finally{dniproButton.disabled=false;}
}
dniproButton.onclick=()=>{
  if(map.hasLayer(dniproLayer)){map.removeLayer(dniproLayer);dniproButton.setAttribute('aria-pressed','false');dniproButton.innerHTML='Участки Днепра <span id="dnipro-count">'+(dniproData?.areas.length.toLocaleString('ru')||'100+')+'</span>';}
  else showDnipro();
};
window.addEventListener('forest:place-selected',e=>{if(e.detail.id===709930)showDnipro(false);});
