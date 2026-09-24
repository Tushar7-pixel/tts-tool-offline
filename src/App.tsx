// src/App.tsx
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  extractPdfPages,
  mapDisplayToSentences,
  parseChaptersFromDisplayPages,
  type ChapterItem,
} from "./utils/pdf";
import {
  isVoiceInstalled,
  downloadVoice,
  subscribeTtsStatus,
  type TtsEngineStatus,
} from "./utils/tts";
import {
  saveBook,
  getAllBooks,
  type BookDoc,
  deleteBook,
  applyMultiLineHighlight,
  deleteHighlightById,
  updateHighlightNote,
  getReadingStats,
  type HighlightItem,
} from "./utils/db";
import { useReader } from "./hooks/useReader";
import { useTextSelection } from "./hooks/useTextSelection";
import { BookShelf, cleanBookTitle } from "./components/BookShelf";
import { AppearanceMenu } from "./components/AppearanceMenu";
import { VoiceManagerModal } from "./components/VoiceManagerModal";
import { ChapterDrawer } from "./components/ChapterDrawer";
import { AnnotationsDrawer } from "./components/reader/AnnotationsDrawer";
import { ReadingStatsModal } from "./components/ReadingStatsModal";
import { ReaderTextBody } from "./components/reader/ReaderTextBody";
import { HighlightToolbar } from "./components/reader/HighlightToolbar";
import { DesktopPlaybackDock } from "./components/player/DesktopPlaybackDock";
import { MobileFloatingPlayer } from "./components/player/MobileFloatingPlayer";
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
import { updateMediaSessionState } from "./utils/mediaSession";

