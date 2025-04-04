import { useState, useEffect, useRef, useCallback } from 'react';
import { getCachedAudio, storeAudioFile } from './useOfflineStorage';
import { loadAudioWithCorsWorkaround, isAudioCachedForOffline } from '../utils/improvedAudioUtils';

// Helper function to convert local paths to full URLs if needed
export const getFullAudioUrl = (url: string): string => {
  // Log the incoming URL for debugging
  console.log('getFullAudioUrl input:', url);
  
  // If it's already a full URL, return it as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    console.log('URL is already absolute, using as is');
    return url;
  }
  
  // Extract language code from audio path for debugging
  let languageCode = 'unknown';
  const audioPathMatch = url.match(/\/assets\/audio\/([a-z]{2})\//);
  if (audioPathMatch && audioPathMatch[1]) {
    languageCode = audioPathMatch[1];
  }
  
  // If it's a local path starting with /assets/audio, convert it to the external URL
  if (url.startsWith('/assets/audio/')) {
    const externalUrl = `https://accfree.nextaudioguides.com${url}`;
    console.log(`Converting local audio path to external URL for language ${languageCode}:`);
    console.log(`- From: ${url}`);
    console.log(`- To: ${externalUrl}`);
    
    // We no longer need cache busting as it can interfere with caching
    // const cacheBuster = `?t=${Date.now()}`;
    // const finalUrl = `${externalUrl}${cacheBuster}`;
    
    return externalUrl;
  }
  
  // Otherwise, return the original URL
  console.log('URL does not match known patterns, using as is');
  return url;
};

// Define the return type of the hook
interface UseAudioPlayerResult {
  audioUrl: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  formatTime: (timeInSeconds: number) => string;
  progressPercentage: number;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  skipForward: () => void;
  skipBackward: () => void;
  loadAudio: (url: string) => Promise<void>;
}

/**
 * Hook for audio playback functionality
 * @param initialAudioUrl - Optional initial audio URL
 * @param initialPlaybackRate - Optional initial playback rate (default: 1)
 * @returns Audio player controls and state
 */
