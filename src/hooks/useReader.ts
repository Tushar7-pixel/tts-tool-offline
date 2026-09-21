// src/hooks/useReader.ts
import { useState, useRef, useEffect, useCallback } from "react";
import { synthesize, cancelPendingSynthesis, clearTTSQueue } from "../utils/tts";
import { updateBookProgress } from "../utils/db";

type LinePos = { pageIdx: number; lineIdx: number; text: string };
type CacheKeyData = { voiceId: string; pageIdx: number; lineIdx: number };
// src/hooks/useReader.ts
import { isMobileDevice } from "../utils/tts";

// Prefetch only 1 sentence ahead on mobile to keep the main thread responsive, 4 on desktop
const PREFETCH_LINES = isMobileDevice() ? 2 : 4;
// const PREFETCH_LINES = 5;

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
  voiceId?: string,
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

  // const processedForPage = useCallback((pageIdx: number) => {
  //   const lines: number[] = [];
  //   const activeVoice = voiceIdRef.current || "default";

  //   for (const key of blobCacheRef.current.keys()) {
  //     const parsed = parseCacheKey(key);
  //     if (!parsed) continue;

  //     if (parsed.voiceId === activeVoice && parsed.pageIdx === pageIdx) {
  //       lines.push(parsed.lineIdx);
  //     }
  //   }
  //   lines.sort((a, b) => a - b);
  //   return lines;
  // }, []);

  // const publishProcessed = useCallback((pageIdx: number) => {
  //   // setProcessedLines(processedForPage(pageIdx));
  // }, [processedForPage]);

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
    // publishProcessed(pageIdx);
  }, []);

  const goToPage = useCallback((pageIdx: number, lineIdx: number) => {
    currentPageRef.current = pageIdx;
    currentLineRef.current = lineIdx;
    pruneCacheToPage(pageIdx);
    setCurrentPage(pageIdx);
    setCurrentLine(lineIdx);
  }, [pruneCacheToPage]);

  const stopSession = useCallback(() => {
    sessionRef.current += 1;
    prefetchSessionRef.current = null;

    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
    }
    revokeObjectUrl();
    // setQueuedLines([]);
    
    // Instantly drops stale prefetch lines allowing the worker to grab new page jobs
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
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  const getBlob = useCallback((pos: LinePos, session: number): Promise<Blob | null> => {
    const key = posKey(pos.pageIdx, pos.lineIdx, voiceIdRef.current);
    const cached = blobCacheRef.current.get(key);

    if (cached) return Promise.resolve(cached);
    const existing = inflightRef.current.get(key);
    if (existing) return existing;

    const request = synthesize(pos.text, voiceIdRef.current)
      .then((blob) => {
        if (session !== sessionRef.current) return null;
        const keepPage = currentPageRef.current;

        if (pos.pageIdx === keepPage || pos.pageIdx === keepPage + 1) {
          blobCacheRef.current.set(key, blob);
          // publishProcessed(keepPage);
        }
        return blob;
      })
      .catch((error) => {
        if (session === sessionRef.current) {
          console.error("TTS synthesis failed:", error);
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
  }, []);

  const startBackgroundProcessing = useCallback((pageIdx: number, startLineIdx: number, session: number) => {
    const previous = prefetchSessionRef.current;
    if (previous?.session === session && previous.page === pageIdx && previous.startLine === startLineIdx) {
      return;
    }

    prefetchSessionRef.current = { session, page: pageIdx, startLine: startLineIdx };
    const pageLines = pagesRef.current[pageIdx];
    if (!pageLines) return;

    const endLine = Math.min(pageLines.length, startLineIdx + PREFETCH_LINES);
    const positions: LinePos[] = [];

    for (let lineIdx = startLineIdx; lineIdx < endLine; lineIdx++) {
      positions.push({ pageIdx, lineIdx, text: pageLines[lineIdx] });
    }

    // const pendingLineNumbers = positions
    //   .map((pos) => pos.lineIdx)
    //   .filter((lineIdx) => {
    //     const key = posKey(pageIdx, lineIdx, voiceIdRef.current);
    //     return !blobCacheRef.current.has(key);
    //   });

    // setQueuedLines(pendingLineNumbers.filter((lineIdx) => lineIdx !== startLineIdx));

    // for (const pos of positions) {
    //   void getBlob(pos, session).then(() => {
    //     if (session !== sessionRef.current) return;
    //     setQueuedLines((previousLines) => previousLines.filter((line) => line !== pos.lineIdx));
    //   });
    // }
  }, [getBlob]);

  const finishPlayback = useCallback(async () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    // setQueuedLines([]);
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

          if (id) {
            updateBookProgress(id, nextPage, 0);
          }

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
          {
            pageIdx,
            lineIdx,
            text: pageLines[lineIdx],
          },
          session,
        );

        if (session !== sessionRef.current || !isPlayingRef.current) {
          return;
        }

        // CRITICAL FIX: If blob generation fails entirely, skip to next line gracefully
        // if (!blob) {
        //   console.warn(`Skipped line ${lineIdx} due to synthesis failure.`);
        //   const nextLine = lineIdx + 1;
        //   currentLineRef.current = nextLine;
        //   setCurrentLine(nextLine);
        //   if (bookIdRef.current) {
        //      updateBookProgress(bookIdRef.current, pageIdx, nextLine);
        //   }
        //   void playLineAt(pageIdx, nextLine);
        //   return;
        // }
        if (!blob) {
          console.error(`Synthesis returned empty or failed for line ${lineIdx} on page ${pageIdx}. Halting.`);
          await finishPlayback();
          return;
        }

        const url = URL.createObjectURL(blob);
        revokeObjectUrl();
        objectUrlRef.current = url;

        if (!audioRef.current) {
          return;
        }

        audioRef.current.src = url;
        audioRef.current.playbackRate = speedRef.current;

        audioRef.current.onended = () => {
          if (session !== sessionRef.current || !isPlayingRef.current) {
            return;
          }

          revokeObjectUrl();
          const nextLine = lineIdx + 1;
          currentLineRef.current = nextLine;
          setCurrentLine(nextLine);

          const id = bookIdRef.current;
          if (id) {
            updateBookProgress(id, pageIdx, nextLine);
          }

          void playLineAt(pageIdx, nextLine);
        };

        await audioRef.current.play();
      } catch (error) {
        if (session !== sessionRef.current) {
          return;
        }
        console.error("Audio playback error:", error);
        await finishPlayback();
      }
    },
    [
      finishPlayback,
      getBlob,
      goToPage,
      revokeObjectUrl,
      startBackgroundProcessing,
    ],
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
    // setQueuedLines([]);
    // setProcessedLines([]);

    cancelPendingSynthesis();
    startBackgroundProcessing(currentPageRef.current, currentLineRef.current, newSession);

    if (wasPlaying) {
      isPlayingRef.current = true;
      setIsPlaying(true);
      void playLineAt(currentPageRef.current, currentLineRef.current);
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceId]); 

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
    // setQueuedLines([]);
    // setProcessedLines([]);
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

  const jumpTo = useCallback((pageIdx: number, lineIdx: number = 0) => {
    const wasPlaying = isPlayingRef.current;
    
    // 1. Calculate page change BEFORE refs are mutated
    const pageChanged = pageIdx !== currentPageRef.current;
    
    stopSession();

    // 2. Safely mutate refs
    currentPageRef.current = pageIdx;
    currentLineRef.current = lineIdx;

    // 3. Route interface updates accurately 
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
  }, [goToPage, playLineAt, startBackgroundProcessing, stopSession]);

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