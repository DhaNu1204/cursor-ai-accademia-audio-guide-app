// Accademia Gallery Audio Guide - Service Worker
const CACHE_NAME = 'accademia-audio-guide-cache-v6';
const APP_SHELL_CACHE = 'app-shell-cache-v6';
const AUDIO_CACHE = 'audio-cache-v6';
const IMAGE_CACHE = 'image-cache-v6';
const DATA_CACHE = 'data-cache-v6';

// App Shell resources to cache on install
const APP_SHELL_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/assets/Logo-New.jpg'
];

// External domains we want to cache content from
const ALLOWED_EXTERNAL_DOMAINS = [
  'accfree.nextaudioguides.com'
];

// Install event - cache basic app shell
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker');
  
  // Skip waiting to ensure the new service worker activates immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Precaching App Shell');
        return cache.addAll(APP_SHELL_RESOURCES);
      })
      .catch((error) => {
        console.error('[Service Worker] Precaching failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker');
  
  // Claim clients to ensure the service worker controls all clients immediately
  event.waitUntil(self.clients.claim());
  
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== APP_SHELL_CACHE && 
            cacheName !== AUDIO_CACHE && 
            cacheName !== IMAGE_CACHE && 
            cacheName !== DATA_CACHE &&
            // Also keep v4 caches during transition
            cacheName !== 'app-shell-cache-v4' &&
            cacheName !== 'audio-cache-v4' &&
            cacheName !== 'image-cache-v4' &&
            cacheName !== 'data-cache-v4'
          ) {
            console.log('[Service Worker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Helper function to determine cache name based on request URL
const getCacheName = (url) => {
  const urlObj = new URL(url);
  
  // Audio files
  if (url.includes('/assets/audio/') || url.includes('Audio-Track-') || url.match(/\.(mp3|wav|ogg)$/i)) {
    return AUDIO_CACHE;
  }
  
  // Image files
  if (
    url.includes('/assets/images/') || 
    url.includes('/assets/thumbnail/') || 
    url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)
  ) {
    return IMAGE_CACHE;
  }
  
  // JSON data
  if (url.includes('/data/') && url.endsWith('.json')) {
    return DATA_CACHE;
  }
  
  // Default to app shell cache for other resources
  return APP_SHELL_CACHE;
};

// Helper function to determine if a request should be cached
const shouldCache = (url) => {
  // Don't cache analytics, tracking, or other non-essential requests
  if (
    url.includes('/analytics') || 
    url.includes('/tracking') || 
    url.includes('/socket.io')
  ) {
    return false;
  }
  
  return true;
};

// Helper function to check if a URL is from an allowed external domain
const isAllowedExternalDomain = (url) => {
  try {
    const urlObj = new URL(url);
    return ALLOWED_EXTERNAL_DOMAINS.some(domain => urlObj.hostname.includes(domain));
  } catch (e) {
    return false;
  }
};

// Helper function to check if a request is a range request
const isRangeRequest = (request) => {
  return request.headers.has('range');
};

// Helper function to determine the correct MIME type for audio files
const getAudioMimeType = (url) => {
  if (url.endsWith('.mp3')) {
    return 'audio/mpeg';
  } else if (url.endsWith('.wav')) {
    return 'audio/wav';
  } else if (url.endsWith('.ogg')) {
    return 'audio/ogg';
  } else if (url.endsWith('.m4a')) {
    return 'audio/mp4';
  } else if (url.endsWith('.aac')) {
    return 'audio/aac';
  } else {
    // Default to mp3 if we can't determine the type
    return 'audio/mpeg';
  }
};

// Helper function to create a network response with appropriate headers for audio
const createAudioResponse = (blob, url) => {
  const contentType = getAudioMimeType(url);
  
  return new Response(blob, {
    headers: {
      'Content-Type': contentType,
      'Content-Length': blob.size,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000'
    }
  });
};

// Helper function to handle audio requests specifically
const handleAudioRequest = async (request) => {
  const url = request.url;
  const cache = await caches.open(AUDIO_CACHE);
  
  console.log('[Service Worker] Handling audio request:', url);
  
  // Check if this is a range request
  const isRange = isRangeRequest(request);
  if (isRange) {
    console.log('[Service Worker] Range request detected, bypassing cache');
    try {
      // For range requests, we need to bypass the cache and go straight to the network
      return fetch(request);
    } catch (error) {
      console.error('[Service Worker] Range request fetch failed:', error);
      // If network fails, we'll try to serve from cache anyway
    }
  }
  
  // Try to get from cache first
  try {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[Service Worker] Serving cached audio:', url);
      return cachedResponse;
    }
  } catch (error) {
    console.error('[Service Worker] Error retrieving cached audio:', error);
  }
  
  // If not in cache, try network
  try {
    console.log('[Service Worker] Fetching audio from network:', url);
    
    // For cross-origin requests, we need to use no-cors mode
    const isExternal = !url.startsWith(self.location.origin);
    const fetchOptions = isExternal ? { 
      mode: 'no-cors',
      headers: {
        'Accept': 'audio/mpeg, audio/mp3, audio/*'
      }
    } : {
      headers: {
        'Accept': 'audio/mpeg, audio/mp3, audio/*'
      }
    };
    
    console.log(`[Service Worker] Fetch options for ${url}:`, fetchOptions);
    
    const response = await fetch(request.clone(), fetchOptions);
    
    // For no-cors responses, we can't check status, so we just assume it's OK
    if (isExternal && fetchOptions.mode === 'no-cors') {
      console.log('[Service Worker] Got opaque response for cross-origin audio');
      
      // Store the opaque response in cache
      try {
        // For opaque responses, we might want to create a new response with proper headers
        const responseBlob = await response.clone().blob();
        const properResponse = createAudioResponse(responseBlob, url);
        
        await cache.put(request, properResponse.clone());
        console.log('[Service Worker] Cached audio response with proper headers:', url);
        
        return properResponse;
      } catch (cacheError) {
        console.error('[Service Worker] Failed to cache opaque audio:', cacheError);
        return response;
      }
    }
    
    // For same-origin or CORS-enabled responses, we can check status
    if (!response || response.status !== 200) {
      throw new Error(`Bad response status: ${response ? response.status : 'no response'}`);
    }
    
    // Clone the response to store in cache
    const responseToCache = response.clone();
    
    // Store in cache
    try {
      // Check if we need to fix the content type
      const contentType = responseToCache.headers.get('Content-Type');
      if (!contentType || !contentType.includes('audio/')) {
        // Create a new response with the correct content type
        const responseBlob = await responseToCache.blob();
        const properResponse = createAudioResponse(responseBlob, url);
        
        await cache.put(request, properResponse.clone());
        console.log('[Service Worker] Cached audio with fixed content type:', url);
        
        // Return the original response to avoid double-fetching
        return response;
      } else {
        // Store the original response
        await cache.put(request, responseToCache);
        console.log('[Service Worker] Cached audio from network:', url);
        return response;
      }
    } catch (cacheError) {
      console.error('[Service Worker] Failed to cache audio:', cacheError);
      return response;
    }
  } catch (error) {
    console.error('[Service Worker] Audio fetch failed:', error);
    
    // If network fails and we couldn't get from cache earlier, return a fallback
    return new Response('', { 
      status: 503, 
      statusText: 'Service Unavailable - Audio not available offline',
      headers: { 'Content-Type': 'audio/mpeg' }
    });
  }
};

// Helper function to handle image requests
const handleImageRequest = async (request) => {
  const url = request.url;
  const cache = await caches.open(IMAGE_CACHE);
  
  console.log('[Service Worker] Handling image request:', url);
  
  // Try to get from cache first
  try {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[Service Worker] Serving cached image:', url);
      return cachedResponse;
    }
  } catch (error) {
    console.error('[Service Worker] Error retrieving cached image:', error);
  }
  
  // If not in cache, try network
  try {
    console.log('[Service Worker] Fetching image from network:', url);
    
    // For cross-origin requests, we need to use no-cors mode
    const isExternal = !url.startsWith(self.location.origin);
    const fetchOptions = isExternal ? { mode: 'no-cors' } : {};
    
    console.log(`[Service Worker] Fetch options for ${url}:`, fetchOptions);
    
    const response = await fetch(request.clone(), fetchOptions);
    
    // For no-cors responses, we can't check status, so we just assume it's OK
    if (isExternal && fetchOptions.mode === 'no-cors') {
      console.log('[Service Worker] Got opaque response for cross-origin image');
      
      // Store the opaque response in cache
      try {
        await cache.put(request, response.clone());
        console.log('[Service Worker] Cached opaque image response:', url);
      } catch (cacheError) {
        console.error('[Service Worker] Failed to cache opaque image:', cacheError);
      }
      
      return response;
    }
    
    // For same-origin or CORS-enabled responses, we can check status
    if (!response || !response.ok) {
      throw new Error(`Bad response status: ${response ? response.status : 'no response'}`);
    }
    
    // Clone the response to store in cache
    const responseToCache = response.clone();
    
    // Store in cache
    try {
      await cache.put(request, responseToCache);
      console.log('[Service Worker] Cached image from network:', url);
    } catch (cacheError) {
      console.error('[Service Worker] Failed to cache image:', cacheError);
    }
    
    return response;
  } catch (error) {
    console.error('[Service Worker] Image fetch failed:', error);
    
    // If network fails and we couldn't get from cache earlier, return a fallback
    return new Response(
      '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="400" height="300" fill="#eee"/>' +
      '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#999">Image Unavailable Offline</text>' +
      '</svg>',
      { headers: { 'Content-Type': 'image/svg+xml' } }
    );
  }
};

