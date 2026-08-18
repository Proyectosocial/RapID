// Service Worker para PWA de Emergencias
// Permite funcionamiento offline y sincronización automática

const CACHE_NAME = 'emergency-app-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://unpkg.com/lucide@latest'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker instalado');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Cacheando archivos de la aplicación');
      // Intentar cachear los archivos, pero no fallar si no están disponibles
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url))
      );
    })
  );
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker activado');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia de red-primero con fallback a caché (Network First)
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo cachear GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Estrategia Network First para HTML
  if (request.destination === '' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const cache = caches.open(CACHE_NAME);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then((response) => response || caches.match('./index.html'));
        })
    );
    return;
  }

  // Estrategia Cache First para assets estáticos
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Si falla la red, retornar una respuesta offline
            if (request.destination === 'image') {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="#f0f0f0" width="100" height="100"/></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
          });
      })
  );
});

// Escuchar mensajes desde el cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'SYNC_REGISTROS') {
    console.log('Sincronizando registros...');
    // Aquí iría la lógica de sincronización con el servidor
    event.ports[0].postMessage({ synced: true });
  }
});

// Sincronización en segundo plano
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-registros') {
    event.waitUntil(
      // Aquí iría la lógica para sincronizar datos con el servidor
      Promise.resolve()
    );
  }
});

// Notificaciones push (opcional para futuras integraciones)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect fill="%23dc2626" width="192" height="192"/><text x="96" y="150" text-anchor="middle" font-size="150" font-weight="bold">🚨</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect fill="%23dc2626" width="96" height="96"/><text x="48" y="72" text-anchor="middle" font-size="60" font-weight="bold">🚨</text></svg>',
      tag: 'emergency-notification',
      requireInteraction: false,
      vibrate: [200, 100, 200]
    };

    event.waitUntil(
      self.registration.showNotification('Emergencias', options)
    );
  }
});

// Notificaciones click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./index.html');
      }
    })
  );
});

console.log('Service Worker cargado - Versión:', CACHE_NAME);