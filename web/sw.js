const CACHE='forest-watch-v7';
const ASSETS=['./','./index.html','./style.css','./core.js','./app.js','./country.js','./ua-places.json','./live.js','./install.js','./vendor/leaflet.js','./vendor/leaflet.css','./icon.svg','./icons/icon-192.png','./icons/icon-512.png','./manifest.webmanifest'];
const urls=ASSETS.map(p=>new URL(p,self.registration.scope).href);
const allowed=new Set(urls.map(p=>new URL(p).pathname));
const appResponse=r=>r.ok&&!r.redirected&&r.headers.get('X-Forest-App')==='1';
self.addEventListener('install',e=>e.waitUntil((async()=>{const cache=await caches.open(CACHE);for(const url of urls){const r=await fetch(new Request(url,{cache:'reload'}));if(!appResponse(r))throw Error('Application assets unavailable');await cache.put(url,r);}await self.skipWaiting();})()));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('forest-watch-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin||e.request.method!=='GET'||!allowed.has(url.pathname))return;
  url.search='';const canonical=url.href;
  e.respondWith((async()=>{try{const r=await fetch(e.request);if(appResponse(r)){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(cache=>cache.put(canonical,copy)));}return r;}catch{return await caches.match(canonical)||(e.request.mode==='navigate'?await caches.match(new URL('./index.html',self.registration.scope).href):null)||Response.error();}})());
});
