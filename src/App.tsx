// src/App.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { extractPdfPages, mapDisplayToSentences } from "./utils/pdf";
import { isVoiceInstalled, downloadVoice, DEFAULT_PIPER_VOICE } from "./utils/tts";
import { saveBook, getAllBooks, type BookDoc, deleteBook } from "./utils/db";
import { useReader } from "./hooks/useReader";
import { BookShelf } from "./components/BookShelf";
import { AppearanceMenu } from "./components/AppearanceMenu";
import {
  getReaderFont,
  loadGoogleFont,
  loadReaderFontId,
  loadReaderTheme,
  saveReaderFontId,
  saveReaderTheme,
  type ReaderFontId,
  type ReaderTheme,
} from "./utils/readerAppearance";
import {
  ensureAudioUnlocked,
  requestScreenWakeLock,
  releaseScreenWakeLock,
} from "./utils/backgroundAudio";
import {
  setupMediaSession,
  updateMediaSessionState,
} from "./utils/mediaSession";
import { VoiceManagerModal } from "./components/VoiceManagerModal";
import { AVAILABLE_VOICES } from "./utils/voiceCatalog";
// import { subscribeTtsStatus, type TtsEngineStatus } from "./utils/tts";

const MemoizedReaderLine = React.memo(
  ({
    idx,
    lineText,
    lineState,
    onLineClick,
  }: {
    idx: number;
    lineText: string;
    lineState: string;
    onLineClick: (idx: number) => void;
  }) => {
    return (
      <div
        id={`reader-line-${idx}`}
        onClick={() => onLineClick(idx)}
        className={`reader-line px-1 sm:px-2 py-0.5 cursor-pointer ${lineState}`}
      >
        {lineText.length > 0 ? lineText : <span className="block h-[1em]">&nbsp;</span>}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.lineState === nextProps.lineState &&
      prevProps.lineText === nextProps.lineText
    );
  }
);
export default function App() {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [books, setBooks] = useState<BookDoc[]>([]);
  const [activeBook, setActiveBook] = useState<BookDoc | null>(null);
  const [voiceReady, setVoiceReady] = useState(false);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const [gotoInput, setGotoInput] = useState<string>("");
  const [fontSize, setFontSize] = useState(15);
  const [navbarHidden, setNavbarHidden] = useState(false);
  const [compactChrome, setCompactChrome] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ReaderTheme>(() => loadReaderTheme());
  const [fontId, setFontId] = useState<ReaderFontId>(() => loadReaderFontId());

  const MIN_FONT_SIZE = 12;
  const MAX_FONT_SIZE = 28;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // const activeLineRef = useRef<HTMLDivElement | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  // Installed models list
  const [installedVoiceIds, setInstalledVoiceIds] = useState<string[]>(() => {
    const saved = localStorage.getItem("echoread_installed_voices");
    return saved ? JSON.parse(saved) : ["en_US-hfc_male-medium"];
  });

  // Male & Female Voice Configurations
  const [maleVoiceId, setMaleVoiceId] = useState<string>(() => {
    return (
      localStorage.getItem("echoread_male_voice") || "en_US-hfc_male-medium"
    );
  });

  const [femaleVoiceId, setFemaleVoiceId] = useState<string | null>(() => {
    return (
      localStorage.getItem("echoread_female_voice") || "en_US-hfc_female-medium"
    );
  });

  

  // Active Gender Slot ('male' | 'female')
  const [activeGender, setActiveGender] = useState<"male" | "female">("male");

  // Verify availability in downloaded cache
  const isMaleReady = installedVoiceIds.includes(maleVoiceId);
  const isFemaleReady = Boolean(
    femaleVoiceId && installedVoiceIds.includes(femaleVoiceId),
  );
  const canToggleVoices = isMaleReady && isFemaleReady;

  // Active Voice ID calculation
  const currentActiveVoiceId =
    activeGender === "male" ? maleVoiceId : femaleVoiceId || maleVoiceId;

  const maleVoiceInfo = AVAILABLE_VOICES.find((v) => v.id === maleVoiceId);
  const femaleVoiceInfo = AVAILABLE_VOICES.find((v) => v.id === femaleVoiceId);
  const currentVoiceInfo = AVAILABLE_VOICES.find(
    (v) => v.id === currentActiveVoiceId,
  );

  const maleLabel = maleVoiceInfo
    ? `Male: ${maleVoiceInfo.name.split(" ")[0]}`
    : "Male";

  const femaleLabel = femaleVoiceInfo
    ? isFemaleReady
      ? `Female: ${femaleVoiceInfo.name.split(" ")[0]}`
      : `Download Female`
    : "+ Add Female";

  const handleSetMaleVoice = (id: string) => {
    setMaleVoiceId(id);
    localStorage.setItem("echoread_male_voice", id);
  };

  const handleSetFemaleVoice = (id: string) => {
    setFemaleVoiceId(id);
    localStorage.setItem("echoread_female_voice", id);
  };

  const handleToggleVoiceGender = () => {
    if (!canToggleVoices) return;
    setActiveGender((prev) => (prev === "male" ? "female" : "male"));
  };
  const handleDownloadVoiceId = async (id: string) => {
    setDownloadPct(0);
    await downloadVoice(id, (pct) => setDownloadPct(pct));
    setInstalledVoiceIds((prev) => {
      const updated = Array.from(new Set([...prev, id]));
      localStorage.setItem(
        "echoread_installed_voices",
        JSON.stringify(updated),
      );
      return updated;
    });
    setVoiceReady(true);
    setDownloadPct(null);
  };

  // const handleSetPrimary = (id: string) => {
  //   setPrimaryVoiceId(id);
  //   localStorage.setItem("echoread_primary_voice", id);
  // };

  // const handleSetSecondary = (id: string) => {
  //   setSecondaryVoiceId(id);
  //   localStorage.setItem("echoread_secondary_voice", id);
  // };

  const loadBooks = async () => {
    const list = await getAllBooks();
    setBooks(list.sort((a, b) => b.updatedAt - a.updatedAt));
  };



  useEffect(() => {
    const font = getReaderFont(fontId);
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty("--reader-font", font.cssFamily);
    saveReaderTheme(theme);
    saveReaderFontId(fontId);
    if (font.googleHref) loadGoogleFont(font.googleHref);
  }, [theme, fontId]);

  useEffect(() => {
    isVoiceInstalled().then(setVoiceReady);
    loadBooks();
  }, []);

  useEffect(() => {
    const updateChrome = () => {
      const mobile = window.matchMedia("(max-width: 1023px)").matches;
      const landscapeShort = window.matchMedia(
        "(orientation: landscape) and (max-height: 560px)",
      ).matches;
      const compact = mobile || landscapeShort;
      setCompactChrome(compact);
      if (!compact) setNavbarHidden(false);
    };

    updateChrome();
    window.addEventListener("resize", updateChrome);
    window.addEventListener("orientationchange", updateChrome);
    return () => {
      window.removeEventListener("resize", updateChrome);
      window.removeEventListener("orientationchange", updateChrome);
    };
  }, []);

  const handleDeleteBook = async (id: string) => {
    await deleteBook(id);
    if (activeBook?.id === id) {
      setActiveBook(null);
    }
    await loadBooks();
  };

  const handlePageJump = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeBook) return;

    const targetPage = parseInt(gotoInput, 10);
    if (
      !isNaN(targetPage) &&
      targetPage >= 1 &&
      targetPage <= activeBook.totalPages
    ) {
      jumpTo(targetPage - 1, 0);
    } else {
      setGotoInput(String(currentPage + 1));
    }
  };

  const handleInstallVoice = async () => {
    setDownloadPct(0);
    await downloadVoice(DEFAULT_PIPER_VOICE, (pct) => setDownloadPct(pct));
    setVoiceReady(true);
    setDownloadPct(null);
  };

  const ttsPages = useMemo(() => {
    if (!activeBook?.pages) return [];

    return activeBook.pages.map((page) =>
      page.filter((line) => line.trim().length > 0)
    );
  }, [activeBook?.pages]);
  const {
    currentPage,
    currentLine,
    isPlaying,
    speed,
    setSpeed,
    togglePlay,
    jumpTo,
  } = useReader(
    activeBook?.id || null,
    ttsPages || [],
    activeBook?.currentPage || 0,
    activeBook?.currentLine || 0,
    currentActiveVoiceId,
  );

  const handleTogglePlay = async () => {
    if (!activeBook || !voiceReady) return;

    if (!isPlaying) {
      await ensureAudioUnlocked();
      await requestScreenWakeLock();
    } else {
      releaseScreenWakeLock();
    }

    togglePlay();
  };

  // useEffect(() => {
  //   activeLineRef.current?.scrollIntoView({
  //     behavior: "smooth",
  //     block: "center",
  //   });
  // }, [currentLine, currentPage]);



  useEffect(() => {
    if (activeBook) {
      setGotoInput(String(currentPage + 1));
    }
  }, [currentPage, activeBook]);

  // const ttsLines = activeBook?.pages[currentPage] || [];
  // const displayedLines = activeBook?.displayPages?.[currentPage] || ttsLines;
  // const totalPageLines = ttsLines.length;
  // const processedCount = processedLines.length;
  // const generationPct = totalPageLines > 0 
  //   ? Math.min(100, Math.round((processedCount / totalPageLines) * 100)) 
  //   : 0;

  const ttsLines = ttsPages[currentPage] || [];

  const displayedLines =
    activeBook?.displayPages?.[currentPage] || [];


  const { displayToSentence,  } = useMemo(
    () => mapDisplayToSentences(displayedLines, ttsLines),
    [displayedLines, ttsLines],
  );

  const handleDisplayLineClick = async (displayIdx: number) => {
    const sentenceIndices = displayToSentence[displayIdx] || [];

    if (sentenceIndices.length === 0) return;

    await ensureAudioUnlocked();

    jumpTo(currentPage, sentenceIndices[0]);
  };
  // const { displayToSentence } = useMemo(
  //   () => mapDisplayToSentences(displayedLines, ttsLines),
  //   [displayedLines, ttsLines],
  // );
  // // const firstCurrentDisplayIdx = useMemo(
  // //   () =>
  // //     displayedLines.findIndex((_, i) =>
  // //       (displayToSentence[i] || []).includes(currentLine),
  // //     ),
  // //   [displayedLines, displayToSentence, currentLine],
  // // );

  // const handleDisplayLineClick = async (displayIdx: number) => {
  //   const hits = displayToSentence[displayIdx] || [];
  //   if (hits.length === 0) return;

  //   await ensureAudioUnlocked();

  //   const nextOnLine = hits.find((s) => s > currentLine);
  //   if (hits.includes(currentLine) && nextOnLine !== undefined) {
  //     jumpTo(currentPage, nextOnLine);
  //     return;
  //   }
  //   jumpTo(currentPage, hits[0]);
  // };

  const readerFont = getReaderFont(fontId);

  const handleAddOrUploadBook = async (file: File) => {
    const cleanTitle = file.name.replace(/\.pdf$/i, "");

    const existingBook = books.find(
      (b) => b.title.toLowerCase() === cleanTitle.toLowerCase(),
    );

    if (existingBook) {
      const shouldReplace = window.confirm(
        `"${cleanTitle}" already exists on your shelf.\n\nDo you want to replace it? (Progress will reset to Page 1)`,
      );

      if (!shouldReplace) return;

      const extracted = await extractPdfPages(file);
      const replacedBook: BookDoc = {
        ...existingBook,
        pages: extracted.pages,
        displayPages: extracted.displayPages,
        totalPages: extracted.pages.length,
        coverUrl: extracted.coverUrl,
        currentPage: 0,
        currentLine: 0,
        updatedAt: Date.now(),
      };

      await saveBook(replacedBook);
      await loadBooks();
      setActiveBook(replacedBook);
      return;
    }

    const extracted = await extractPdfPages(file);
    const newBook: BookDoc = {
      id: `${cleanTitle}_${Date.now()}`,
      title: cleanTitle,
      pages: extracted.pages,
      displayPages: extracted.displayPages,
      totalPages: extracted.pages.length,
      coverUrl: extracted.coverUrl,
      currentPage: 0,
      currentLine: 0,
      updatedAt: Date.now(),
    };

    await saveBook(newBook);
    await loadBooks();
    setActiveBook(newBook);
  };

  useEffect(() => {
    updateMediaSessionState(isPlaying);

    if (!isPlaying) {
      releaseScreenWakeLock();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!activeBook) return;

    setupMediaSession({
      title: activeBook.title,
      artist: `EchoRead (${currentVoiceInfo?.name || "Piper TTS"})`,
      album: `Page ${currentPage + 1} of ${activeBook.totalPages}`,
      onPlay: handleTogglePlay,
      onPause: handleTogglePlay,
      onNext: () => {
        if (currentPage < activeBook.totalPages - 1) {
          jumpTo(currentPage + 1, 0);
        }
      },
      onPrev: () => {
        if (currentPage > 0) {
          jumpTo(currentPage - 1, 0);
        }
      },
    });
  }, [activeBook, currentPage, currentActiveVoiceId]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const readerContainerRef = useRef<HTMLElement | null>(null);

  const toggleFullscreen = async () => {
    const next = !isFullscreen;
    setIsFullscreen(next);

    // Native Fullscreen API for PC / Mac / Android
    if (document.fullscreenEnabled) {
      try {
        if (next && !document.fullscreenElement) {
          await readerContainerRef.current?.requestFullscreen?.();
        } else if (!next && document.fullscreenElement) {
          await document.exitFullscreen?.();
        }
      } catch {
        // Graceful fallback to CSS fullscreen (e.g. iPad Safari)
      }
    }
  };
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  // Dedicated single-target scroll controller
  useEffect(() => {
    if (!isPlaying) return;

    // Find the first line index that corresponds to the active spoken sentence
    const activeDisplayIdx = displayedLines.findIndex((_, i) =>
      (displayToSentence[i] || []).includes(currentLine)
    );

    if (activeDisplayIdx === -1) return;

    const container = scrollContainerRef.current;
    const targetElement = document.getElementById(`reader-line-${activeDisplayIdx}`);

    if (container && targetElement) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();

      // Calculate relative position within the scroll container
      const targetTop = targetRect.top - containerRect.top + container.scrollTop;
      const centeredOffset = targetTop - container.clientHeight / 2 + targetRect.height / 2;

      container.scrollTo({
        top: Math.max(0, centeredOffset),
        behavior: "smooth",
      });
    }
  }, [currentLine, currentPage, isPlaying, displayedLines, displayToSentence]);
  return (
    <div
      className="app-shell min-h-screen flex flex-col font-sans"
      data-theme={theme}
    >
      {/* Top Navbar Section */}
      <header
        className={`app-header sticky top-0 z-30 px-3 sm:px-4 py-2.5 ${navbarHidden ? "hidden" : ""
          }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          {/* GROUP 1: Document File + Title */}
          <div className="app-control flex flex-wrap sm:flex-nowrap items-center gap-2 px-2.5 py-1.5 rounded-lg w-full sm:w-auto">
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAddOrUploadBook(file);
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="app-btn active:scale-95 text-xs font-semibold px-3 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>📁</span> Choose PDF
            </button>
            <span
              className="text-xs font-medium truncate block w-full sm:w-auto sm:max-w-[160px] md:max-w-xs select-none opacity-90"
              title={activeBook?.title || "No file selected"}
            >
              {activeBook?.title || "No file selected"}
            </span>
          </div>

          {/* GROUP 2: Page Navigation Controls */}
          {activeBook && (
            <form
              onSubmit={handlePageJump}
              className="app-control flex items-center justify-between gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg w-full sm:w-auto"
            >
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => jumpTo(Math.max(0, currentPage - 1), 0)}
                className="px-2 py-1 text-xs app-muted hover:opacity-80 disabled:opacity-20 cursor-pointer shrink-0 whitespace-nowrap flex items-center gap-1"
              >
                <span>◀</span>
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                <span className="app-muted text-xs select-none">Pg</span>
                <input
                  type="number"
                  min={1}
                  max={activeBook.totalPages}
                  value={gotoInput}
                  onChange={(e) => setGotoInput(e.target.value)}
                  onBlur={handlePageJump}
                  className="app-input w-11 rounded text-center text-xs font-bold py-0.5 px-0.5 font-mono"
                />
                <span className="text-xs app-muted font-normal select-none">
                  / {activeBook.totalPages}
                </span>
                <button
                  type="submit"
                  className="app-btn text-[11px] font-semibold px-2 py-0.5 rounded cursor-pointer ml-0.5 shrink-0"
                >
                  Go
                </button>
              </div>

              <button
                type="button"
                disabled={currentPage >= activeBook.totalPages - 1}
                onClick={() =>
                  jumpTo(
                    Math.min(activeBook.totalPages - 1, currentPage + 1),
                    0,
                  )
                }
                className="px-2 py-1 text-xs app-muted hover:opacity-80 disabled:opacity-20 cursor-pointer shrink-0 whitespace-nowrap flex items-center gap-1"
              >
                <span>Next</span>
                <span>▶</span>
              </button>
            </form>
          )}

          {/* GROUP 3: Voice Slots, Playback & Speed Controls */}
          {/* GROUP 3: Voice Selection, Playback & Speed Controls */}
          <div className="app-control flex flex-col md:flex-row md:items-center gap-2 px-2.5 py-2 rounded-lg w-full md:w-auto min-w-0 max-w-full">
            {!voiceReady ? (
              <button
                onClick={handleInstallVoice}
                disabled={downloadPct !== null}
                className="app-btn text-xs font-semibold px-3 py-2 rounded cursor-pointer w-full md:w-auto"
              >
                {downloadPct !== null
                  ? `Loading Voice (${downloadPct}%)`
                  : "Load Voice (63MB)"}
              </button>
            ) : (
              <>
                {/* Voice Selection & Settings */}
                <div className="flex items-center gap-1.5 w-full md:w-auto min-w-0">
                  {/* Segmented Switch: Male vs Female */}
                  <div className="flex items-center rounded-md border border-inherit bg-black/10 p-0.5 flex-1 md:flex-initial min-w-0">
                    {/* Male Voice Button */}
                    <button
                      type="button"
                      disabled={!isMaleReady}
                      onClick={() => setActiveGender("male")}
                      className={`flex-1 md:flex-initial min-w-0 text-[11px] font-semibold px-2.5 py-1 rounded transition cursor-pointer flex items-center justify-center gap-1.5 select-none disabled:opacity-40 ${activeGender === "male"
                        ? "bg-amber-400 text-black font-bold shadow-xs"
                        : "app-muted hover:opacity-100"
                        }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeGender === "male"
                          ? "bg-black animate-pulse"
                          : "bg-transparent"
                          }`}
                      />
                      <span className="truncate">{maleLabel}</span>
                    </button>

                    {/* Female Voice Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (!isFemaleReady) {
                          setIsVoiceModalOpen(true);
                        } else {
                          setActiveGender("female");
                        }
                      }}
                      className={`flex-1 md:flex-initial min-w-0 text-[11px] font-semibold px-2.5 py-1 rounded transition cursor-pointer flex items-center justify-center gap-1.5 select-none ${activeGender === "female"
                        ? "bg-amber-400 text-black font-bold shadow-xs"
                        : "app-muted hover:opacity-100"
                        }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${activeGender === "female"
                          ? "bg-black animate-pulse"
                          : "bg-transparent"
                          }`}
                      />
                      <span className="truncate">{femaleLabel}</span>
                    </button>
                  </div>

                  {/* Toggle Shortcut Button - Disabled if either voice isn't ready */}
                  <button
                    type="button"
                    disabled={!canToggleVoices}
                    onClick={handleToggleVoiceGender}
                    title={
                      canToggleVoices
                        ? "Switch Voice"
                        : "Download both male and female voices to toggle"
                    }
                    className="app-btn text-xs font-semibold px-2 py-1 rounded-md transition cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    ⇄
                  </button>

                  {/* Manage Voices Modal Trigger */}
                  <button
                    type="button"
                    onClick={() => setIsVoiceModalOpen(true)}
                    title="Open Voice Library"
                    className="app-btn text-xs font-semibold px-2 py-1 rounded-md transition cursor-pointer shrink-0 flex items-center"
                  >
                    <span>⚙️</span>
                  </button>
                </div>

                {/* Play/Pause & Speed Controls - Visible only when an active book is loaded */}
                {activeBook && (
                  <>
                    <div className="hidden md:block h-5 w-px bg-inherit/40 mx-0.5 shrink-0" />
                    <div className="md:hidden w-full h-px bg-inherit/25" />

                    <div className="flex items-center gap-2.5 w-full md:w-auto min-w-0">
                      <button
                        onClick={handleTogglePlay}
                        disabled={!voiceReady}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shrink-0 ${isPlaying ? "app-pause" : "app-play"
                          } disabled:opacity-25`}
                      >
                        {isPlaying ? "⏸ Pause" : "▶ Play"}
                      </button>

                      <div className="flex items-center gap-2 flex-1 md:flex-initial min-w-0">
                        <span className="text-[11px] app-muted select-none shrink-0">
                          Speed
                        </span>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={speed}
                          onChange={(e) => setSpeed(parseFloat(e.target.value))}
                          className="w-full min-w-0 md:w-20 accent-current cursor-pointer h-1 rounded"
                        />
                        <span className="text-xs app-accent font-mono font-bold w-7 text-right tabular-nums select-none shrink-0">
                          {speed.toFixed(1)}×
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* GROUP 4: Chrome & Appearance Menu */}
          <div className="flex items-center justify-end gap-2 w-full sm:w-auto shrink-0">
            {compactChrome && (
              <button
                type="button"
                onClick={() => setNavbarHidden(true)}
                className="app-btn text-[11px] font-semibold px-2.5 py-1.5 cursor-pointer shrink-0"
              >
                Hide nav
              </button>
            )}
            <AppearanceMenu
              open={menuOpen}
              onOpenChange={setMenuOpen}
              theme={theme}
              fontId={fontId}
              onThemeChange={setTheme}
              onFontChange={setFontId}
            />
          </div>
        </div>
        {/* Dynamic TTS Status Bar */}
      </header>

      {navbarHidden && compactChrome && (
        <div className="fixed top-2 right-2 z-40 flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={!activeBook || !voiceReady}
            className={`px-3 py-1.5 rounded-md text-[11px] font-bold shadow-lg cursor-pointer ${isPlaying ? "app-pause" : "app-play"
              } disabled:opacity-25`}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            onClick={() => setNavbarHidden(false)}
            className="app-btn text-[11px] font-semibold px-2.5 py-1.5 shadow-lg cursor-pointer"
          >
            Show nav
          </button>
        </div>
      )}

      {/* Two-Column App Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PDF Reading Area */}
        <main
          ref={readerContainerRef}
          className={`app-panel flex flex-col shadow-xl overflow-hidden transition-all duration-150 ${isFullscreen
            ? "fixed inset-0 z-50 w-screen h-[100dvh] rounded-none border-none"
            : "lg:col-span-8 rounded-lg"
            }`}
        >
          <div className="app-panel-header px-4 sm:px-5 py-2.5 sm:py-3 flex items-center justify-between text-xs shrink-0">
            <span className="font-semibold">
              {activeBook
                ? `Page ${currentPage + 1} of ${activeBook.totalPages}`
                : "Document View"}
            </span>

            <div className="flex items-center gap-2">
              {/* Font Size Controls */}
              <div className="app-control flex items-center gap-1 px-1.5 py-0.5 rounded-md">
                <button
                  type="button"
                  aria-label="Decrease font size"
                  disabled={fontSize <= MIN_FONT_SIZE}
                  onClick={() =>
                    setFontSize((size) => Math.max(MIN_FONT_SIZE, size - 1))
                  }
                  className="min-w-7 h-6 px-1 flex items-center justify-center text-[11px] font-semibold rounded disabled:opacity-25 cursor-pointer"
                >
                  A−
                </button>
                <span className="app-accent font-mono font-bold w-8 text-center tabular-nums select-none">
                  {fontSize}
                </span>
                <button
                  type="button"
                  aria-label="Increase font size"
                  disabled={fontSize >= MAX_FONT_SIZE}
                  onClick={() =>
                    setFontSize((size) => Math.min(MAX_FONT_SIZE, size + 1))
                  }
                  className="min-w-7 h-6 px-1 flex items-center justify-center text-[11px] font-semibold rounded disabled:opacity-25 cursor-pointer"
                >
                  A+
                </button>
              </div>

              <span className="hidden sm:inline app-muted">
                {displayedLines.length} lines
              </span>
           
              {/* Fullscreen Toggle Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                title={
                  isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen"
                }
                className={`text-xs px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${isFullscreen
                  ? "bg-amber-400 text-black font-bold shadow-xs"
                  : "app-btn border border-inherit"
                  }`}
              >
                <span>{isFullscreen ? "🗗" : "⛶"}</span>
                <span className="hidden sm:inline text-[11px]">
                  {isFullscreen ? "Exit" : "Full"}
                </span>
              </button>
            </div>
          </div>

          {/* Reading text body */}
          <div
            className={`px-3 py-4 sm:px-6 md:p-10 flex-1 overflow-y-auto ${isFullscreen ? "h-full max-h-none" : "max-h-[75vh]"
              }`}
          >
            {activeBook ? (
              <div
                className="text-left max-w-3xl mx-auto space-y-2"
                style={{
                  fontFamily: readerFont.cssFamily,
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.7,
                }}
              >
              {/* {displayedLines.map((line, idx) => {
                  const sentenceIndices = displayToSentence[idx] || [];

                  const isCurrent = sentenceIndices.includes(currentLine);

                  // Only check if the line is processed, completely skipping the queued state
                  const isProcessed =
                    !isCurrent &&
                    sentenceIndices.length > 0 &&
                    sentenceIndices.every((sentenceIdx) =>
                      processedLines.includes(sentenceIdx)
                    );

                  // Assign state based only on current or processed status
                  const lineState = isCurrent
                    ? "is-current"
                    : isProcessed
                      ? "is-processed"
                      : "is-pending";

                  return (
                    <MemoizedReaderLine
                      key={idx}
                      idx={idx}
                      lineText={line}
                      lineState={lineState}
                      isFirstCurrent={isCurrent}
                      onLineClick={handleDisplayLineClick}
                    />
                  );
                })} */}
                
                {/* Find the exact first line of the currently spoken sentence */}
                {displayedLines.map((line, idx) => {
                  const sentenceIndices = displayToSentence[idx] || [];
                  const isCurrent = sentenceIndices.includes(currentLine);
                  const lineState = isCurrent ? "is-current" : "is-pending";

                  return (
                    <MemoizedReaderLine
                      key={idx}
                      idx={idx}
                      lineText={line}
                      lineState={lineState}
                      onLineClick={handleDisplayLineClick}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center app-muted text-sm space-y-2">
                <span className="text-2xl">📄</span>
                <p>No active document. Choose a PDF or select a saved book.</p>
              </div>
            )}
          </div>
        </main>

        <aside className="lg:col-span-4 flex flex-col">
          <BookShelf
            books={books}
            activeBookId={activeBook?.id || null}
            currentPage={currentPage}
            onSelectBook={(book) => {
              setActiveBook(book);
              loadBooks();
            }}
            onDeleteBook={handleDeleteBook}
            onAddBook={handleAddOrUploadBook}
            pageSize={5}
            theme={theme}
          />
        </aside>
      </div>

      <VoiceManagerModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        theme={theme}
        installedVoiceIds={installedVoiceIds}
        maleVoiceId={maleVoiceId}
        femaleVoiceId={femaleVoiceId}
        onDownloadVoice={handleDownloadVoiceId}
        onSetMaleVoice={handleSetMaleVoice}
        onSetFemaleVoice={handleSetFemaleVoice}
      />
    </div>
  );
}
