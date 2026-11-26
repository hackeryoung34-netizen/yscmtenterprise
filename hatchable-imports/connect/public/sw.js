const CACHE="yscmt-connect-shell-v1";
const SHELL=["/","/login.html","/theme.css","/guidelines.html","/privacy.html","/icon.svg","/manifest.webmanifest"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET")return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith("/api/")||url.pathname.startsWith("/__hatchable/"))return;
 if(req.mode==="navigate"){
  event.respondWith(fetch(req).then(response=>{if(response.ok&&url.pathname==="/"){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put("/",copy))}return response}).catch(async()=>await caches.match(req)||await caches.match("/")));
  return;
 }
 if(SHELL.includes(url.pathname))event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});