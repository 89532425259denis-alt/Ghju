// Updated service worker for Telegram Mini App

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open('telegram-cache').then(function(cache) {
            return cache.addAll([
                // List of files to cache
                '/index.html',
                '/styles.css',
                '/script.js',
                // Add any additional files here
            ]);
        })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request).then(function(response) {
            return response || fetch(event.request);
        })
    );
});

self.addEventListener('activate', function(event) {
    var cacheAllowlist = ['telegram-cache'];

    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheAllowlist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});