const useAudioPlayer = (
  initialAudioUrl: string = '',
  initialPlaybackRate: number = 1
): UseAudioPlayerResult => {
  const [audioUrl, setAudioUrl] = useState<string>(initialAudioUrl);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(initialPlaybackRate);
  const [objectUrlToCleanup, setObjectUrlToCleanup] = useState<string | null>(null);
  
  // Use a ref for the audio element to persist between renders
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Create the audio element on mount
  useEffect(() => {
    // Create audio element if not already created
    if (!audioRef.current) {
      audioRef.current = new Audio();
      
      // Set initial playback rate
      audioRef.current.playbackRate = playbackRate;
    }
    
    // Cleanup function to remove event listeners and release audio resources
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);
  
  // Update audio src when URL changes
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl;
      audioRef.current.load();
    }
  }, [audioUrl]);
  
  // Update playback rate when it changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);
  
  // Set up event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Event handlers
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleDurationChange = () => {
      setDuration(audio.duration);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };
    
    const handlePlay = () => {
      setIsPlaying(true);
    };
    
    const handlePause = () => {
      setIsPlaying(false);
    };
    
    const handleError = (e: ErrorEvent) => {
      console.error('Audio playback error:', e);
      setIsPlaying(false);
    };
    
    // Add event listeners
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError as EventListener);
    
    // Cleanup function
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError as EventListener);
    };
  }, []);
  
  // Clean up object URLs when they change
  useEffect(() => {
    return () => {
      if (objectUrlToCleanup) {
        URL.revokeObjectURL(objectUrlToCleanup);
      }
    };
  }, [objectUrlToCleanup]);
  
  // Play function
  const play = useCallback(() => {
    if (audioRef.current) {
      // Using the play() Promise to handle autoplay restrictions
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
        setIsPlaying(false);
      });
    }
  }, []);
  
  // Pause function
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);
  
  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);
  
  // Seek to a specific time
  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      if (time < 0) {
        audioRef.current.currentTime = 0;
      } else if (time > audioRef.current.duration) {
        audioRef.current.currentTime = audioRef.current.duration;
      } else {
        audioRef.current.currentTime = time;
      }
    }
  }, []);
  
  // Set playback rate
  const setRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
  }, []);
  
  // Skip forward 10 seconds
  const skipForward = useCallback(() => {
    if (audioRef.current) {
      seek(audioRef.current.currentTime + 10);
    }
  }, [seek]);
  
  // Skip backward 10 seconds
  const skipBackward = useCallback(() => {
    if (audioRef.current) {
      seek(audioRef.current.currentTime - 10);
    }
  }, [seek]);
  
  // Load a new audio file
  const loadAudio = useCallback(async (url: string) => {
    // Pause current playback
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    
    console.log('loadAudio called with URL:', url);
    
    // Extract language code from the URL for debugging
    let languageCode = 'unknown';
    const audioPathMatch = url.match(/\/assets\/audio\/([a-z]{2})\//);
    if (audioPathMatch && audioPathMatch[1]) {
      languageCode = audioPathMatch[1];
    }
    console.log(`Audio language detected: ${languageCode}`);
    
    // Normalized path (for cache lookup)
    const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  
    // First check if we have a cached version
    const cachedAudio = await getCachedAudio(normalizedPath);
    
    if (cachedAudio) {
      console.log(`Using cached audio file for ${url}`);
      try {
        // Create a blob URL from the cached audio
        const objectUrl = URL.createObjectURL(cachedAudio);
        setAudioUrl(objectUrl);
        setObjectUrlToCleanup(objectUrl);
        
        // Wait for audio to load
        if (audioRef.current) {
          return new Promise<void>((resolve, reject) => {
            const audio = audioRef.current;
            if (!audio) {
              reject(new Error('Audio element not available'));
              return;
            }
            
            audio.src = objectUrl;
            
            const handleCanPlay = () => {
              console.log('Cached audio can play event triggered');
              audio.removeEventListener('canplay', handleCanPlay);
              audio.removeEventListener('error', handleError);
              resolve();
            };
            
            const handleError = (e?: Event) => {
              console.error('Cached audio loading error:', e);
              audio.removeEventListener('canplay', handleCanPlay);
              audio.removeEventListener('error', handleError);
              reject(new Error(`Failed to load cached audio`));
            };
            
            audio.addEventListener('canplay', handleCanPlay);
            audio.addEventListener('error', handleError);
          });
        }
      } catch (cacheError) {
        console.error('Error using cached audio:', cacheError);
        // Continue to try online if cached version fails
      }
    }
    
    // If we don't have a cached version and we're offline, show error
    if (!navigator.onLine) {
      console.error(`Offline and no cached audio available for: ${url}`);
      return Promise.reject(new Error('Offline and audio not cached'));
    }
    
    // We're online and don't have a cached version - fetch from network
    // Convert to full URL if needed
    const fullUrl = getFullAudioUrl(url);
    
    try {
      console.log(`Fetching audio file: ${fullUrl}`);
      
      // Use direct audio element loading instead of fetch for better compatibility
      // This avoids CORS and range request issues
      if (audioRef.current) {
        audioRef.current.src = fullUrl;
        setAudioUrl(fullUrl);
        
        return new Promise<void>((resolve, reject) => {
          const audio = audioRef.current;
          if (!audio) {
            console.error('Audio element not available');
            reject(new Error('Audio element not available'));
            return;
          }
          
          const handleCanPlay = () => {
            console.log('Audio can play event triggered');
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            
            // Try to cache the audio for offline use
            // We'll use a separate fetch with no-cors to cache it
            fetch(fullUrl, { mode: 'no-cors', cache: 'no-store' })
              .then(response => response.blob())
              .then(blob => {
                storeAudioFile(normalizedPath, blob)
                  .then(() => console.log(`Successfully cached audio file: ${normalizedPath}`))
                  .catch(err => console.error(`Failed to cache audio file: ${fullUrl}`, err));
              })
              .catch(err => console.error(`Failed to fetch for caching: ${fullUrl}`, err));
            
            resolve();
          };
          
          const handleError = (e?: Event) => {
            console.error('Audio loading error event:', e);
            if (audio.error) {
              console.error('Audio error details:', {
                code: audio.error.code,
                message: audio.error.message
              });
            }
            
            // Log the browser's media element network state
            const networkState = audio.networkState;
            const networkStateText = [
              'NETWORK_EMPTY', 'NETWORK_IDLE', 'NETWORK_LOADING', 'NETWORK_NO_SOURCE'
            ][networkState];
            
            console.error(`Audio network state: ${networkStateText} (${networkState})`);
            
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            reject(new Error(`Failed to load audio: ${fullUrl}`));
          };
          
          audio.addEventListener('canplay', handleCanPlay);
          audio.addEventListener('error', handleError);
        });
      } else {
        console.error('Audio element ref is null');
        return Promise.reject(new Error('Audio element not initialized'));
      }
    } catch (error) {
      console.error('Error loading audio:', error);
      return Promise.reject(error);
    }
  }, []);
  
  // Helper function to set up basic audio event listeners
  const setupAudioEventListeners = (audio: HTMLAudioElement) => {
    // Event handlers
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const handleDurationChange = () => {
      setDuration(audio.duration);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };
    
    const handlePlay = () => {
      setIsPlaying(true);
    };
    
    const handlePause = () => {
      setIsPlaying(false);
    };
    
    const handleError = (e: ErrorEvent) => {
      console.error('Audio playback error:', e);
      setIsPlaying(false);
    };
    
    // Add event listeners
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError as EventListener);
  };
  
  // Format time in seconds to MM:SS format
  const formatTime = useCallback((timeInSeconds: number): string => {
    if (isNaN(timeInSeconds) || !isFinite(timeInSeconds)) {
      return '00:00';
    }
    
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);
  
  // Calculate progress percentage
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  return {
    audioUrl,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    formatTime,
    progressPercentage,
    play,
    pause,
    togglePlayPause,
    seek,
    setPlaybackRate: setRate,
    skipForward,
    skipBackward,
    loadAudio
  };
};

export default useAudioPlayer; 
