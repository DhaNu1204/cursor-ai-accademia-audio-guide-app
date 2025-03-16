// Custom Service Worker for Accademia Audio Guide
// This service worker focuses on caching audio files for offline use

// Import Workbox from the CDN
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

// Use the workbox precaching module
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

const CACHE_NAME = 'accademia-cache-v1';
const AUDIO_CACHE_NAME = 'audio-cache-v6';
const IMAGE_CACHE_NAME = 'images-cache-v6';

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing new service worker...');
  
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating new service worker...');
  
  // Take control of all clients immediately
  event.waitUntil(clients.claim());
  
  // Clean up old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== AUDIO_CACHE_NAME && 
              !cacheName.includes('workbox') && !cacheName.includes('static-resources') &&
              !cacheName.includes('accademia-audio') && !cacheName.includes('accademia-images')) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Custom handler for audio files
workbox.routing.registerRoute(
  ({ url }) => url.pathname.endsWith('.mp3'),
  async ({ url, request, event, params }) => {
    return handleAudioRequest(request);
  }
);

// Custom handler for image files
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'image',
  async ({ url, request, event, params }) => {
    return handleImageRequest(request);
  }
);

// Default handler for other assets (scripts, styles)
workbox.routing.registerRoute(
  ({ request }) => 
    request.destination === 'script' || 
    request.destination === 'style' ||
    request.destination === 'document',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'static-resources',
  })
);