function DictionaryModal({
  word,
  data,
  loading,
  onClose,
}: {
  word: string | null;
  data: any;
  loading: boolean;
  onClose: () => void;
}) {
  if (!word) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="app-panel w-full max-w-sm rounded-2xl p-5 shadow-2xl relative animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-lg opacity-50 hover:opacity-100 cursor-pointer w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        >
          ✕
        </button>
        <h3 className="text-xl font-bold mb-2 capitalize pr-6">{word}</h3>
        {loading && (
          <div className="py-6 flex justify-center">
            <span className="inline-block w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></span>
          </div>
        )}
        {!loading && !data && (
          <p className="text-sm app-muted py-4">No definition found.</p>
        )}
        {!loading && data && (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            {data.meanings.map((m: any, i: number) => (
              <div key={i} className="space-y-1.5">
                <p className="text-[11px] font-bold text-[var(--accent)] uppercase tracking-wider bg-[var(--accent)]/10 inline-block px-2 py-0.5 rounded">
                  {m.partOfSpeech}
                </p>
                <ul className="list-disc pl-5 text-sm space-y-2 opacity-90">
                  {m.definitions.slice(0, 3).map((d: any, j: number) => (
                    <li key={j}>{d.definition}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const readerContainerRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [books, setBooks] = useState<BookDoc[]>([]);
  const [activeBook, setActiveBook] = useState<BookDoc | null>(null);
  const [voiceReady, setVoiceReady] = useState(false);
  const [gotoInput, setGotoInput] = useState<string>("");
  const [fontSize, setFontSize] = useState(15);
  const [navbarHidden, setNavbarHidden] = useState(false);
  const [compactChrome, setCompactChrome] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ReaderTheme>(() => loadReaderTheme());
  const [fontId, setFontId] = useState<ReaderFontId>(() => loadReaderFontId());
  const [engineStatus, setEngineStatus] = useState<TtsEngineStatus>("idle");
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isChapterDrawerOpen, setIsChapterDrawerOpen] = useState(false);
  const [isAnnotationsOpen, setIsAnnotationsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const [activeChapters, setActiveChapters] = useState<ChapterItem[]>([]);

  // Selected existing highlight popup state (for tap-to-delete/note)
  const [activeHighlightPopover, setActiveHighlightPopover] = useState<{
    item: HighlightItem;
    lineIdx: number;
    rect: DOMRect;
  } | null>(null);
  const [editingPopoverNote, setEditingPopoverNote] = useState(false);
  const [popoverNoteInput, setPopoverNoteInput] = useState("");

  // Sleep Timer States
  const [sleepMode, setSleepMode] = useState<number | "chapter" | null>(null);
  const [sleepMins, setSleepMins] = useState<number | null>(null);
  const targetChapterPage = useRef<number | null>(null);

  // Dictionary States
  const [dictWord, setDictWord] = useState<string | null>(null);
  const [dictData, setDictData] = useState<any>(null);
  const [dictLoading, setDictLoading] = useState(false);

  // Custom Text Selection Hook
  const {
    selectionParams,
    showColorPicker,
    setShowColorPicker,
    clearSelection,
    toolbarRef,
  } = useTextSelection();

  // Voice Management States
  const [installedVoiceIds, setInstalledVoiceIds] = useState<string[]>(() => {
    const saved = localStorage.getItem("echoread_installed_voices");
    return saved ? JSON.parse(saved) : ["en_US-hfc_male-medium"];
  });
  const [maleVoiceId, setMaleVoiceId] = useState<string>(
    () =>
      localStorage.getItem("echoread_male_voice") || "en_US-hfc_male-medium",
  );
  const [femaleVoiceId, setFemaleVoiceId] = useState<string | null>(
    () =>
      localStorage.getItem("echoread_female_voice") ||
      "en_US-hfc_female-medium",
  );
  const [activeGender] = useState<"male" | "female">("male");

  const currentActiveVoiceId =
    activeGender === "male" ? maleVoiceId : femaleVoiceId || maleVoiceId;

  const ttsPages = useMemo(() => {
    if (!activeBook?.pages) return [];
    return activeBook.pages.map((page) =>
      page.filter((line) => line.trim().length > 0),
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

  const loadBooks = async () => {
    const list = await getAllBooks();
    setBooks(list.sort((a, b) => b.updatedAt - a.updatedAt));
    const stats = await getReadingStats();
    setStreakDays(stats.currentStreak || 0);
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
      setCompactChrome(mobile || landscapeShort);
      if (!mobile && !landscapeShort) setNavbarHidden(false);
    };
    updateChrome();
    window.addEventListener("resize", updateChrome);
    return () => window.removeEventListener("resize", updateChrome);
  }, []);

  useEffect(() => {
    return subscribeTtsStatus(setEngineStatus);
  }, []);

  useEffect(() => {
    updateMediaSessionState(isPlaying);
    if (!isPlaying) releaseScreenWakeLock();
  }, [isPlaying]);

  const handleTogglePlay = useCallback(async () => {
    if (!activeBook || !voiceReady) return;
    if (!isPlaying) {
      await ensureAudioUnlocked();
      await requestScreenWakeLock();
    } else {
      releaseScreenWakeLock();
    }
    togglePlay();
  }, [activeBook, voiceReady, isPlaying, togglePlay]);

  const handlePrevLine = useCallback(() => {
    if (!activeBook) return;
    if (currentLine > 0) {
      jumpTo(currentPage, currentLine - 1);
    } else if (currentPage > 0) {
      const prevPage = currentPage - 1;
      const prevLines = ttsPages[prevPage] || [];
      jumpTo(prevPage, Math.max(0, prevLines.length - 1));
    }
  }, [activeBook, currentLine, currentPage, jumpTo, ttsPages]);

  const handleNextLine = useCallback(() => {
    if (!activeBook) return;
    const pageLines = ttsPages[currentPage] || [];
    if (currentLine < pageLines.length - 1) {
      jumpTo(currentPage, currentLine + 1);
    } else if (currentPage < activeBook.totalPages - 1) {
      jumpTo(currentPage + 1, 0);
    }
  }, [activeBook, currentLine, currentPage, jumpTo, ttsPages]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleNextLine();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handlePrevLine();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTogglePlay, handleNextLine, handlePrevLine]);

  // Page synchronization
  useEffect(() => {
    if (activeBook) setGotoInput(String(currentPage + 1));
  }, [currentPage, activeBook]);

  // Chapter Parsing Fallback
  useEffect(() => {
    if (!activeBook) return setActiveChapters([]);
    if (activeBook.chapters?.length)
      return setActiveChapters(activeBook.chapters);
    if (activeBook.displayPages?.length) {
      setTimeout(
        () =>
          setActiveChapters(
            parseChaptersFromDisplayPages(activeBook.displayPages!),
          ),
        0,
      );
    }
  }, [activeBook]);

  // Sleep Timer Interval Watcher
  useEffect(() => {
    if (typeof sleepMode !== "number") return;
    const interval = setInterval(() => {
      setSleepMins((prev) => {
        if (!prev || prev <= 1) {
          if (isPlaying) handleTogglePlay();
          setSleepMode(null);
          return null;
        }
        return prev - 1;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [sleepMode, isPlaying, handleTogglePlay]);

  // Sleep Timer Chapter Boundary Watcher
  useEffect(() => {
    if (
      sleepMode === "chapter" &&
      activeBook &&
      targetChapterPage.current !== null &&
      currentPage >= targetChapterPage.current
    ) {
      if (isPlaying) handleTogglePlay();
      setSleepMode(null);
      targetChapterPage.current = null;
    }
  }, [currentPage, sleepMode, activeBook, isPlaying, handleTogglePlay]);

  const startSleepTimer = (val: number | "chapter") => {
    setSleepMode(val);
    if (val === "chapter") {
      setSleepMins(null);
      const nextCh = activeChapters.find((c) => c.pageIndex > currentPage);
      targetChapterPage.current = nextCh
        ? nextCh.pageIndex
        : activeBook?.totalPages || null;
    } else {
      setSleepMins(val);
      targetChapterPage.current = null;
    }
  };

  const lookupWord = async (word: string) => {
    const cleanWord = word.replace(/[.,;!?()""'’‘“”]/g, "").trim();
    if (!cleanWord) return;
    setDictWord(cleanWord);
    setDictLoading(true);
    setDictData(null);
    try {
      const res = await fetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`,
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDictData(data[0]);
    } catch {
      setDictData(null);
    } finally {
      setDictLoading(false);
    }
  };

  const handleApplyColor = async (color: string) => {
    if (!activeBook || !selectionParams) return;
    const newHighlights = { ...(activeBook.highlights || {}) };
    const highlightId = `hl_${Date.now()}`;
    const updates = selectionParams.lineEntries.map((entry) => {
      const key = `${currentPage}-${entry.lineIdx}`;
      if (!newHighlights[key]) newHighlights[key] = [];
      newHighlights[key].push({ id: highlightId, text: entry.text, color });
      return {
        page: currentPage,
        line: entry.lineIdx,
        text: entry.text,
        color,
      };
    });

    setActiveBook({ ...activeBook, highlights: newHighlights });
    await applyMultiLineHighlight(activeBook.id, updates);
    clearSelection();
  };

  // Direct Highlight Click Handler
  const handleHighlightClick = useCallback(
    (item: HighlightItem, lineIdx: number, rect: DOMRect) => {
      setActiveHighlightPopover({ item, lineIdx, rect });
      setEditingPopoverNote(false);
      setPopoverNoteInput(item.note || "");
    },
    [],
  );

  const handleDeleteHighlight = async (highlightId: string) => {
    if (!activeBook) return;
    const updated = await deleteHighlightById(activeBook.id, highlightId);
    setActiveBook({ ...activeBook, highlights: updated });
    setActiveHighlightPopover(null);
  };

  const handleSaveHighlightNote = async (highlightId: string, note: string) => {
    if (!activeBook) return;
    const updated = await updateHighlightNote(activeBook.id, highlightId, note);
    setActiveBook({ ...activeBook, highlights: updated });
    if (activeHighlightPopover?.item.id === highlightId) {
      setActiveHighlightPopover({
        ...activeHighlightPopover,
        item: { ...activeHighlightPopover.item, note },
      });
      setEditingPopoverNote(false);
    }
  };

  const ttsLines = ttsPages[currentPage] || [];
  const displayedLines = activeBook?.displayPages?.[currentPage] || [];
  const { displayToSentence } = useMemo(
    () => mapDisplayToSentences(displayedLines, ttsLines),
    [displayedLines, ttsLines],
  );

  const handleDisplayLineClick = async (displayIdx: number) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;
    const sentenceIndices = displayToSentence[displayIdx] || [];
    if (!sentenceIndices.length) return;
    await ensureAudioUnlocked();
    jumpTo(currentPage, sentenceIndices[0]);
  };

  const currentChapter = useMemo(() => {
    if (!activeChapters.length) return null;
    return [...activeChapters]
      .reverse()
      .find((c) => c.pageIndex <= currentPage);
  }, [activeChapters, currentPage]);

  const estimatedMinsLeft = activeBook
    ? Math.ceil(((activeBook.totalPages - currentPage) * 1.5) / speed)
    : 0;
  const timeLeftStr =
    estimatedMinsLeft > 60
      ? `${Math.floor(estimatedMinsLeft / 60)}h ${estimatedMinsLeft % 60}m left`
      : `${estimatedMinsLeft}m left`;
  const readerFont = getReaderFont(fontId);
  const formattedActiveTitle = activeBook
    ? cleanBookTitle(activeBook.title)
    : "";

  return (
    <div
      className="app-shell min-h-screen lg:h-screen lg:overflow-hidden flex flex-col font-sans"
      data-theme={theme}
      onClick={() => {
        if (activeHighlightPopover) setActiveHighlightPopover(null);
      }}
    >
      {/* Header */}
      <header
        className={`app-header sticky top-0 z-30 px-3 sm:px-4 py-2.5 ${navbarHidden ? "hidden" : ""}`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          <div className="app-control flex flex-wrap sm:flex-nowrap items-center gap-2 px-2.5 py-1.5 rounded-lg w-full sm:w-auto">
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const cleanTitle = file.name.replace(/\.pdf$/i, "");
                const extracted = await extractPdfPages(file);
                const newBook: BookDoc = {
                  id: `${cleanTitle}_${Date.now()}`,
                  title: cleanTitle,
                  pages: extracted.pages,
                  displayPages: extracted.displayPages,
                  totalPages: extracted.pages.length,
                  coverUrl: extracted.coverUrl,
                  chapters: extracted.chapters,
                  currentPage: 0,
                  currentLine: 0,
                  updatedAt: Date.now(),
                };
                await saveBook(newBook);
                await loadBooks();
                setActiveBook(newBook);
              }}
            />
            {!activeBook && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="app-btn active:scale-95 text-xs font-semibold px-3 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>📁</span> Choose PDF
              </button>
            )}
            <span
              className="text-xs font-bold truncate block w-full sm:w-auto sm:max-w-[160px] md:max-w-xs"
              title={formattedActiveTitle}
            >
              {formattedActiveTitle || (
                <span className="font-medium app-muted">No file selected</span>
              )}
            </span>
          </div>

          {activeBook && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const p = parseInt(gotoInput, 10);
                if (!isNaN(p) && p >= 1 && p <= activeBook.totalPages)
                  jumpTo(p - 1, 0);
              }}
              className="app-control flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
            >
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => jumpTo(Math.max(0, currentPage - 1), 0)}
                className="px-2 py-1 text-xs app-muted disabled:opacity-20 cursor-pointer"
              >
                ◀ Prev
              </button>
              <span className="app-muted text-xs">Pg</span>
              <input
                type="number"
                min={1}
                max={activeBook.totalPages}
                value={gotoInput}
                onChange={(e) => setGotoInput(e.target.value)}
                className="app-input w-11 rounded text-center text-xs font-bold py-0.5"
              />
              <span className="text-xs app-muted">
                / {activeBook.totalPages}
              </span>
              <button
                type="submit"
                className="app-btn text-[11px] font-semibold px-2 py-0.5 rounded cursor-pointer"
              >
                Go
              </button>
              <button
                type="button"
                disabled={currentPage >= activeBook.totalPages - 1}
                onClick={() =>
                  jumpTo(
                    Math.min(activeBook.totalPages - 1, currentPage + 1),
                    0,
                  )
                }
                className="px-2 py-1 text-xs app-muted disabled:opacity-20 cursor-pointer"
              >
                Next ▶
              </button>
            </form>
          )}

          <div className="flex items-center gap-2">
            {/* Reading Streak Button */}
            <button
              type="button"
              onClick={() => setIsStatsOpen(true)}
              className="app-btn text-xs font-bold px-2.5 py-1.5 rounded-md flex items-center gap-1 cursor-pointer transition"
              title="View Reading Stats & Streaks"
            >
              <span>🔥</span>
              <span>{streakDays}d</span>
            </button>

            {compactChrome && (
              <button
                type="button"
                onClick={() => setNavbarHidden(true)}
                className="app-btn text-[11px] font-semibold px-2.5 py-1.5 cursor-pointer"
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
      </header>

      {/* Floating Mobile Controls */}
      {compactChrome && activeBook && !selectionParams && (
        <MobileFloatingPlayer
          title={formattedActiveTitle}
          chapterTitle={currentChapter?.title}
          timeLeftStr={timeLeftStr}
          navbarHidden={navbarHidden}
          isPlaying={isPlaying}
          engineStatus={engineStatus}
          voiceReady={voiceReady}
          speed={speed}
          currentPage={currentPage}
          totalPages={activeBook.totalPages}
          currentLine={currentLine}
          totalLines={ttsLines.length}
          onSpeedChange={setSpeed}
          onTogglePlay={handleTogglePlay}
          onPrevPage={() => jumpTo(Math.max(0, currentPage - 1), 0)}
          onNextPage={() =>
            jumpTo(Math.min(activeBook.totalPages - 1, currentPage + 1), 0)
          }
          onPrevLine={handlePrevLine}
          onNextLine={handleNextLine}
          onShowControls={() => setNavbarHidden(false)}
        />
      )}

      {/* Floating Highlight Toolbar */}
      {selectionParams && (
        <HighlightToolbar
          toolbarRef={toolbarRef}
          selectionParams={selectionParams}
          compactChrome={compactChrome}
          showColorPicker={showColorPicker}
          onShowColorPicker={setShowColorPicker}
          onDefine={lookupWord}
          onApplyColor={handleApplyColor}
        />
      )}

      {/* Tap Highlight Action Popover */}
      {activeHighlightPopover && (
        <div
          className="fixed z-50 app-panel border border-[var(--panel-border)] shadow-2xl rounded-xl p-2 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2 max-w-xs"
          style={
            compactChrome
              ? {
                  bottom: "30px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "88vw",
                }
              : {
                  top: Math.min(
                    window.innerHeight - 120,
                    activeHighlightPopover.rect.bottom + 8,
                  ),
                  left: Math.max(
                    12,
                    Math.min(
                      window.innerWidth - 280,
                      activeHighlightPopover.rect.left,
                    ),
                  ),
                  width: "260px",
                }
          }
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-1 text-[11px] font-bold border-b border-[var(--panel-border)] pb-1.5">
            <span className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: activeHighlightPopover.item.color }}
              />
              Highlight Options
            </span>
            <button
              onClick={() => setActiveHighlightPopover(null)}
              className="p-1 opacity-60 hover:opacity-100 cursor-pointer"
            >
              ✕
            </button>
          </div>

          {editingPopoverNote ? (
            <div className="space-y-1.5">
              <textarea
                value={popoverNoteInput}
                onChange={(e) => setPopoverNoteInput(e.target.value)}
                placeholder="Write your note here..."
                className="app-input w-full rounded p-1.5 text-xs focus:outline-none resize-none"
                rows={2}
                autoFocus
              />
              <div className="flex justify-end gap-1">
                <button
                  onClick={() => setEditingPopoverNote(false)}
                  className="app-btn text-[10px] px-2 py-0.5 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleSaveHighlightNote(
                      activeHighlightPopover.item.id,
                      popoverNoteInput,
                    )
                  }
                  className="app-btn app-accent text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeHighlightPopover.item.note && (
                <div className="text-xs p-1.5 rounded bg-black/5 dark:bg-white/5 border border-inherit">
                  <span className="text-[10px] font-bold block opacity-60">
                    Note:
                  </span>
                  <p className="whitespace-pre-wrap">
                    {activeHighlightPopover.item.note}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between gap-1 pt-1">
                <button
                  onClick={() => setEditingPopoverNote(true)}
                  className="app-btn text-xs font-semibold px-2.5 py-1 rounded flex-1 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>📝</span>
                  <span>
                    {activeHighlightPopover.item.note
                      ? "Edit Note"
                      : "Add Note"}
                  </span>
                </button>
                <button
                  onClick={() =>
                    handleDeleteHighlight(activeHighlightPopover.item.id)
                  }
                  className="app-btn text-xs font-semibold text-rose-500 hover:bg-rose-500/10 px-2.5 py-1 rounded flex items-center justify-center gap-1 cursor-pointer transition"
                >
                  <span>🗑️</span>
                  <span>Delete</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Grid Workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:min-h-0 lg:overflow-hidden">
        <main
          ref={readerContainerRef}
          className="app-panel flex flex-col shadow-xl overflow-hidden relative lg:col-span-8 lg:h-full rounded-lg"
        >
          {/* Reader Panel Subheader */}
          <div className="app-panel-header px-4 py-2.5 flex items-center justify-between text-xs shrink-0 relative z-20">
            <div className="flex items-center gap-1.5 truncate">
              {activeBook?.chapters && activeBook.chapters.length > 0 && (
                <button
                  onClick={() => setIsChapterDrawerOpen(true)}
                  className="app-btn text-xs font-semibold px-2 py-1.5 rounded cursor-pointer flex items-center gap-1 shrink-0"
                  title="Table of Contents"
                >
                  📑 <span className="hidden sm:inline">Chapters</span>
                </button>
              )}

              {activeBook && (
                <button
                  onClick={() => setIsAnnotationsOpen(true)}
                  className="app-btn text-xs font-semibold px-2 py-1.5 rounded cursor-pointer flex items-center gap-1 shrink-0"
                  title="View all highlights and notes"
                >
                  📝 <span className="hidden sm:inline">Notes</span>
                </button>
              )}

              <span className="font-semibold truncate ml-1">
                {activeBook
                  ? `Page ${currentPage + 1} of ${activeBook.totalPages}`
                  : "Document View"}
                {currentChapter && (
                  <span className="ml-2 opacity-70 hidden md:inline">
                    • {currentChapter.title}
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Sleep Timer Trigger */}
              {activeBook && (
                <div className="relative group">
                  <button className="app-btn text-[11px] font-semibold px-2 py-1.5 rounded cursor-pointer">
                    💤{" "}
                    {sleepMins
                      ? `${sleepMins}m`
                      : sleepMode === "chapter"
                        ? "Chap"
                        : "Timer"}
                  </button>
                  <div className="absolute top-full right-0 mt-1 hidden group-hover:flex flex-col app-panel border rounded-md shadow-xl w-32 z-50">
                    {[15, 30, 60].map((m) => (
                      <button
                        key={m}
                        onClick={() => startSleepTimer(m)}
                        className="px-3 py-1.5 text-xs text-left hover:bg-black/10 cursor-pointer"
                      >
                        {m} minutes
                      </button>
                    ))}
                    <button
                      onClick={() => startSleepTimer("chapter")}
                      className="px-3 py-1.5 text-xs text-left hover:bg-black/10 cursor-pointer"
                    >
                      End of Chapter
                    </button>
                  </div>
                </div>
              )}
              {/* Font Sizer */}
              <div className="app-control flex items-center gap-1 px-1 py-0.5 rounded">
                <button
                  onClick={() => setFontSize((s) => Math.max(12, s - 1))}
                  className="px-1 text-[11px] font-bold cursor-pointer"
                >
                  A−
                </button>
                <span className="font-mono text-xs font-bold w-5 text-center">
                  {fontSize}
                </span>
                <button
                  onClick={() => setFontSize((s) => Math.min(28, s + 1))}
                  className="px-1 text-[11px] font-bold cursor-pointer"
                >
                  A+
                </button>
              </div>
            </div>
          </div>

          {/* Reader Scrollable Viewport */}
          <div
            ref={scrollContainerRef}
            className="px-4 py-6 sm:px-8 md:p-10 flex-1 min-h-0 overflow-y-auto relative"
          >
            {activeBook ? (
              <ReaderTextBody
                displayedLines={displayedLines}
                displayToSentence={displayToSentence}
                currentLine={currentLine}
                currentPage={currentPage}
                highlights={activeBook.highlights}
                fontSize={fontSize}
                fontFamily={readerFont.cssFamily}
                onLineClick={handleDisplayLineClick}
                onHighlightClick={handleHighlightClick}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center app-muted text-sm space-y-2">
                <span className="text-2xl">📄</span>
                <p>No active document. Choose a PDF or select a saved book.</p>
              </div>
            )}
          </div>

          {/* Desktop Docked Playback Bar */}
          {!compactChrome && activeBook && (
            <DesktopPlaybackDock
              speed={speed}
              onSpeedChange={setSpeed}
              isPlaying={isPlaying}
              engineStatus={engineStatus}
              voiceReady={voiceReady}
              currentPage={currentPage}
              totalPages={activeBook.totalPages}
              currentLine={currentLine}
              totalLines={ttsLines.length}
              onTogglePlay={handleTogglePlay}
              onPrevPage={() => jumpTo(Math.max(0, currentPage - 1), 0)}
              onNextPage={() =>
                jumpTo(Math.min(activeBook.totalPages - 1, currentPage + 1), 0)
              }
              onPrevLine={handlePrevLine}
              onNextLine={handleNextLine}
            />
          )}
        </main>

        <aside className="lg:col-span-4 flex flex-col lg:h-full lg:min-h-0 lg:overflow-y-auto">
          <BookShelf
            books={books}
            activeBookId={activeBook?.id || null}
            currentPage={currentPage}
            onSelectBook={(book) => {
              setActiveBook(book);
              loadBooks();
            }}
            onDeleteBook={async (id) => {
              await deleteBook(id);
              if (activeBook?.id === id) setActiveBook(null);
              await loadBooks();
            }}
            onAddBook={async (file) => {
              const cleanTitle = file.name.replace(/\.pdf$/i, "");
              const extracted = await extractPdfPages(file);
              const newBook: BookDoc = {
                id: `${cleanTitle}_${Date.now()}`,
                title: cleanTitle,
                pages: extracted.pages,
                displayPages: extracted.displayPages,
                totalPages: extracted.pages.length,
                coverUrl: extracted.coverUrl,
                chapters: extracted.chapters,
                currentPage: 0,
                currentLine: 0,
                updatedAt: Date.now(),
              };
              await saveBook(newBook);
              await loadBooks();
              setActiveBook(newBook);
            }}
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
        onDownloadVoice={async (id) => {
          await downloadVoice(id, () => {});
          setInstalledVoiceIds((prev) => [...new Set([...prev, id])]);
          setVoiceReady(true);
        }}
        onSetMaleVoice={setMaleVoiceId}
        onSetFemaleVoice={setFemaleVoiceId}
      />

      <ChapterDrawer
        isOpen={isChapterDrawerOpen}
        onClose={() => setIsChapterDrawerOpen(false)}
        chapters={activeChapters}
        currentPage={currentPage}
        onSelectChapter={(pageIdx) => jumpTo(pageIdx, 0)}
      />

      {/* Annotations & Notes Drawer */}
      <AnnotationsDrawer
        isOpen={isAnnotationsOpen}
        onClose={() => setIsAnnotationsOpen(false)}
        highlights={activeBook?.highlights}
        currentPage={currentPage}
        onJumpTo={(page) => jumpTo(page, 0)}
        onDeleteHighlight={handleDeleteHighlight}
        onSaveNote={handleSaveHighlightNote}
      />

      {/* Reading Stats & Streaks Modal */}
      <ReadingStatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        books={books}
      />

      <DictionaryModal
        word={dictWord}
        data={dictData}
        loading={dictLoading}
        onClose={() => setDictWord(null)}
      />
    </div>
  );
}
