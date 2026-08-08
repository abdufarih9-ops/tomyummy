/* ========================================================================
   KedaiApp V9 - Service Worker Script (Offline-First Cache)
   ======================================================================== */

const CACHE_NAME = 'kedaiapp-v9-cache-v1';

// Daftar aset internal dan CDN eksternal yang di-cache agar dapat berjalan offline
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  
  // External Libraries (CDN)
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
  'https://unpkg.com/dexie/dist/dexie.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js'
];

/* 1. Event Install: Membuka cache dan menyimpan semua aset dasar */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell & dependencies');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

/* 2. Event Activate: Membersihkan cache versi lama jika ada pembaruan */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/* 3. Event Fetch: Strategi Cache-First dengan Network Fallback */
self.addEventListener('fetch', (event) => {
  // Hanya menangani request ber-protokol HTTP/HTTPS
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Jika resource ditemukan di cache, gunakan data cache
      if (cachedResponse) {
        return cachedResponse;
      }

      // Jika tidak ada di cache, lakukan request ke jaringan
      return fetch(event.request).then((networkResponse) => {
        // Validasi respon yang diterima
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
          return networkResponse;
        }

        // Duplikasi respon karena stream hanya bisa dibaca sekali
        const responseToCache = networkResponse.clone();

        // Simpan hasil fetch baru ke dalam cache untuk penggunaan berikutnya
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback jika jaringan terputus dan resource belum ada di cache
        console.warn('[Service Worker] Fetch failed; returning offline status.');
      });
    })
  );
});
