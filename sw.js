/* ============================================================
 * Service Worker - KedaiApp Pro V9
 * ============================================================ */

// ⚠️ BILA MENGUBAH KODE DI GITHUB, CUKUP UBAH NAMA VERSI DI BAWAH INI
const CACHE_NAME = 'kedaiapp-v9.0.2';

// Daftar file inti (App Shell) yang wajib disimpan untuk akses offline
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

/* ------------------------------------------------------------
 * 1. INSTALL EVENT
 * Mengunduh aset penting dan langsung memaksakan SW baru aktif
 * ------------------------------------------------------------ */
self.addEventListener('install', (event) => {
  console.log('[SW KedaiApp] Event Install: Memasang versi baru...', CACHE_NAME);
  
  // Memaksa Service Worker baru langsung mengambil alih tanpa menunggu browser ditutup
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW KedaiApp] Caching App Shell...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

/* ------------------------------------------------------------
 * 2. ACTIVATE EVENT
 * Membersihkan cache lama agar tampilan langsung terbarui
 * ------------------------------------------------------------ */
self.addEventListener('activate', (event) => {
  console.log('[SW KedaiApp] Event Activate: Membersihkan cache lama...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          // Jika nama cache tidak sama dengan versi terbaru, hapus!
          if (cache !== CACHE_NAME) {
            console.log('[SW KedaiApp] Hapus cache usang:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      // Mengambil alih semua tab browser yang sedang terbuka
      return self.clients.claim();
    })
  );
});

/* ------------------------------------------------------------
 * 3. FETCH EVENT
 * Strategi:
 * - HTML / Halaman Utama: Network First (Ambil web terbaru dulu, jika offline baru ambil cache)
 * - File Statis Lainnya: Stale-While-Revalidate
 * ------------------------------------------------------------ */
self.addEventListener('fetch', (event) => {
  // Abaikan request non-GET (seperti POST data transaksi ke server)
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // A. STRATEGI HALAMAN HTML (Mencegah masalah tampilan tidak berubah saat update GitHub)
  if (event.request.headers.get('accept')?.includes('text/html') || requestUrl.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Jika berhasil dapat data terbaru dari internet, perbarui cache
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Jika offline atau jaringan terputus, gunakan file dari cache
          console.log('[SW KedaiApp] Mode Offline: Mengambil dari cache');
          return caches.match(event.request) || caches.match('/index.html');
        })
    );
    return;
  }

  // B. STRATEGI ASSET LAIN (CSS, JS, Gambar, Font)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Ambil dari cache dulu agar cepat
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {/* Abaikan error jaringan untuk asset non-HTML saat offline */});

      return cachedResponse || fetchPromise;
    })
  );
});

/* ------------------------------------------------------------
 * 4. MESSAGE EVENT
 * Mendengarkan perintah refresh dari script utama index.html
 * ------------------------------------------------------------ */
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
