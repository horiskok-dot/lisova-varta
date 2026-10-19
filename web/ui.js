'use strict';
(()=>{
  const $=s=>document.querySelector(s),workspace=$('.workspace'),tools=$('#tools-dialog');
  $('.skip-link').onclick=e=>{e.preventDefault();$('#main-content').setAttribute('tabindex','-1');$('#main-content').focus({preventScroll:true});$('#main-content').scrollIntoView({block:'start'});};
  function showPane(pane){
    workspace.dataset.pane=pane;
    $('#show-map').setAttribute('aria-pressed',String(pane==='map'));
    $('#show-objects').setAttribute('aria-pressed',String(pane==='objects'));
    if(pane==='map')setTimeout(()=>map.invalidateSize(),20);
  }
  $('#show-map').onclick=()=>showPane('map');$('#show-objects').onclick=()=>showPane('objects');
  document.querySelectorAll('[data-stat]').forEach(button=>button.addEventListener('click',()=>showPane('objects')));
  window.addEventListener('view-changed',e=>{showPane('map');if(e.detail!=='map')expandMap(false);});
  function updateCount(){ $('#mobile-object-count').textContent=$('#stat-total').textContent;$('#task-count').hidden=$('#task-count').textContent==='0'; }
  window.addEventListener('journal-changed',updateCount);updateCount();
  function expandMap(expanded){
    document.body.classList.toggle('map-expanded',expanded);
    $('#map-expand').setAttribute('aria-pressed',String(expanded));
    $('#map-expand').setAttribute('aria-label',expanded?'Згорнути мапу':'Розгорнути мапу');
    $('#map-expand').innerHTML=uiIcon(expanded?'close':'expand');
    setTimeout(()=>map.invalidateSize(),20);
  }
  $('#map-expand').onclick=()=>expandMap(!document.body.classList.contains('map-expanded'));
  $('#sources-open').addEventListener('click',()=>{expandMap(false);$('#source-panel').scrollIntoView({block:'start',behavior:'auto'});});
  $('#mobile-add').onclick=()=>$('#add').click();
  function updateTools(){
    const field=$('#offline-toggle').getAttribute('aria-pressed')==='true';
    $('#tools-mode').setAttribute('aria-pressed',String(field));
    $('#tools-mode-state').textContent=field?'Увімкнено':'Вимкнено';
    $('#tools-status').textContent=field?'Польовий режим · збережені дані':navigator.onLine?'Онлайн · джерела можна оновити':'Без мережі · журнал доступний на пристрої';
    $('#tools-install').hidden=$('#install-app').hidden;
  }
  $('#mobile-menu').onclick=()=>{updateTools();tools.showModal();};
  $('#tools-close').onclick=()=>tools.close();
  for(const [name,target]of [['mode','offline-toggle'],['export','export'],['import','import-button'],['help','help'],['install','install-app']]){
    $('#tools-'+name).onclick=()=>{tools.close();$('#'+target).click();};
  }
  window.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]'))return;
    if(e.key==='Escape'&&document.body.classList.contains('map-expanded')){expandMap(false);$('#map-expand').focus();}
    const editing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if(e.key==='/'&&!editing&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();setView('map');showPane('map');$('#location-search').focus();}
  });
})();
