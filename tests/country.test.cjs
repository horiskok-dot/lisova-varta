const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');

test('place search entered before the catalog arrives resumes automatically',async()=>{
  const dom=new JSDOM('<div class="location-toolbar"><input id="location-search"><div id="location-results"></div><p id="location-status"></p></div><span id="place-count"></span><span id="map-region-title"></span><button id="ukraine-view"></button>',{runScripts:'outside-only'}),w=dom.window;
  try{
    w.$=s=>w.document.querySelector(s);w.esc=s=>String(s);w.C={countLabel:n=>String(n)};
    w.map={getZoom:()=>13,on(){}};w.L={layerGroup:()=>({addTo(){return this;},clearLayers(){}})};
    let deliver;w.fetch=()=>new Promise(resolve=>{deliver=resolve;});
    w.eval(fs.readFileSync(require('node:path').join(__dirname,'../web/country.js'),'utf8'));
    w.$('#location-search').value='Львів';w.$('#location-search').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
    assert.match(w.$('#location-status').textContent,/продовжиться автоматично/);
    deliver({ok:true,json:async()=>({source:'GeoNames',places:[[702550,'Lviv','Львів','','Львівська область',49.84,24.02,'PPLA',700000]]})});
    for(let i=0;i<4;i++)await new Promise(r=>setTimeout(r,0));
    assert.equal(w.$('#location-results').children.length,1);assert.equal(w.$('#location-results button').id,'place-option-702550');
  }finally{dom.window.close();}
});
