(function(root){
  'use strict';
  const TYPES={water:'Источник воды',vegetation:'Зелёная зона',obstacle:'Препятствие',fuel:'Сухие отходы',hotspot:'Спутниковая отметка'};
  const STATUS={needs:'Нужно проверить',verified:'Проверен',problem:'Проблема',resolved:'Устранено'};
  function distance(a,b){const r=Math.PI/180;const dlat=(b.lat-a.lat)*r,dlng=(b.lng-a.lng)*r;const x=Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlng/2)**2;return 6371*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));}
  function age(p,now=Date.now()){return p.checkedAt?Math.max(0,(now-new Date(p.checkedAt+'T00:00:00Z').getTime())/86400000):365;}
  function stale(p,now){return p.status!=='resolved'&&(p.status==='needs'||age(p,now)>14);}
  function priority(p,now){if(p.status==='resolved')return 0;return ({high:45,medium:25,low:10}[p.priority]||10)+(p.status==='problem'?40:0)+(p.type==='water'?12:0)+Math.min(30,age(p,now)*1.5);}
  function greedyPlan(points,base,budget,speed,mode,now){
    if(!Number.isFinite(budget)||budget<15||budget>480||!Number.isFinite(speed)||speed<1||speed>60)throw Error('Укажите время 15–480 минут и скорость 1–60 км/ч.');
    let remaining=points.filter(p=>p.status!=='resolved'&&(p.status==='problem'||p.status==='needs'||stale(p,now))),current=base,elapsed=0,km=0,score=0;const stops=[];
    while(remaining.length){let best=null,bestValue=-Infinity;
      for(const p of remaining){const leg=distance(current,p),cost=leg/speed*60+8,back=distance(p,base)/speed*60;if(elapsed+cost+back>budget+1e-9)continue;const value=mode==='nearest'?-leg:mode==='value'?priority(p,now):priority(p,now)/(cost+1);if(value>bestValue){best={p,leg,cost};bestValue=value;}}
      if(!best)break;elapsed+=best.cost;km+=best.leg;score+=priority(best.p,now);stops.push({id:best.p.id,arrival:elapsed-8,score:Math.round(priority(best.p,now))});current=best.p;remaining=remaining.filter(p=>p.id!==best.p.id);
    }
    const back=stops.length?distance(current,base):0;return {stops,minutes:elapsed+back/speed*60,km:km+back,score:Math.round(score)};
  }
  function plan(points,base,budget,speed,mode='priority',now=Date.now()){
    if(!base||!Number.isFinite(base.lat)||!Number.isFinite(base.lng))throw Error('Укажите корректную стартовую точку.');
    if(mode==='nearest')return greedyPlan(points,base,budget,speed,mode,now);
    return ['priority','nearest','value'].map(m=>greedyPlan(points,base,budget,speed,m,now)).sort((a,b)=>b.score-a.score||a.minutes-b.minutes)[0];
  }
  function validDate(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;}
  function countLabel(n,forms){const key=new Intl.PluralRules('ru').select(n);return `${n} ${forms[key]||forms.other}`;}
  function gpx(points,base){const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="ForestWatch" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>План проверок — точки, не маршрут по дорогам</name></metadata>'+[...points.map((p,i)=>({...p,name:`${i+1}. ${p.name}`})),{...base,name:'Старт и возврат'}].map(p=>`<wpt lat="${p.lat}" lon="${p.lng}"><name>${xml(p.name)}</name></wpt>`).join('')+'</gpx>';}
  function validate(data){
    if(!data||data.version!==1||!Array.isArray(data.points)||data.points.length>1000)throw Error('Нужен экспорт Лесного дозора версии 1, до 1000 точек.');
    const ids=new Set();const str=(v,n)=>typeof v==='string'&&v.length<=n;const date=v=>v===''||validDate(v);
    const points=data.points.map(p=>{if(!p||!str(p.id,100)||!p.id||ids.has(p.id)||!str(p.name,100)||!p.name.trim()||!Object.hasOwn(TYPES,p.type)||!Object.hasOwn(STATUS,p.status)||!['high','medium','low'].includes(p.priority)||!Number.isFinite(p.lat)||Math.abs(p.lat)>85||!Number.isFinite(p.lng)||Math.abs(p.lng)>180||!str(p.owner,80)||!str(p.note,1500)||!date(p.checkedAt)||!date(p.due)||!(p.photo===''||(str(p.photo,450000)&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.photo))))throw Error('В файле есть некорректная точка. Импорт отменён.');ids.add(p.id);return Object.fromEntries(['id','name','type','status','priority','lat','lng','owner','note','checkedAt','due','photo'].map(k=>[k,p[k]]));});
    if(!data.base||!Number.isFinite(data.base.lat)||Math.abs(data.base.lat)>85||!Number.isFinite(data.base.lng)||Math.abs(data.base.lng)>180)throw Error('Некорректная стартовая точка.');
    const legacyBaseChosen=data.baseSet===undefined&&(data.demo===true||Math.abs(data.base.lat-50.55)>1e-7||Math.abs(data.base.lng-30.35)>1e-7);
    return {version:1,points,base:{lat:data.base.lat,lng:data.base.lng},baseSet:data.baseSet===true||legacyBaseChosen,demo:data.demo===true,log:Array.isArray(data.log)?data.log.slice(0,200).filter(e=>e&&str(e.text,300)&&str(e.time,40)&&!isNaN(Date.parse(e.time))).map(e=>({text:e.text,time:e.time})):[]};
  }
  const api={TYPES,STATUS,distance,age,stale,priority,plan,validDate,countLabel,gpx,validate};if(typeof module!=='undefined')module.exports=api;else root.ForestCore=api;
})(typeof window!=='undefined'?window:globalThis);
