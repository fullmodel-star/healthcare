const CACHE='health-app-v4';
const ASSETS=[
  './',
  './index.html',
  './food-db.js?v=4',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(ASSETS).catch(err=>{
      // 個別 asset 失敗不阻擋安裝
      console.warn('[SW] addAll partial fail', err);
    }))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  // Anthropic API 永遠走網路，不快取
  if(url.hostname==='api.anthropic.com') return;
  // HTML: network-first（取得最新版本），離線時 fallback 至快取
  if(e.request.mode==='navigate' || url.pathname.endsWith('.html')){
    e.respondWith(
      fetch(e.request).then(resp=>{
        const copy=resp.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));
        return resp;
      }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
    );
    return;
  }
  // 其他資源: cache-first
  e.respondWith(
    caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
      if(!resp || resp.status!==200 || resp.type==='opaque') return resp;
      const copy=resp.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy));
      return resp;
    }).catch(()=>caches.match(e.request)))
  );
});
