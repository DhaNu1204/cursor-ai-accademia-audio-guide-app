# cursor-ai-accademia-audio-guide-app

# Accademia Gallery Audio Guide

A Progressive Web App (PWA) that serves as an audio guide for visitors to the Accademia Gallery in Florence. The app provides audio commentary, images, and descriptions for exhibits in multiple languages with offline support.

## 🚀 Features

- **Multi-language Support**: 18 languages available for exhibit information and audio
- **Progressive Web App**: Full offline support with caching of audio, images, and text
- **Responsive Design**: Optimized for mobile devices, tablets, and desktops
- **Audio Player**: Custom-built audio player with playback controls
- **Automatic Content Download**: Downloads all necessary content after language selection
- **Offline Mode**: Works without internet connection once content is downloaded

## 📱 Installation (End Users)

1. Visit [https://accfree.nextaudioguides.com](https://accfree.nextaudioguides.com) on your mobile device
2. For the best experience, add the app to your home screen:
   - iOS: Tap the share icon and select "Add to Home Screen"
   - Android: Tap the menu button and select "Add to Home Screen" or "Install App"

## 🛠️ Development Setup

### Prerequisites

- Node.js v16+ and npm
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/accademia-audio-guide.git
   cd accademia-audio-guide
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

5. Preview the production build:
   ```bash
   npm run preview
   ```

## 🏗️ Project Structure

```
accademia-audio-guide/
├── public/                 # Static assets
│   ├── assets/             # Images, audio files, and other media
│   ├── custom-sw.js        # Custom service worker for offline support
│   └── manifest.webmanifest # PWA manifest file
├── src/
│   ├── components/         # Reusable UI components
│   ├── contexts/           # React context providers
│   ├── data/               # Static data files
│   ├── hooks/              # Custom React hooks
│   ├── pages/              # Page components
│   ├── services/           # Service modules for API/data handling
│   ├── types/              # TypeScript type definitions
│   └── utils/              # Utility functions
├── vite.config.ts          # Vite configuration
└── package.json            # Dependencies and scripts
```

## 📋 Key Components

### Core Components

- **App.tsx**: Main application component with routing
- **LanguageSelection.tsx**: Language selection page
- **ExhibitList.tsx**: List of all exhibits
- **ExhibitDetails.tsx**: Detailed view of an exhibit with audio player

### Context Providers

- **LanguageContext.tsx**: Manages the selected language and UI text
- **AudioPlayerContext.tsx**: Controls audio playback
- **OfflineDownloadContext.tsx**: Manages downloading and caching of content
- **ValidationContext.tsx**: Handles validation codes for restricted areas

### Service Files

- **downloadService.ts**: Handles the downloading and caching of files
- **imageService.ts**: Manages image loading with offline support
- **audioService.ts**: Controls audio loading and playback

### Utility Files

- **improvedAudioUtils.ts**: Enhanced audio handling utilities
- **cacheUtils.ts**: Cache management utilities
- **storage.ts**: Local storage utilities

## 🔄 Data Flow

1. User selects a language
2. App downloads all required content for that language
3. User navigates to exhibits list
4. User selects an exhibit to view details and listen to audio
5. All content is served from cache when offline

## 💾 Caching Strategy

The app uses a multi-layered caching approach:

1. **Language-specific Caches**: 
   - `accademia-audio-{language}` - Audio files for specific language
   - `accademia-images-{language}` - Images for specific language

2. **General Caches**:
   - `accademia-cache-v1` - Core app assets
   - `audio-cache-v6` - Audio files
   - `images-cache-v6` - Images
   - `static-resources` - JavaScript, CSS, and other static assets

## 🛠️ Developer Tools

The app includes developer tools to help with debugging and testing:

1. **Cache Inspector** (`/cache-inspector`):
   - View all cached content and storage usage
   - Clear specific caches or all caches
   - Test offline mode
   - Unregister service worker

2. **Audio Test Page** (`/audio-test`):
   - Test audio playback
   - Check audio caching

## ⚠️ Common Issues and Solutions

### Service Worker Registration Errors

If you see "ServiceWorker script evaluation failed" in the console:

```
Failed to register a ServiceWorker for scope ('https://accfree.nextaudioguides.com/') with script ('https://accfree.nextaudioguides.com/custom-sw.js'): ServiceWorker script evaluation failed
```

**Solution**:
1. Open the application in an incognito/private window
2. Clear browser cache and then reload
3. Ensure the service worker script is valid JavaScript

### Precache Conflicts

If you see "add-to-cache-list-conflicting-entries" errors:

```
Uncaught add-to-cache-list-conflicting-entries: add-to-cache-list-conflicting-entries :: [{"firstEntry":"https://accfree.nextaudioguides.com/assets/images/pwa-192x192.png","secondEntry":"https://accfree.nextaudioguides.com/assets/images/pwa-192x192.png?__WB_REVISION__=885603db51e892d19f67571d30e0292a"}]
```

**Solution**:
1. Update `vite.config.ts` to exclude the conflicting files from the precache list
2. Use the Cache Inspector to clear all caches, then reload the application

### Offline Image Display Issues

If images don't appear when offline:

**Solution**:
1. Ensure the images were properly cached during the download process
2. Check that the URL formats match between caching and retrieval
3. Use the Cache Inspector to verify the images are in the cache

## 📱 Mobile Performance Considerations

- **Bundle Size**: Keep JavaScript bundle size under 500KB for better loading on slow connections
- **Image Optimization**: Use appropriate image sizes for thumbnails vs. full-size images
- **Network Detection**: Always check network status before making requests
- **Progressive Enhancement**: Start with core functionality and enhance when resources allow
- **Memory Management**: Release resources (like audio) when not in use

## 🔄 Updating the App

When making changes to the application:

1. **Service Worker**: Always increment cache version numbers when modifying caching strategies
2. **Assets**: Use content hashing for file names to ensure cache invalidation
3. **Testing**: Always test both online and offline scenarios

## 📄 License

This project is proprietary software. All rights reserved.

## 👥 Contributors

- Your Name - Initial work and maintenance

## 📊 Analytics

The app collects anonymous usage data to improve user experience. No personal information is collected.