// Handle audio requests with special caching strategy
async function handleAudioRequest(request) {
  console.log('[Service Worker] Handling audio request:', request.url);
  
  // Extract language from URL for better caching
  const languageMatch = request.url.match(/\/audio\/([a-z]{2})\//);
  const language = languageMatch ? languageMatch[1] : 'unknown';
  console.log(`[Service Worker] Detected language: ${language} for audio request`);
  
  // First, try to get from the language-specific audio cache
  if (language !== 'unknown') {
    try {
      const languageAudioCache = await caches.open(`accademia-audio-${language}`);
      const cachedResponse = await languageAudioCache.match(request);
      
      if (cachedResponse) {
        console.log(`[Service Worker] Serving ${language} audio from language-specific cache:`, request.url);
        return cachedResponse;
      }
    } catch (error) {
      console.error(`[Service Worker] Error accessing ${language} audio cache:`, error);
    }
  }
  
  // Next, try to get from the dedicated audio cache
  try {
    const audioCache = await caches.open(AUDIO_CACHE_NAME);
    const cachedResponse = await audioCache.match(request);
    
    if (cachedResponse) {
      console.log('[Service Worker] Serving audio from cache:', request.url);
      return cachedResponse;
    }
  } catch (error) {
    console.error('[Service Worker] Error accessing audio cache:', error);
  }
  
  // If not in audio cache, try the regular cache
  try {
    const regularCache = await caches.open(CACHE_NAME);
    const cachedResponse = await regularCache.match(request);
    
    if (cachedResponse) {
      console.log('[Service Worker] Serving audio from regular cache:', request.url);
      return cachedResponse;
    }
  } catch (error) {
    console.error('[Service Worker] Error accessing regular cache:', error);
  }
  
  // If not in any cache, try to fetch from network
  try {
    // Check if we're online
    if (!self.navigator.onLine) {
      console.warn(`[Service Worker] Device is offline and ${language} audio not in cache:`, request.url);
      return createOfflineAudioResponse(language);
    }
    
    console.log(`[Service Worker] Fetching ${language} audio from network:`, request.url);
    const networkResponse = await fetch(request);
    
    // Check if we got a valid response
    if (!networkResponse || !networkResponse.ok) {
      console.error(`[Service Worker] Network error fetching ${language} audio:`, request.url, networkResponse?.status);
      
      if (networkResponse?.status === 503) {
        return createServiceUnavailableResponse(language);
      }
      
      return networkResponse || createOfflineAudioResponse(language);
    }
    
    // Clone the response for caching
    const responseToCache = networkResponse.clone();
    
    // Cache the response in the language-specific audio cache
    if (language !== 'unknown') {
      try {
        const languageAudioCache = await caches.open(`accademia-audio-${language}`);
        await languageAudioCache.put(request, responseToCache.clone());
        console.log(`[Service Worker] Cached ${language} audio file in language-specific cache:`, request.url);
      } catch (error) {
        console.error(`[Service Worker] Failed to cache ${language} audio file in language-specific cache:`, error);
      }
    }
    
    // Also cache in the main audio cache for backward compatibility
    try {
      const audioCache = await caches.open(AUDIO_CACHE_NAME);
      await audioCache.put(request, responseToCache);
      console.log('[Service Worker] Cached audio file:', request.url);
    } catch (error) {
      console.error('[Service Worker] Failed to cache audio file:', error);
    }
    
    return networkResponse;
  } catch (error) {
    console.error(`[Service Worker] Fetch error for ${language} audio:`, error);
    return createOfflineAudioResponse(language);
  }
}

// Handle image requests with special caching strategy
async function handleImageRequest(request) {
  console.log('[Service Worker] Handling image request:', request.url);
  
  // Extract language if present in the URL
  const languageMatch = request.url.match(/\/(images|thumbnail)\/([a-z]{2})\//);
  const language = languageMatch ? languageMatch[2] : 'unknown';
  const isThumb = request.url.includes('thumbnail') || request.url.includes('thumb');
  
  // Try to extract exhibit ID from URL for better logging
  let exhibitId = 'unknown';
  const idMatch = request.url.match(/ID-(\d+)|exhibit-(\d+)/);
  if (idMatch) {
    exhibitId = idMatch[1] || idMatch[2];
  }
  
  console.log(`[Service Worker] Image request: language=${language}, thumb=${isThumb}, exhibitId=${exhibitId}`);
  
  // Use different strategies for language-specific and global images
  if (language !== 'unknown') {
    // For language-specific images, try language cache first
    try {
      const languageImageCache = await caches.open(`accademia-images-${language}`);
      const cachedResponse = await languageImageCache.match(request);
      
      if (cachedResponse) {
        console.log(`[Service Worker] Serving image from language cache: ${request.url}`);
        return cachedResponse;
      }
    } catch (error) {
      console.error(`[Service Worker] Error accessing language image cache:`, error);
    }
  }
  
  // Try to look for alternative URLs in cache
  if (isThumb && exhibitId !== 'unknown' && language !== 'unknown') {
    // Construct standard thumbnail format
    const standardThumbUrl = `https://accfree.nextaudioguides.com/assets/thumbnail/${language}/ID-${exhibitId}-thumbnail.jpg`;
    const altThumbUrl = `https://accfree.nextaudioguides.com/assets/thumb/${language}/ID-${exhibitId}-thumbnail.jpg`;
    
    // Try both the version cache and language-specific cache
    const cacheNames = [
      `accademia-images-${language}`,
      IMAGE_CACHE_NAME,
      'images-cache'
    ];
    
    for (const cacheName of cacheNames) {
      try {
        const cache = await caches.open(cacheName);
        
        // Try standard format
        if (request.url !== standardThumbUrl) {
          const standardRequest = new Request(standardThumbUrl);
          const standardResponse = await cache.match(standardRequest);
          
          if (standardResponse) {
            console.log(`[Service Worker] Found image with standard URL in ${cacheName}: ${standardThumbUrl}`);
            return standardResponse;
          }
        }
        
        // Try alternative format
        if (request.url !== altThumbUrl) {
          const altRequest = new Request(altThumbUrl);
          const altResponse = await cache.match(altRequest);
          
          if (altResponse) {
            console.log(`[Service Worker] Found image with alt URL in ${cacheName}: ${altThumbUrl}`);
            return altResponse;
          }
        }
      } catch (e) {
        console.warn(`[Service Worker] Error checking ${cacheName}:`, e);
      }
    }
  }
  
  // If not in language-specific cache, try the general image cache
  try {
    const imageCache = await caches.open(IMAGE_CACHE_NAME);
    const cachedResponse = await imageCache.match(request);
    
    if (cachedResponse) {
      console.log(`[Service Worker] Serving image from general cache: ${request.url}`);
      return cachedResponse;
    }
  } catch (error) {
    console.error(`[Service Worker] Error accessing general image cache:`, error);
  }
  
  // If not in any cache, try to fetch from network
  try {
    // Check if we're online
    if (!self.navigator.onLine) {
      console.warn(`[Service Worker] Device is offline and image not in cache: ${request.url}`);
      return createOfflineImageResponse(isThumb, exhibitId);
    }
    
    console.log(`[Service Worker] Fetching image from network: ${request.url}`);
    const networkResponse = await fetch(request, {
      // Use no-cors mode for cross-origin image requests
      mode: request.url.startsWith(self.location.origin) ? 'same-origin' : 'no-cors'
    });
    
    // Check if we got a valid response
    if (!networkResponse || (!networkResponse.ok && networkResponse.type !== 'opaque')) {
      console.error(`[Service Worker] Network error fetching image:`, request.url, networkResponse?.status);
      return networkResponse || createOfflineImageResponse(isThumb, exhibitId);
    }
    
    // Clone the response for caching
    const responseToCache = networkResponse.clone();
    
    // Cache in language-specific cache if applicable
    if (language !== 'unknown') {
      try {
        const languageImageCache = await caches.open(`accademia-images-${language}`);
        await languageImageCache.put(request, responseToCache.clone());
        console.log(`[Service Worker] Cached image in language cache: ${request.url}`);
      } catch (error) {
        console.error(`[Service Worker] Failed to cache image in language cache:`, error);
      }
    }
    
    // Also cache in general image cache
    try {
      const imageCache = await caches.open(IMAGE_CACHE_NAME);
      await imageCache.put(request, responseToCache);
      console.log(`[Service Worker] Cached image in general cache: ${request.url}`);
    } catch (error) {
      console.error(`[Service Worker] Failed to cache image:`, error);
    }
    
    return networkResponse;
  } catch (error) {
    console.error(`[Service Worker] Image fetch failed:`, error);
    return createOfflineImageResponse(isThumb, exhibitId);
  }
}

// Create a response for offline audio
function createOfflineAudioResponse(language = 'unknown') {
  return new Response(
    JSON.stringify({
      error: 'offline',
      message: `This ${language} audio file is not available offline. Please download it when online.`
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json',
        'X-Is-Offline': 'true',
        'X-Language': language
      }
    }
  );
}

// Create a response for service unavailable
function createServiceUnavailableResponse(language = 'unknown') {
  return new Response(
    JSON.stringify({
      error: 'service_unavailable',
      message: `The ${language} audio service is currently unavailable. Please try again later.`
    }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: {
        'Content-Type': 'application/json',
        'X-Language': language
      }
    }
  );
}

// Create a response for offline images
function createOfflineImageResponse(isThumb = false, exhibitId = 'unknown') {
  const hue = (parseInt(exhibitId, 10) || 0) * 37 % 360;
  const svgContent = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${isThumb ? 150 : 300}" height="${isThumb ? 100 : 200}" viewBox="0 0 150 100">
      <rect width="100%" height="100%" fill="hsl(${hue}, 70%, 80%)"/>
      <text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" fill="#333" dominant-baseline="middle">
        Offline: ID-${exhibitId}
      </text>
    </svg>
  `;
  
  return new Response(svgContent.trim(), {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'X-Is-Offline': 'true'
    }
  });
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}); 