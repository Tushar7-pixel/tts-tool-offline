// src/hooks/useReader.ts

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";

import {
  synthesize,
  cancelPendingSynthesis,
  clearTTSQueue,
} from "../utils/tts";

import { updateBookProgress } from "../utils/db";

type LinePos = {
  pageIdx: number;
  lineIdx: number;
  text: string;
};

type CacheKeyData = {
  voiceId: string;
  pageIdx: number;
  lineIdx: number;
};

/**
 * Keep prefetch intentionally small.
 *
 * Piper inference is expensive, especially on mobile.
 *
 * We always synthesize the current line first.
 * Then we prepare only one additional line.
 */
const PREFETCH_LINES = 2;

function posKey(
  pageIdx: number,
  lineIdx: number,
  voiceId?: string
) {
  return JSON.stringify([
    voiceId || "default",
    pageIdx,
    lineIdx,
  ]);
}

function parseCacheKey(
  key: string
): CacheKeyData | null {
  try {
    const [
      voiceId,
      pageIdx,
      lineIdx,
    ] = JSON.parse(key);

    return {
      voiceId,
      pageIdx,
      lineIdx,
    };
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
  const [
    currentPage,
    setCurrentPage,
  ] = useState(initialPage);

  const [
    currentLine,
    setCurrentLine,
  ] = useState(initialLine);

  const [
    isPlaying,
    setIsPlaying,
  ] = useState(false);

  const [
    speed,
    setSpeed,
  ] = useState<number>(1.0);

  /**
   * One Audio element is reused for the whole reader.
   */
  const audioRef =
    useRef<HTMLAudioElement | null>(
      new Audio()
    );

  const speedRef =
    useRef<number>(1.0);

  const wakeLockRef =
    useRef<WakeLockSentinel | null>(
      null
    );

  /**
   * Session invalidates old async operations.
   *
   * Any synthesis/playback belonging to an older session
   * must not update the current reader.
   */
  const sessionRef =
    useRef(0);

  const pagesRef =
    useRef(pages);

  const bookIdRef =
    useRef(bookId);

  const currentPageRef =
    useRef(initialPage);

  const currentLineRef =
    useRef(initialLine);

  const voiceIdRef =
    useRef(voiceId);

  const isPlayingRef =
    useRef(false);

  /**
   * Synthesized audio cache.
   */
  const blobCacheRef =
    useRef<Map<string, Blob>>(
      new Map()
    );

  /**
   * Prevent duplicate synthesis of the same sentence.
   */
  const inflightRef =
    useRef<
      Map<
        string,
        Promise<Blob | null>
      >
    >(new Map());

  /**
   * Current object URL used by HTMLAudioElement.
   */
  const objectUrlRef =
    useRef<string | null>(
      null
    );

  /**
   * Prevent duplicate prefetch sessions.
   */
  const prefetchSessionRef =
    useRef<{
      session: number;
      page: number;
      startLine: number;
    } | null>(null);

  pagesRef.current = pages;
  bookIdRef.current = bookId;

  /**
   * ---------------------------------------------------------
   * SPEED
   * ---------------------------------------------------------
   */

  useEffect(() => {
    speedRef.current = speed;

    if (audioRef.current) {
      audioRef.current.playbackRate =
        speed;
    }
  }, [speed]);

  /**
   * ---------------------------------------------------------
   * INITIAL BOOK POSITION
   * ---------------------------------------------------------
   */

  useEffect(() => {
    setCurrentPage(
      initialPage
    );

    setCurrentLine(
      initialLine
    );

    currentPageRef.current =
      initialPage;

    currentLineRef.current =
      initialLine;
  }, [
    bookId,
    initialPage,
    initialLine,
  ]);

  /**
   * ---------------------------------------------------------
   * OBJECT URL
   * ---------------------------------------------------------
   */

  const revokeObjectUrl =
    useCallback(() => {
      if (
        objectUrlRef.current
      ) {
        URL.revokeObjectURL(
          objectUrlRef.current
        );

        objectUrlRef.current =
          null;
      }
    }, []);

  /**
   * ---------------------------------------------------------
   * CACHE
   * ---------------------------------------------------------
   */

  const pruneCacheToPage =
    useCallback(
      (pageIdx: number) => {
        for (
          const key of [
            ...blobCacheRef.current.keys(),
          ]
        ) {
          const parsed =
            parseCacheKey(key);

          if (!parsed) {
            blobCacheRef.current.delete(
              key
            );

            continue;
          }

          /**
           * Only keep the current page.
           *
           * This prevents memory from continuously growing.
           */
          if (
            parsed.pageIdx !==
            pageIdx
          ) {
            blobCacheRef.current.delete(
              key
            );
          }
        }
      },
      []
    );

  /**
   * ---------------------------------------------------------
   * PAGE NAVIGATION
   * ---------------------------------------------------------
   */

  const goToPage =
    useCallback(
      (
        pageIdx: number,
        lineIdx: number
      ) => {
        currentPageRef.current =
          pageIdx;

        currentLineRef.current =
          lineIdx;

        pruneCacheToPage(
          pageIdx
        );

        setCurrentPage(
          pageIdx
        );

        setCurrentLine(
          lineIdx
        );
      },
      [pruneCacheToPage]
    );

  /**
   * ---------------------------------------------------------
   * STOP CURRENT SESSION
   * ---------------------------------------------------------
   */

  const stopSession =
    useCallback(() => {
      /**
       * Invalidate all old async work.
       */
      sessionRef.current += 1;

      prefetchSessionRef.current =
        null;

      if (audioRef.current) {
        audioRef.current.onended =
          null;

        audioRef.current.pause();
      }

      revokeObjectUrl();

      /**
       * Remove queued synthesis requests.
       *
       * Active worker inference is handled by
       * cancelPendingSynthesis() when necessary.
       */
      clearTTSQueue();
    }, [
      revokeObjectUrl,
    ]);

  /**
   * ---------------------------------------------------------
   * WAKE LOCK
   * ---------------------------------------------------------
   */

  const requestWakeLock =
    useCallback(async () => {
      if (
        "wakeLock" in navigator &&
        !wakeLockRef.current
      ) {
        try {
          wakeLockRef.current =
            await navigator.wakeLock.request(
              "screen"
            );
        } catch (error) {
          console.warn(
            "Wake Lock request failed:",
            error
          );
        }
      }
    }, []);

  const releaseWakeLock =
    useCallback(async () => {
      if (
        wakeLockRef.current
      ) {
        try {
          await wakeLockRef.current.release();
        } catch {
          // Ignore release errors.
        }

        wakeLockRef.current =
          null;
      }
    }, []);

  /**
   * ---------------------------------------------------------
   * SYNTHESIS
   * ---------------------------------------------------------
   */

  const getBlob =
    useCallback(
      (
        pos: LinePos,
        session: number
      ): Promise<Blob | null> => {
        const key =
          posKey(
            pos.pageIdx,
            pos.lineIdx,
            voiceIdRef.current
          );

        /**
         * Already synthesized.
         */
        const cached =
          blobCacheRef.current.get(
            key
          );

        if (cached) {
          return Promise.resolve(
            cached
          );
        }

        /**
         * Already being synthesized.
         */
        const existing =
          inflightRef.current.get(
            key
          );

        if (existing) {
          return existing;
        }

        /**
         * Start synthesis.
         */
        const request =
          synthesize(
            pos.text,
            voiceIdRef.current
          )
            .then((blob) => {
              /**
               * Ignore stale synthesis results.
               */
              if (
                session !==
                sessionRef.current
              ) {
                return null;
              }

              if (!blob) {
                return null;
              }

              const keepPage =
                currentPageRef.current;

              /**
               * Keep current page and next page
               * eligible for cache.
               */
              if (
                pos.pageIdx ===
                keepPage ||
                pos.pageIdx ===
                keepPage + 1
              ) {
                blobCacheRef.current.set(
                  key,
                  blob
                );
              }

              return blob;
            })
            .catch((error) => {
              if (
                session ===
                sessionRef.current
              ) {
                console.error(
                  "[Reader] TTS synthesis failed:",
                  error
                );
              }

              return null;
            })
            .finally(() => {
              const current =
                inflightRef.current.get(
                  key
                );

              if (
                current ===
                request
              ) {
                inflightRef.current.delete(
                  key
                );
              }
            });

        inflightRef.current.set(
          key,
          request
        );

        return request;
      },
      []
    );

  /**
   * ---------------------------------------------------------
   * BACKGROUND PREFETCH
   * ---------------------------------------------------------
   *
   * IMPORTANT:
   *
   * The previous implementation created `positions` but
   * never called getBlob().
   *
   * This version actually prefetches.
   *
   * Current line:
   *   synthesized immediately by playLineAt()
   *
   * Next line:
   *   synthesized here in background
   *
   * This should make line transitions much faster without
   * flooding the phone with Piper inference jobs.
   */

  const startBackgroundProcessing =
    useCallback(
      (
        pageIdx: number,
        startLineIdx: number,
        session: number
      ) => {
        const previous =
          prefetchSessionRef.current;

        if (
          previous?.session ===
          session &&
          previous.page ===
          pageIdx &&
          previous.startLine ===
          startLineIdx
        ) {
          return;
        }

        prefetchSessionRef.current =
        {
          session,
          page: pageIdx,
          startLine:
            startLineIdx,
        };

        const pageLines =
          pagesRef.current[
          pageIdx
          ];

        if (!pageLines) {
          return;
        }

        const endLine =
          Math.min(
            pageLines.length,
            startLineIdx +
            PREFETCH_LINES
          );

        /**
         * Don't generate everything simultaneously.
         *
         * We deliberately chain the requests.
         *
         * This is important for mobile.
         */
        let chain =
          Promise.resolve();

        for (
          let lineIdx =
            startLineIdx;
          lineIdx < endLine;
          lineIdx++
        ) {
          const text =
            pageLines[lineIdx];

          const key =
            posKey(
              pageIdx,
              lineIdx,
              voiceIdRef.current
            );

          /**
           * Already cached.
           */
          if (
            blobCacheRef.current.has(
              key
            )
          ) {
            continue;
          }

          /**
           * Already running.
           */
          if (
            inflightRef.current.has(
              key
            )
          ) {
            continue;
          }

          const pos: LinePos = {
            pageIdx,
            lineIdx,
            text,
          };

          chain =
            chain.then(
              async () => {
                /**
                 * Stop immediately if this prefetch session
                 * has become stale.
                 */
                if (
                  session !==
                  sessionRef.current
                ) {
                  return;
                }

                /**
                 * Do not prefetch if playback was stopped
                 * and this isn't the current required line.
                 *
                 * We still allow the first request because
                 * it may be the line currently being played.
                 */
                await getBlob(
                  pos,
                  session
                );
              }
            );
        }
      },
      [getBlob]
    );

  /**
   * ---------------------------------------------------------
   * FINISH PLAYBACK
   * ---------------------------------------------------------
   */

  const finishPlayback =
    useCallback(async () => {
      isPlayingRef.current =
        false;

      setIsPlaying(
        false
      );

      prefetchSessionRef.current =
        null;

      await releaseWakeLock();
    }, [
      releaseWakeLock,
    ]);

  /**
   * ---------------------------------------------------------
   * PLAY LINE
   * ---------------------------------------------------------
   */

  const playLineAt =
    useCallback(
      async (
        pageIdx: number,
        lineIdx: number
      ) => {
        const session =
          sessionRef.current;

        const bookPages =
          pagesRef.current;

        /**
         * End of entire book.
         */
        if (
          pageIdx >=
          bookPages.length
        ) {
          await finishPlayback();

          return;
        }

        const pageLines =
          bookPages[pageIdx];

        /**
         * End of current page.
         */
        if (
          !pageLines ||
          lineIdx >=
          pageLines.length
        ) {
          const nextPage =
            pageIdx + 1;

          if (
            nextPage <
            bookPages.length
          ) {
            goToPage(
              nextPage,
              0
            );

            const id =
              bookIdRef.current;

            if (id) {
              updateBookProgress(
                id,
                nextPage,
                0
              );
            }

            /**
             * Start preparing the first lines of the
             * new page.
             */
            startBackgroundProcessing(
              nextPage,
              0,
              session
            );

            await playLineAt(
              nextPage,
              0
            );
          } else {
            await finishPlayback();
          }

          return;
        }

        try {
          /**
           * Start current-line + next-line preparation.
           */
          startBackgroundProcessing(
            pageIdx,
            lineIdx,
            session
          );

          /**
           * CRITICAL:
           *
           * getBlob() for the current line is awaited.
           *
           * We never skip a line just because synthesis
           * temporarily failed.
           */
          const blob =
            await getBlob(
              {
                pageIdx,
                lineIdx,
                text:
                  pageLines[
                  lineIdx
                  ],
              },
              session
            );

          /**
           * Session became stale.
           */
          if (
            session !==
            sessionRef.current ||
            !isPlayingRef.current
          ) {
            return;
          }

          /**
           * If synthesis genuinely failed, STOP.
           *
           * We don't silently skip text.
           */
          if (!blob) {
            console.error(
              `[Reader] TTS returned no audio for page ${pageIdx}, line ${lineIdx}.`
            );

            await finishPlayback();

            return;
          }

          /**
           * Create a new object URL.
           */
          const url =
            URL.createObjectURL(
              blob
            );

          revokeObjectUrl();

          objectUrlRef.current =
            url;

          const audio =
            audioRef.current;

          if (!audio) {
            return;
          }

          audio.src = url;

          audio.playbackRate =
            speedRef.current;

          /**
           * The only place where we advance the reading line
           * during normal playback.
           */
          audio.onended = () => {
            if (
              session !==
              sessionRef.current ||
              !isPlayingRef.current
            ) {
              return;
            }

            revokeObjectUrl();

            const nextLine =
              lineIdx + 1;

            currentLineRef.current =
              nextLine;

            setCurrentLine(
              nextLine
            );

            const id =
              bookIdRef.current;

            if (id) {
              updateBookProgress(
                id,
                pageIdx,
                nextLine
              );
            }

            /**
             * Continue asynchronously.
             */
            void playLineAt(
              pageIdx,
              nextLine
            );
          };

          await audio.play();
        } catch (error) {
          if (
            session !==
            sessionRef.current
          ) {
            return;
          }

          console.error(
            "[Reader] Audio playback error:",
            error
          );

          await finishPlayback();
        }
      },
      [
        finishPlayback,
        getBlob,
        goToPage,
        revokeObjectUrl,
        startBackgroundProcessing,
      ]
    );

  /**
   * ---------------------------------------------------------
   * VOICE CHANGE
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (
      voiceIdRef.current ===
      voiceId
    ) {
      return;
    }

    const wasPlaying =
      isPlayingRef.current;

    /**
     * Update active voice.
     */
    voiceIdRef.current =
      voiceId;

    /**
     * Invalidate old synthesis.
     */
    sessionRef.current += 1;

    const newSession =
      sessionRef.current;

    prefetchSessionRef.current =
      null;

    /**
     * Stop current audio.
     */
    if (audioRef.current) {
      audioRef.current.onended =
        null;

      audioRef.current.pause();
    }

    revokeObjectUrl();

    /**
     * Old voice audio must never be reused.
     */
    blobCacheRef.current.clear();

    inflightRef.current.clear();

    /**
     * Cancel old Piper/worker requests.
     */
    cancelPendingSynthesis();

    /**
     * Prepare the new voice.
     */
    startBackgroundProcessing(
      currentPageRef.current,
      currentLineRef.current,
      newSession
    );

    /**
     * Resume from the same sentence if we were playing.
     */
    if (wasPlaying) {
      isPlayingRef.current =
        true;

      setIsPlaying(
        true
      );

      void playLineAt(
        currentPageRef.current,
        currentLineRef.current
      );
    }

    // voiceId is intentionally the only dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceId]);

  /**
   * ---------------------------------------------------------
   * BOOK CHANGE
   * ---------------------------------------------------------
   */

  useEffect(() => {
    sessionRef.current += 1;

    prefetchSessionRef.current =
      null;

    if (audioRef.current) {
      audioRef.current.onended =
        null;

      audioRef.current.pause();
    }

    revokeObjectUrl();

    blobCacheRef.current.clear();

    inflightRef.current.clear();

    isPlayingRef.current =
      false;

    setIsPlaying(
      false
    );

    /**
     * Don't leave old Piper jobs running when changing books.
     */
    cancelPendingSynthesis();
  }, [
    bookId,
    revokeObjectUrl,
  ]);

  /**
   * ---------------------------------------------------------
   * PLAY / PAUSE
   * ---------------------------------------------------------
   */

  const togglePlay =
    useCallback(async () => {
      /**
       * PAUSE
       */
      if (
        isPlayingRef.current
      ) {
        stopSession();

        isPlayingRef.current =
          false;

        setIsPlaying(
          false
        );

        await releaseWakeLock();

        return;
      }

      /**
       * PLAY
       */
      isPlayingRef.current =
        true;

      setIsPlaying(
        true
      );

      await requestWakeLock();

      void playLineAt(
        currentPageRef.current,
        currentLineRef.current
      );
    }, [
      playLineAt,
      releaseWakeLock,
      requestWakeLock,
      stopSession,
    ]);

  /**
   * ---------------------------------------------------------
   * JUMP TO SENTENCE
   * ---------------------------------------------------------
   */

  const jumpTo =
    useCallback(
      (
        pageIdx: number,
        lineIdx: number = 0
      ) => {
        const wasPlaying =
          isPlayingRef.current;

        /**
         * Determine this before changing refs.
         */
        const pageChanged =
          pageIdx !==
          currentPageRef.current;

        /**
         * Kill old playback/session.
         */
        stopSession();

        /**
         * Update refs immediately.
         */
        currentPageRef.current =
          pageIdx;

        currentLineRef.current =
          lineIdx;

        /**
         * Update React state.
         */
        if (pageChanged) {
          goToPage(
            pageIdx,
            lineIdx
          );
        } else {
          setCurrentLine(
            lineIdx
          );
        }

        /**
         * Persist reading progress.
         */
        const id =
          bookIdRef.current;

        if (id) {
          updateBookProgress(
            id,
            pageIdx,
            lineIdx
          );
        }

        /**
         * New session.
         */
        sessionRef.current += 1;

        const session =
          sessionRef.current;

        /**
         * Prepare current + next sentence.
         */
        startBackgroundProcessing(
          pageIdx,
          lineIdx,
          session
        );

        /**
         * Resume if playback was active.
         */
        if (wasPlaying) {
          isPlayingRef.current =
            true;

          setIsPlaying(
            true
          );

          void playLineAt(
            pageIdx,
            lineIdx
          );
        }
      },
      [
        goToPage,
        playLineAt,
        startBackgroundProcessing,
        stopSession,
      ]
    );

  /**
   * ---------------------------------------------------------
   * CLEANUP
   * ---------------------------------------------------------
   */

  useEffect(() => {
    return () => {
      sessionRef.current += 1;

      if (audioRef.current) {
        audioRef.current.onended =
          null;

        audioRef.current.pause();
      }

      revokeObjectUrl();

      cancelPendingSynthesis();

      blobCacheRef.current.clear();

      inflightRef.current.clear();

      void releaseWakeLock();
    };
  }, [
    releaseWakeLock,
    revokeObjectUrl,
  ]);

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