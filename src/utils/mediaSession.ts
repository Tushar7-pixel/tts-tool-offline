// src/utils/mediaSession.ts

interface MediaSessionOptions {
    title: string;
    artist?: string;
    album?: string;
    onPlay: () => void;
    onPause: () => void;
    onNext?: () => void;
    onPrev?: () => void;
  }
  
  export function setupMediaSession({
    title,
    artist = 'Piper Book Reader',
    album = 'Audiobook',
    onPlay,
    onPause,
    onNext,
    onPrev,
  }: MediaSessionOptions) {
    if (!('mediaSession' in navigator)) return;
  
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album,
      artwork: [
        { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  
    navigator.mediaSession.setActionHandler('play', onPlay);
    navigator.mediaSession.setActionHandler('pause', onPause);
  
    if (onNext) {
      navigator.mediaSession.setActionHandler('nexttrack', onNext);
    }
    if (onPrev) {
      navigator.mediaSession.setActionHandler('previoustrack', onPrev);
    }
  }
  
  export function updateMediaSessionState(isPlaying: boolean) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }