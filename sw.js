const CACHE_NAME = 'devo-music-v2';
const AUDIO_CACHE_NAME = 'devo-audio-cache';

// Список файлов для кэширования (основные ресурсы приложения)
const ASSETS = [
  './',
  './index.html',
  'https://cdn.tailwindcss.com',
  'https://telegram.org/js/telegram-web-app.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap',
  'https://via.placeholder.com/192/ff2d55/ffffff?text=DEVO',
  'https://via.placeholder.com/512/ff2d55/ffffff?text=DEVO',
  'https://via.placeholder.com/500/ff2d55/ffffff?text=DEVO'
];

// Установка Service Worker: кэшируем основные файлы
self.addEventListener('install', (event) => {
  console.log('[SW] Установка...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Кэширование основных файлов...');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        console.log('[SW] Основные файлы закэшированы');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Ошибка кэширования:', err);
      })
  );
});

// Активация: удаляем старые кэши
self.addEventListener('activate', (event) => {
  console.log('[SW] Активация...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== AUDIO_CACHE_NAME)
          .map((name) => {
            console.log('[SW] Удаление старого кэша:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Service Worker активирован');
      return self.clients.claim();
    })
  );
});

// Обработка запросов: стратегия "Cache First, then Network" с поддержкой оффлайн
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Пропускаем запросы к Firebase (они не кэшируются)
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    return;
  }

  // Пропускаем POST-запросы
  if (request.method !== 'GET') {
    return;
  }

  // Специальная обработка для оффлайн-аудио
  if (url.pathname.startsWith('/offline-audio/')) {
    event.respondWith(
      caches.open(AUDIO_CACHE_NAME).then((cache) => {
        return cache.match(request).then((response) => {
          if (response) {
            return response;
          }
          return fetch(request).then((networkResponse) => {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Для остальных запросов - Cache First
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Если есть в кэше - возвращаем
        if (cachedResponse) {
          return cachedResponse;
        }

        // Если нет в кэше - запрашиваем из сети
        return fetch(request)
          .then((networkResponse) => {
            // Кэшируем успешные ответы
            if (networkResponse.ok && 
                (request.destination === 'image' || 
                 request.destination === 'font' ||
                 request.destination === 'style' ||
                 request.destination === 'script' ||
                 url.pathname.endsWith('.css') ||
                 url.pathname.endsWith('.js'))) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.error('[SW] Ошибка сети:', error);
            
            // Возвращаем заглушку для изображений в оффлайн
            if (request.destination === 'image') {
              return caches.match('https://via.placeholder.com/500/ff2d55/ffffff?text=DEVO');
            }
            
            // Для HTML-страниц возвращаем кэшированную главную
            if (request.destination === 'document') {
              return caches.match('./index.html');
            }
            
            throw error;
          });
      })
  );
});

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'DEVO Music';
  const options = {
    body: data.body || 'Новое уведомление',
    icon: data.icon || 'https://via.placeholder.com/192/ff2d55/ffffff?text=DEVO',
    badge: 'https://via.placeholder.com/72/ff2d55/ffffff?text=DEVO',
    tag: data.tag || 'default',
    requireInteraction: false,
    silent: true,
    data: data.data || {},
    actions: [
      {action: 'open', title: 'Открыть плеер'},
      {action: 'close', title: 'Закрыть'}
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        if (clientList.length > 0) {
          const client = clientList[0];
          client.focus();
          // Отправляем сообщение в приложение
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            data: event.notification.data
          });
        } else {
          clients.openWindow('/');
        }
      })
  );
});

// Обработка сообщений от приложения
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Обработка запроса на удаление из кэша
  if (event.data && event.data.type === 'DELETE_FROM_CACHE') {
    const { trackId } = event.data;
    caches.open(AUDIO_CACHE_NAME).then((cache) => {
      cache.delete(`/offline-audio/${trackId}`);
    });
  }
});

// Проверка соединения для оффлайн-режима
self.addEventListener('online', () => {
  console.log('[SW] Соединение восстановлено');
});

self.addEventListener('offline', () => {
  console.log('[SW] Оффлайн режим');
});