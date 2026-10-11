// ========================================================
// MY SPECIAL ENGLISH : PWA Service Worker (sw.js)
// 오프라인 지원 및 정적 리소스 캐싱
// ========================================================

const CACHE_NAME = 'my-special-english-v8';
const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './grading.js',
  './supabaseClient.js',
  './pdfParser.js',
  './words.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app assets v5');
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Cache addAll warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // chrome-extension 등 비HTTP 요청 및 GET 외 메소드는 캐시 제외
  if (!event.request.url.startsWith('http') || event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // Supabase API 호출이나 외부 CDN은 네트워크 우선
  if (url.origin.includes('supabase.co') || url.origin.includes('cdnjs.cloudflare.com') || url.origin.includes('jsdelivr.net')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // 로컬 정적 리소스: Network First (최신 코드 즉시 반영) with Cache Fallback (오프라인 지원)
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
