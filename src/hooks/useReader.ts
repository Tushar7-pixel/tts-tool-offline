// src/hooks/useReader.ts
import { useState, useRef, useEffect, useCallback } from "react";
import { synthesize, cancelPendingSynthesis, clearTTSQueue } from "../utils/tts";
import { updateBookProgress } from "../utils/db";

type LinePos = { pageIdx: number; lineIdx: number; text: string };
type CacheKeyData = { voiceId: string; pageIdx: number; lineIdx: number };

const PREFETCH_LINES = 2;

function posKey(pageIdx: number, lineIdx: number, voiceId?: string) {
  return JSON.stringify([voiceId || "default", pageIdx, lineIdx]);
}

function parseCacheKey(key: string): CacheKeyData | null {
  try {
    const [voiceId, pageIdx, lineIdx] = JSON.parse(key);
    return { voiceId, pageIdx, lineIdx };
  } catch {
    return null;
  }
}

export function useReader(
  bookId: string | null,
  pages: string[][],
  initialPage: number,
  initialLine: number,
  voiceId?: string
) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [currentLine, setCurrentLine] = useState(initialLine);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1.0);

  const audioRef = useRef<HTMLAudioElement | null>(new Audio());
  const speedRef = useRef<number>(1.0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const sessionRef = useRef(0);
  const pagesRef = useRef(pages);
  const bookIdRef = useRef(bookId);
  const currentPageRef = useRef(initialPage);
  const currentLineRef = useRef(initialLine);
  const voiceIdRef = useRef(voiceId);
  const isPlayingRef = useRef(false);

  const blobCacheRef = useRef<Map<string, Blob>>(new Map());
  const inflightRef = useRef<Map<string, Promise<Blob | null>>>(new Map());
  const objectUrlRef = useRef<string | null>(null);

  const prefetchSessionRef = useRef<{ session: number; page: number; startLine: number } | null>(null);

  pagesRef.current = pages;
  bookIdRef.current = bookId;

  useEffect(() => {
    speedRef.current = speed;
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  useEffect(() => {
    setCurrentPage(initialPage);
    setCurrentLine(initialLine);
    currentPageRef.current = initialPage;
    currentLineRef.current = initialLine;
  }, [bookId, initialPage, initialLine]);

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const pruneCacheToPage = useCallback((pageIdx: number) => {
    for (const key of [...blobCacheRef.current.keys()]) {
      const parsed = parseCacheKey(key);
      if (!parsed) {
        blobCacheRef.current.delete(key);
        continue;
      }
      if (parsed.pageIdx !== pageIdx) {
        blobCacheRef.current.delete(key);
      }
    }
  }, []);

  const goToPage = useCallback(
    (pageIdx: number, lineIdx: number) => {
      currentPageRef.current = pageIdx;
      currentLineRef.current = lineIdx;
      pruneCacheToPage(pageIdx);
      setCurrentPage(pageIdx);
      setCurrentLine(lineIdx);
    },
    [pruneCacheToPage]
  );

  const stopSession = useCallback(() => {
    sessionRef.current += 1;
    prefetchSessionRef.current = null;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
    }
    revokeObjectUrl();
    clearTTSQueue();
  }, [revokeObjectUrl]);

  const requestWakeLock = useCallback(async () => {
    if ("wakeLock" in navigator && !wakeLockRef.current) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch (error) {
        console.warn("Wake Lock request failed:", error);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch { }
      wakeLockRef.current = null;
    }
  }, []);

  const getBlob = useCallback(
    (pos: LinePos, session: number): Promise<Blob | null> => {
      const key = posKey(pos.pageIdx, pos.lineIdx, voiceIdRef.current);
      const cached = blobCacheRef.current.get(key);
      if (cached) return Promise.resolve(cached);

      const existing = inflightRef.current.get(key);
      if (existing) return existing;

      const request = synthesize(pos.text, voiceIdRef.current)
        .then((blob) => {
          if (session !== sessionRef.current) return null;
          if (!blob) return null;

          const keepPage = currentPageRef.current;
          if (pos.pageIdx === keepPage || pos.pageIdx === keepPage + 1) {
            blobCacheRef.current.set(key, blob);
          }
          return blob;
        })
        .catch((error) => {
          if (session === sessionRef.current) {
            console.error("[Reader] TTS synthesis failed:", error);
          }
          return null;
        })
        .finally(() => {
          const current = inflightRef.current.get(key);
          if (current === request) {
            inflightRef.current.delete(key);
          }
        });

      inflightRef.current.set(key, request);
      return request;
    },
    []
  );

  const startBackgroundProcessing = useCallback(
    (pageIdx: number, startLineIdx: number, session: number) => {
      const previous = prefetchSessionRef.current;
      if (
        previous?.session === session &&
        previous.page === pageIdx &&
        previous.startLine === startLineIdx
      ) {
        return;
      }
      prefetchSessionRef.current = { session, page: pageIdx, startLine: startLineIdx };

      const pageLines = pagesRef.current[pageIdx];
      if (!pageLines) return;

      const endLine = Math.min(pageLines.length, startLineIdx + PREFETCH_LINES);
      let chain = Promise.resolve();

      for (let lineIdx = startLineIdx; lineIdx < endLine; lineIdx++) {
        const text = pageLines[lineIdx];
        const key = posKey(pageIdx, lineIdx, voiceIdRef.current);
        if (blobCacheRef.current.has(key) || inflightRef.current.has(key)) continue;

        const pos: LinePos = { pageIdx, lineIdx, text };
        chain = chain.then(async () => {
          if (session !== sessionRef.current) return;
          await getBlob(pos, session);
        });
      }
    },
    [getBlob]
  );

  const finishPlayback = useCallback(async () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    prefetchSessionRef.current = null;
    await releaseWakeLock();
  }, [releaseWakeLock]);

  const playLineAt = useCallback(
    async (pageIdx: number, lineIdx: number) => {
      const session = sessionRef.current;
      const bookPages = pagesRef.current;

      if (pageIdx >= bookPages.length) {
        await finishPlayback();
        return;
      }

      const pageLines = bookPages[pageIdx];

      if (!pageLines || lineIdx >= pageLines.length) {
        const nextPage = pageIdx + 1;
        if (nextPage < bookPages.length) {
          goToPage(nextPage, 0);
          const id = bookIdRef.current;
          if (id) updateBookProgress(id, nextPage, 0);

          startBackgroundProcessing(nextPage, 0, session);
          await playLineAt(nextPage, 0);
        } else {
          await finishPlayback();
        }
        return;
      }

      try {
        startBackgroundProcessing(pageIdx, lineIdx, session);

        const blob = await getBlob(
          { pageIdx, lineIdx, text: pageLines[lineIdx] },
          session
        );

        if (session !== sessionRef.current || !isPlayingRef.current) return;

        if (!blob) {
          console.error(`[Reader] TTS returned no audio for page ${pageIdx}, line ${lineIdx}.`);
          await finishPlayback();
          return;
        }

        const url = URL.createObjectURL(blob);
        revokeObjectUrl();
        objectUrlRef.current = url;
        const audio = audioRef.current;
        if (!audio) return;

        audio.src = url;
        audio.playbackRate = speedRef.current;

        audio.onended = async () => {
          if (session !== sessionRef.current || !isPlayingRef.current) return;

          revokeObjectUrl();
          const nextLine = lineIdx + 1;
          currentLineRef.current = nextLine;
          setCurrentLine(nextLine);
          const id = bookIdRef.current;
          if (id) updateBookProgress(id, pageIdx, nextLine);

          // === SMART PAUSING LOGIC ===
          // Check the terminal character of the line that just finished playing
          const text = pageLines[lineIdx].trim();
          const lastChar = text.slice(-1);
          const isTerminalPunctuation = /[.?!—:;]/.test(lastChar) || text.endsWith("...");

          if (isTerminalPunctuation) {
            // Apply a micro-pause proportional to the user's reading speed
            const delayMs = 400 / speedRef.current;
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }

          // Double check if user manually paused *during* the micro-pause timeout
          if (session !== sessionRef.current || !isPlayingRef.current) return;
          // ===========================

          void playLineAt(pageIdx, nextLine);
        };

        await audio.play();
      } catch (error) {
        if (session !== sessionRef.current) return;
        console.error("[Reader] Audio playback error:", error);
        await finishPlayback();
      }
    },
    [finishPlayback, getBlob, goToPage, revokeObjectUrl, startBackgroundProcessing]
  );

  useEffect(() => {
    if (voiceIdRef.current === voiceId) return;
    const wasPlaying = isPlayingRef.current;
    voiceIdRef.current = voiceId;
    sessionRef.current += 1;
    const newSession = sessionRef.current;
    prefetchSessionRef.current = null;

    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
    }
    revokeObjectUrl();
    blobCacheRef.current.clear();
    inflightRef.current.clear();
    cancelPendingSynthesis();
    startBackgroundProcessing(currentPageRef.current, currentLineRef.current, newSession);

    if (wasPlaying) {
      isPlayingRef.current = true;
      setIsPlaying(true);
      void playLineAt(currentPageRef.current, currentLineRef.current);
    }
  }, [voiceId, playLineAt, revokeObjectUrl, startBackgroundProcessing]);

  useEffect(() => {
    sessionRef.current += 1;
    prefetchSessionRef.current = null;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
    }
    revokeObjectUrl();
    blobCacheRef.current.clear();
    inflightRef.current.clear();
    isPlayingRef.current = false;
    setIsPlaying(false);
    cancelPendingSynthesis();
  }, [bookId, revokeObjectUrl]);

  const togglePlay = useCallback(async () => {
    if (isPlayingRef.current) {
      stopSession();
      isPlayingRef.current = false;
      setIsPlaying(false);
      await releaseWakeLock();
      return;
    }
    isPlayingRef.current = true;
    setIsPlaying(true);
    await requestWakeLock();
    void playLineAt(currentPageRef.current, currentLineRef.current);
  }, [playLineAt, releaseWakeLock, requestWakeLock, stopSession]);

  const jumpTo = useCallback(
    (pageIdx: number, lineIdx: number = 0) => {
      const wasPlaying = isPlayingRef.current;
      const pageChanged = pageIdx !== currentPageRef.current;

      stopSession();
      currentPageRef.current = pageIdx;
      currentLineRef.current = lineIdx;

      if (pageChanged) {
        goToPage(pageIdx, lineIdx);
      } else {
        setCurrentLine(lineIdx);
      }

      const id = bookIdRef.current;
      if (id) updateBookProgress(id, pageIdx, lineIdx);

      sessionRef.current += 1;
      const session = sessionRef.current;

      startBackgroundProcessing(pageIdx, lineIdx, session);

      if (wasPlaying) {
        isPlayingRef.current = true;
        setIsPlaying(true);
        void playLineAt(pageIdx, lineIdx);
      }
    },
    [goToPage, playLineAt, startBackgroundProcessing, stopSession]
  );

  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.pause();
      }
      revokeObjectUrl();
      cancelPendingSynthesis();
      blobCacheRef.current.clear();
      inflightRef.current.clear();
      void releaseWakeLock();
    };
  }, [releaseWakeLock, revokeObjectUrl]);

  return {
    currentPage,
    currentLine,
    isPlaying,
    speed,
    setSpeed,
    togglePlay,
    jumpTo,
  };
}