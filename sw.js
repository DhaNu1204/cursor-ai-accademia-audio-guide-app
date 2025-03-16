// Service Worker for Accademia Audio Guide
// This service worker provides comprehensive offline functionality

const CACHE_NAME = 'accademia-audio-guide-v1';
const DYNAMIC_CACHE = 'accademia-dynamic-v1';

// Resources to cache during installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/Logo-New.jpg'
];

// Install event - precache essential files
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Precaching App Shell');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Successfully installed');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Precaching failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker');
  
  event.waitUntil(
    caches.keys()
      .then(keyList => {
        return Promise.all(keyList.map(key => {
          if (key !== CACHE_NAME && key !== DYNAMIC_CACHE) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        }));
      })
      .then(() => {
        console.log('[Service Worker] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Function to determine if a request is for an API call
const isApiRequest = (url) => {
  return url.includes('/api/');
};

// Function to determine if a request is for an audio file
const isAudioFile = (url) => {
  return url.includes('.mp3') || url.includes('.wav') || url.includes('.ogg');
};

// Function to determine if a request is for an image
const isImageFile = (url) => {
  return url.includes('.jpg') || url.includes('.jpeg') || 
         url.includes('.png') || url.includes('.gif') || 
         url.includes('.webp') || url.includes('.svg');
};

// Function to determine if a request is for a text/JSON file
const isTextFile = (url) => {
  return url.includes('.json') || url.includes('.txt');
};

// Fetch event - handle caching strategies based on request type
self.addEventListener('fetch', (event) => {
  const requestUrl = event.request.url;
  
  // Skip non-GET requests and browser extensions
  if (event.request.method !== 'GET' || 
      requestUrl.startsWith('chrome-extension') || 
      requestUrl.includes('extension') ||
      // Skip requests to external domains except for known CDNs and APIs
      (requestUrl.includes('http') && 
       !requestUrl.includes('accfree.nextaudioguides.com') &&
       !requestUrl.includes('cdnjs.cloudflare.com') &&
       !requestUrl.includes('via.placeholder.com'))) {
    return;
  }
  
  // Different caching strategies based on file type
  
  // 1. For audio files: Cache First then Network (prioritize offline access)
  if (isAudioFile(requestUrl)) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE)
        .then(cache => {
          return cache.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                // If found in cache, return it and update cache in background
                console.log('[Service Worker] Found audio in cache:', requestUrl);
                
                // Update cache in background if online
                if (navigator.onLine) {
                  fetch(event.request)
                    .then(networkResponse => {
                      if (networkResponse.ok) {
                        cache.put(event.request, networkResponse.clone());
                        console.log('[Service Worker] Updated cached audio');
                      }
                    })
                    .catch(error => {
                      console.error('[Service Worker] Failed to update audio cache:', error);
                    });
                }
                
                return cachedResponse;
              }
              
              // If not in cache, fetch from network and cache
              return fetch(event.request)
                .then(networkResponse => {
                  if (networkResponse.ok) {
                    // Clone the response before caching
                    cache.put(event.request, networkResponse.clone());
                    console.log('[Service Worker] Cached new audio file');
                    return networkResponse;
                  }
                  
                  throw new Error('Network response not ok');
                })
                .catch(error => {
                  console.error('[Service Worker] Failed to fetch audio:', error);
                  // Return a fallback response if available
                  return new Response(
                    JSON.stringify({ error: 'Unable to fetch audio file' }),
                    { 
                      status: 503,
                      headers: { 'Content-Type': 'application/json' }
                    }
                  );
                });
            });
        })
    );
    return;
  }
  
  // 2. For images: Cache First then Network with fallback
  if (isImageFile(requestUrl)) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE)
        .then(cache => {
          return cache.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                console.log('[Service Worker] Found image in cache:', requestUrl);
                return cachedResponse;
              }
              
              return fetch(event.request)
                .then(networkResponse => {
                  if (networkResponse.ok) {
                    // Clone the response before caching
                    cache.put(event.request, networkResponse.clone());
                    console.log('[Service Worker] Cached new image file');
                    return networkResponse;
                  }
                  
                  throw new Error('Network response not ok');
                })
                .catch(error => {
                  console.error('[Service Worker] Failed to fetch image:', error);
                  // We could return a placeholder image here
                  // For now, let's delegate this to the app's error handling
                  return new Response(
                    'Image not available offline',
                    {
                      status: 503,
                      headers: { 'Content-Type': 'text/plain' }
                    }
                  );
                });
            });
        })
    );
    return;
  }
  
  // 3. For API requests: Network first then Cache
  if (isApiRequest(requestUrl)) {
    event.respondWith(
      fetch(event.request)
        .then(networkResponse => {
          if (networkResponse.ok) {
            return caches.open(DYNAMIC_CACHE)
              .then(cache => {
                // Clone the response before caching and returning
                cache.put(event.request, networkResponse.clone());
                console.log('[Service Worker] Cached API response for offline use');
                return networkResponse;
              });
          }
          
          throw new Error('Network response not ok');
        })
        .catch(error => {
          console.error('[Service Worker] Network failed, trying cache:', error);
          return caches.open(DYNAMIC_CACHE)
            .then(cache => {
              return cache.match(event.request)
                .then(cachedResponse => {
                  if (cachedResponse) {
                    console.log('[Service Worker] Returning cached API response');
                    return cachedResponse;
                  }
                  
                  // If not in cache, return a formatted error
                  return new Response(
                    JSON.stringify({ 
                      error: 'You are offline and this content is not cached',
                      offline: true 
                    }),
                    { 
                      status: 503,
                      headers: { 'Content-Type': 'application/json' }
                    }
                  );
                });
            });
        })
    );
    return;
  }
  
  // 4. For text/JSON files: Cache first then network
  if (isTextFile(requestUrl)) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE)
        .then(cache => {
          return cache.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                console.log('[Service Worker] Found text file in cache:', requestUrl);
                
                // Update in background
                fetch(event.request)
                  .then(networkResponse => {
                    if (networkResponse.ok) {
                      cache.put(event.request, networkResponse.clone());
                      console.log('[Service Worker] Updated cached text file');
                    }
                  })
                  .catch(error => {
                    console.log('[Service Worker] Could not update text file, using cached version');
                  });
                
                return cachedResponse;
              }
              
              return fetch(event.request)
                .then(networkResponse => {
                  if (networkResponse.ok) {
                    // Clone the response before caching
                    cache.put(event.request, networkResponse.clone());
                    console.log('[Service Worker] Cached new text file');
                    return networkResponse;
                  }
                  
                  throw new Error('Network response not ok');
                })
                .catch(error => {
                  console.error('[Service Worker] Failed to fetch text file:', error);
                  return new Response(
                    JSON.stringify({ error: 'Text file not available offline' }),
                    { 
                      status: 503,
                      headers: { 'Content-Type': 'application/json' }
                    }
                  );
                });
            });
        })
    );
    return;
  }
  
  // 5. Default strategy for all other requests: Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.match(event.request)
          .then(cachedResponse => {
            // Start fetch in background regardless of cache status
            const fetchPromise = fetch(event.request)
              .then(networkResponse => {
                // Only cache successful responses
                if (networkResponse.ok) {
                  cache.put(event.request, networkResponse.clone());
                  console.log('[Service Worker] Updated cache for:', requestUrl);
                }
                return networkResponse;
              })
              .catch(error => {
                console.error('[Service Worker] Fetch failed:', error);
                // Don't return anything here, as we'll fall back to cached response
                // or error handling below
              });
            
            // Return cached response immediately if available
            return cachedResponse || fetchPromise
              .catch(error => {
                console.error('[Service Worker] Both cache and network failed:', error);
                
                // Special handling for HTML navigation requests
                if (event.request.headers.get('accept')?.includes('text/html')) {
                  return caches.match('/index.html')
                    .then(fallbackResponse => {
                      if (fallbackResponse) {
                        console.log('[Service Worker] Returning index.html as fallback');
                        return fallbackResponse;
                      }
                      
                      // As a last resort, return an error message
                      return new Response(
                        '<html><body><h1>App is offline</h1><p>Please check your connection.</p></body></html>',
                        {
                          status: 503,
                          headers: { 'Content-Type': 'text/html' }
                        }
                      );
                    });
                }
                
                // For non-HTML requests, return a simple error
                return new Response(
                  'Application is offline and this resource is not cached',
                  {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain' }
                  }
                );
              });
          });
      })
  );
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Received message:', event.data);
  
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    clearCache();
  }
});

// Function to clear all caches
const clearCache = () => {
  caches.keys()
    .then(keyList => {
      return Promise.all(keyList.map(key => {
        console.log('[Service Worker] Deleting cache', key);
        return caches.delete(key);
      }));
    })
    .then(() => {
      console.log('[Service Worker] All caches cleared');
    });
}; 