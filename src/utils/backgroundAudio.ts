// src/utils/backgroundAudio.ts

// 1-second silent WAV encoded as base64
const SILENT_AUDIO_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';

let bgAudioEl: HTMLAudioElement | null = null;
let wakeLockSentinel: WakeLockSentinel | null = null;

export function initBackgroundAudioAnchor(): HTMLAudioElement {
  if (!bgAudioEl) {
    bgAudioEl = new Audio(SILENT_AUDIO_URI);
    bgAudioEl.loop = true;
    bgAudioEl.volume = 0.01; // Low volume keeps the OS audio session active without audible hiss
  }
  return bgAudioEl;
}

export async function startBackgroundAudioSession() {
  const el = initBackgroundAudioAnchor();
  try {
    await el.play();
  } catch (err) {
    console.warn('Background audio anchor autoplay prevented:', err);
  }

  // Request foreground wake lock
  if ('wakeLock' in navigator) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
    } catch {
      // Ignored if device battery is low or unsupported
    }
  }
}

export function pauseBackgroundAudioSession() {
  if (bgAudioEl && !bgAudioEl.paused) {
    bgAudioEl.pause();
  }
  if (wakeLockSentinel) {
    wakeLockSentinel.release().catch(() => {});
    wakeLockSentinel = null;
  }
}