// Helper function to handle data requests (JSON)
const handleDataRequest = async (request) => {
  const url = request.url;
  const cache = await caches.open(DATA_CACHE);
  
  // Try to get from cache first
  try {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[Service Worker] Serving cached data:', url);
      return cachedResponse;
    }
  } catch (error) {
    console.error('[Service Worker] Error retrieving cached data:', error);
  }
  
  // If not in cache, try network
  try {
    console.log('[Service Worker] Fetching data from network:', url);
    const response = await fetch(request.clone());
    
    if (!response || !response.ok) {
      throw new Error(`Bad response status: ${response ? response.status : 'no response'}`);
    }
    
    // Clone the response to store in cache
    const responseToCache = response.clone();
    
    // Store in cache
    try {
      await cache.put(request, responseToCache);
      console.log('[Service Worker] Cached data from network:', url);
    } catch (cacheError) {
      console.error('[Service Worker] Failed to cache data:', cacheError);
    }
    
    return response;
  } catch (error) {
    console.error('[Service Worker] Data fetch failed:', error);
    
    // If network fails and we couldn't get from cache earlier, return a fallback
    return new Response(JSON.stringify({ error: 'Data not available offline' }), { 
      status: 503, 
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Helper function to handle app shell and other requests
const handleAppShellRequest = async (request) => {
  const url = request.url;
  const cache = await caches.open(APP_SHELL_CACHE);
  
  // Try to get from cache first
  try {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[Service Worker] Serving from app shell cache:', url);
      return cachedResponse;
    }
  } catch (error) {
    console.error('[Service Worker] Error retrieving from app shell cache:', error);
  }
  
  // If not in cache, try network
  try {
    console.log('[Service Worker] Fetching from network:', url);
    const response = await fetch(request.clone());
    
    if (!response || !response.ok) {
      throw new Error(`Bad response status: ${response ? response.status : 'no response'}`);
    }
    
    // Clone the response to store in cache
    const responseToCache = response.clone();
    
    // Store in cache if it should be cached
    if (shouldCache(url)) {
      try {
        await cache.put(request, responseToCache);
        console.log('[Service Worker] Cached from network:', url);
      } catch (cacheError) {
        console.error('[Service Worker] Failed to cache:', cacheError);
      }
    }
    
    return response;
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);
    
    // For navigation requests, return the offline page
    if (request.mode === 'navigate') {
      try {
        const offlineResponse = await cache.match('/index.html');
        if (offlineResponse) {
          return offlineResponse;
        }
      } catch (offlineError) {
        console.error('[Service Worker] Failed to serve offline page:', offlineError);
      }
    }
    
    // Default fallback
    return new Response('Resource not available offline', { 
      status: 503, 
      statusText: 'Service Unavailable' 
    });
  }
};

// Fetch event - serve from cache or network with appropriate strategy
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Handle all requests to allowed external domains
  const isAllowedExternal = isAllowedExternalDomain(url);
  
  // Skip cross-origin requests that aren't to our allowed domains
  if (!url.startsWith(self.location.origin) && !isAllowedExternal) {
    return;
  }
  
  // Log the request for debugging
  console.log(`[Service Worker] Fetch: ${url}, Mode: ${event.request.mode}`);
  
  // Special handling for range requests to audio files
  if (isRangeRequest(event.request) && (url.includes('/assets/audio/') || url.match(/\.(mp3|wav|ogg)$/i))) {
    console.log('[Service Worker] Range request for audio, bypassing cache');
    // For range requests to audio files, bypass the cache and go straight to the network
    return;
  }
  
  // Handle based on resource type
  if (url.includes('/assets/audio/') || url.match(/\.(mp3|wav|ogg)$/i)) {
    // Audio files
    event.respondWith(handleAudioRequest(event.request));
  } else if (url.includes('/assets/images/') || 
             url.includes('/assets/thumbnail/') || 
             url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
    // Image files
    event.respondWith(handleImageRequest(event.request));
  } else if (url.includes('/data/') && url.endsWith('.json')) {
    // JSON data
    event.respondWith(handleDataRequest(event.request));
  } else {
    // App shell and other resources
    event.respondWith(handleAppShellRequest(event.request));
  }
});

