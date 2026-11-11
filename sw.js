const CACHE='avi-shell-v5.6';
const CORE=['./','./index.html','./avi-local-engine.js','./supabase-config.js','./supabase-client.js','./manifest.webmanifest','./avi-icon.svg','./avi-icon-512.png','./assets/avi-identidade-original.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/functions/')||url.pathname.includes('/rest/'))return;
 event.respondWith(fetch(req).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));}return res;}).catch(()=>caches.match(req).then(hit=>hit||caches.match('./index.html'))));
});
