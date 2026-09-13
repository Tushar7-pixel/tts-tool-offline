// src/hooks/useReader.ts
import { useState, useRef, useEffect } from "react";
import { synthesize } from "../utils/tts";
import { updateBookProgress } from "../utils/db";

const PREFETCH_AHEAD = 3;

type LinePos = { pageIdx: number; lineIdx: number; text: string };

function posKey(pageIdx: number, lineIdx: number) {
  return `${pageIdx}:${lineIdx}`;
}

function collectLines(
  pages: string[][],
  pageIdx: number,
  lineIdx: number,
  count: number,
): LinePos[] {
  const result: LinePos[] = [];
  let p = pageIdx;
  let l = lineIdx;

  while (result.length < count && p < pages.length) {
    const page = pages[p];
    if (!page || l >= page.length) {
      p += 1;
      l = 0;
      continue;
    }
    result.push({ pageIdx: p, lineIdx: l, text: page[l] });
    l += 1;
  }

  return result;
}

export function useReader(
  bookId: string | null,
  pages: string[][],
  initialPage: number,
  initialLine: number,
) {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [currentLine, setCurrentLine] = useState(initialLine);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1.0);
  const [queuedLines, setQueuedLines] = useState<number[]>([]);
  const [processedLines, setProcessedLines] = useState<number[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(new Audio());
  const speedRef = useRef<number>(1.0);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const sessionRef = useRef(0);
  const pagesRef = useRef(pages);
  const bookIdRef = useRef(bookId);
  const currentPageRef = useRef(initialPage);
  const isPlayingRef = useRef(false);
  const blobCacheRef = useRef(new Map<string, Blob>());
  const inflightRef = useRef(new Map<string, Promise<Blob>>());
  const synthChainRef = useRef(Promise.resolve<void>(undefined));
  const objectUrlRef = useRef<string | null>(null);

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
  }, [bookId, initialPage, initialLine]);

  useEffect(() => {
    sessionRef.current += 1;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    blobCacheRef.current.clear();
    inflightRef.current.clear();
    isPlayingRef.current = false;
    setIsPlaying(false);
    setQueuedLines([]);
    setProcessedLines([]);
  }, [bookId]);

  const requestWakeLock = async () => {
    if ("wakeLock" in navigator && !wakeLockRef.current) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      } catch (e) {
        console.warn("Wake Lock request failed:", e);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  };

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const processedForPage = (pageIdx: number) => {
    const lines: number[] = [];
    for (const key of blobCacheRef.current.keys()) {
      const sep = key.indexOf(":");
      const p = Number(key.slice(0, sep));
      const l = Number(key.slice(sep + 1));
      if (p === pageIdx) lines.push(l);
    }
    lines.sort((a, b) => a - b);
    return lines;
  };

  const publishProcessed = (pageIdx: number) => {
    setProcessedLines(processedForPage(pageIdx));
  };

  const pruneCacheToPage = (pageIdx: number) => {
    for (const key of [...blobCacheRef.current.keys()]) {
      const p = Number(key.slice(0, key.indexOf(":")));
      if (p !== pageIdx) blobCacheRef.current.delete(key);
    }
    publishProcessed(pageIdx);
  };

  const goToPage = (pageIdx: number, lineIdx: number) => {
    currentPageRef.current = pageIdx;
    pruneCacheToPage(pageIdx);
    setCurrentPage(pageIdx);
    setCurrentLine(lineIdx);
  };

  const stopSession = () => {
    sessionRef.current += 1;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
    }
    revokeObjectUrl();
    setQueuedLines([]);
  };

  const synthesizeSerialized = (text: string) => {
    const run = synthChainRef.current.then(() => synthesize(text));
    synthChainRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const getBlob = (pos: LinePos, session: number): Promise<Blob | null> => {
    const key = posKey(pos.pageIdx, pos.lineIdx);
    const cached = blobCacheRef.current.get(key);
    if (cached) return Promise.resolve(cached);

    let pending = inflightRef.current.get(key);
    if (!pending) {
      pending = synthesizeSerialized(pos.text).then(
        (blob) => {
          inflightRef.current.delete(key);
          const keepPage = currentPageRef.current;
          if (pos.pageIdx === keepPage || pos.pageIdx === keepPage + 1) {
            blobCacheRef.current.set(key, blob);
            publishProcessed(keepPage);
          }
          return blob;
        },
        (err) => {
          inflightRef.current.delete(key);
          throw err;
        },
      );
      inflightRef.current.set(key, pending);
    }

    return pending.then((blob) => {
      if (session !== sessionRef.current) return null;
      return blobCacheRef.current.get(key) ?? blob;
    });
  };

  const updateQueuedUi = (upcoming: LinePos[], pageIdx: number) => {
    setQueuedLines(
      upcoming
        .filter((pos) => pos.pageIdx === pageIdx)
        .map((pos) => pos.lineIdx),
    );
  };

  const prefetchAhead = (pageIdx: number, lineIdx: number, session: number) => {
    const window = collectLines(
      pagesRef.current,
      pageIdx,
      lineIdx,
      PREFETCH_AHEAD + 1,
    );
    updateQueuedUi(window.slice(1), pageIdx);

    void (async () => {
      for (const pos of window) {
        if (session !== sessionRef.current) return;
        await getBlob(pos, session);
      }
    })();
  };

  const finishPlayback = async () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    setQueuedLines([]);
    await releaseWakeLock();
  };

  const playLineAt = async (pageIdx: number, lineIdx: number) => {
    const session = sessionRef.current;
    const bookPages = pagesRef.current;

    if (pageIdx >= bookPages.length) {
      await finishPlayback();
      return;
    }

    const pageLines = bookPages[pageIdx];
    if (lineIdx >= pageLines.length) {
      const nextPage = pageIdx + 1;
      if (nextPage < bookPages.length) {
        goToPage(nextPage, 0);
        const id = bookIdRef.current;
        if (id) updateBookProgress(id, nextPage, 0);
        await playLineAt(nextPage, 0);
      } else {
        await finishPlayback();
      }
      return;
    }

    try {
      prefetchAhead(pageIdx, lineIdx, session);

      const blob = await getBlob(
        { pageIdx, lineIdx, text: pageLines[lineIdx] },
        session,
      );

      if (!blob || session !== sessionRef.current || !isPlayingRef.current) {
        return;
      }

      const url = URL.createObjectURL(blob);
      revokeObjectUrl();
      objectUrlRef.current = url;

      if (!audioRef.current) return;

      audioRef.current.src = url;
      audioRef.current.playbackRate = speedRef.current;

      audioRef.current.onended = () => {
        if (session !== sessionRef.current || !isPlayingRef.current) return;
        revokeObjectUrl();
        const nextLine = lineIdx + 1;
        setCurrentLine(nextLine);
        const id = bookIdRef.current;
        if (id) updateBookProgress(id, pageIdx, nextLine);
        playLineAt(pageIdx, nextLine);
      };

      await audioRef.current.play();
    } catch (err) {
      if (session !== sessionRef.current) return;
      console.error("Audio playback error:", err);
      await finishPlayback();
    }
  };

  const togglePlay = async () => {
    if (isPlayingRef.current) {
      stopSession();
      isPlayingRef.current = false;
      setIsPlaying(false);
      await releaseWakeLock();
    } else {
      isPlayingRef.current = true;
      setIsPlaying(true);
      await requestWakeLock();
      playLineAt(currentPage, currentLine);
    }
  };

  const jumpTo = (pageIdx: number, lineIdx: number = 0) => {
    const wasPlaying = isPlayingRef.current;
    const pageChanged = pageIdx !== currentPageRef.current;
    stopSession();

    if (pageChanged) {
      goToPage(pageIdx, lineIdx);
    } else {
      setCurrentLine(lineIdx);
    }

    const id = bookIdRef.current;
    if (id) updateBookProgress(id, pageIdx, lineIdx);
    if (wasPlaying) {
      isPlayingRef.current = true;
      setIsPlaying(true);
      playLineAt(pageIdx, lineIdx);
    }
  };

  return {
    currentPage,
    currentLine,
    queuedLines,
    processedLines,
    isPlaying,
    speed,
    setSpeed,
    togglePlay,
    jumpTo,
  };
}