// Listen for messages from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Handle cache warming request
  if (event.data && event.data.type === 'CACHE_URLS') {
    const urls = event.data.urls;
    if (Array.isArray(urls) && urls.length > 0) {
      console.log('[Service Worker] Received request to cache URLs:', urls);
      
      // Group URLs by cache type
      const audioUrls = [];
      const imageUrls = [];
      const dataUrls = [];
      const appShellUrls = [];
      
      urls.forEach(url => {
        const cacheName = getCacheName(url);
        if (cacheName === AUDIO_CACHE) {
          audioUrls.push(url);
        } else if (cacheName === IMAGE_CACHE) {
          imageUrls.push(url);
        } else if (cacheName === DATA_CACHE) {
          dataUrls.push(url);
        } else {
          appShellUrls.push(url);
        }
      });
      
      // Cache each group
      const cachePromises = [];
      
      if (audioUrls.length > 0) {
        cachePromises.push(
          caches.open(AUDIO_CACHE).then(cache => {
            return Promise.all(
              audioUrls.map(url => {
                console.log(`[Service Worker] Caching audio URL: ${url}`);
                return fetch(url, { mode: 'no-cors' })
                  .then(response => {
                    // For no-cors responses, we can't check status
                    if (response) {
                      return cache.put(url, response);
                    }
                    throw new Error('No response');
                  })
                  .catch(error => {
                    console.error(`[Service Worker] Failed to cache audio URL: ${url}`, error);
                  });
              })
            );
          })
        );
      }
      
      if (imageUrls.length > 0) {
        cachePromises.push(
          caches.open(IMAGE_CACHE).then(cache => {
            return Promise.all(
              imageUrls.map(url => {
                console.log(`[Service Worker] Caching image URL: ${url}`);
                return fetch(url, { mode: 'no-cors' })
                  .then(response => {
                    // For no-cors responses, we can't check status
                    if (response) {
                      return cache.put(url, response);
                    }
                    throw new Error('No response');
                  })
                  .catch(error => {
                    console.error(`[Service Worker] Failed to cache image URL: ${url}`, error);
                  });
              })
            );
          })
        );
      }
      
      if (dataUrls.length > 0) {
        cachePromises.push(
          caches.open(DATA_CACHE).then(cache => {
            return Promise.all(
              dataUrls.map(url => {
                console.log(`[Service Worker] Caching data URL: ${url}`);
                return fetch(url)
                  .then(response => {
                    if (!response || !response.ok) {
                      throw new Error(`Bad response status: ${response ? response.status : 'no response'}`);
                    }
                    return cache.put(url, response);
                  })
                  .catch(error => {
                    console.error(`[Service Worker] Failed to cache data URL: ${url}`, error);
                  });
              })
            );
          })
        );
      }
      
      if (appShellUrls.length > 0) {
        cachePromises.push(
          caches.open(APP_SHELL_CACHE).then(cache => {
            return Promise.all(
              appShellUrls.map(url => {
                console.log(`[Service Worker] Caching app shell URL: ${url}`);
                return fetch(url)
                  .then(response => {
                    if (!response || !response.ok) {
                      throw new Error(`Bad response status: ${response ? response.status : 'no response'}`);
                    }
                    return cache.put(url, response);
                  })
                  .catch(error => {
                    console.error(`[Service Worker] Failed to cache app shell URL: ${url}`, error);
                  });
              })
            );
          })
        );
      }
      
      // Wait for all caching to complete
      event.waitUntil(Promise.all(cachePromises));
    }
  }
}); 