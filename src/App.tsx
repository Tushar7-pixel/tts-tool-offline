// src/App.tsx
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { extractPdfPages, mapDisplayToSentences } from "./utils/pdf";
import {
  isVoiceInstalled,
  downloadVoice,
  DEFAULT_PIPER_VOICE,
} from "./utils/tts";
import {
  saveBook,
  getAllBooks,
  type BookDoc,
  deleteBook,
  applyMultiLineHighlight,
  type HighlightItem,
} from "./utils/db";
import { useReader } from "./hooks/useReader";
import { BookShelf, cleanBookTitle } from "./components/BookShelf";
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
import { subscribeTtsStatus, type TtsEngineStatus } from "./utils/tts";
import { parseChaptersFromDisplayPages, type ChapterItem } from "./utils/pdf";
import { ChapterDrawer } from "./components/ChapterDrawer";

const HIGHLIGHT_COLORS = [
  { label: "Yellow", value: "rgba(253, 224, 71, 0.4)", bg: "bg-yellow-300" },
  { label: "Green", value: "rgba(134, 239, 172, 0.4)", bg: "bg-green-300" },
  { label: "Blue", value: "rgba(147, 197, 253, 0.4)", bg: "bg-blue-300" },
  { label: "Purple", value: "rgba(216, 180, 254, 0.4)", bg: "bg-purple-300" },
  { label: "Pink", value: "rgba(249, 168, 212, 0.4)", bg: "bg-pink-300" },
  { label: "Orange", value: "rgba(253, 186, 116, 0.4)", bg: "bg-orange-300" },
];

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-sm p-4 transition-opacity"
      onClick={onClose}
    >
      <div
        className="app-panel w-full max-w-sm rounded-2xl p-5 shadow-2xl relative animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-lg opacity-50 hover:opacity-100 cursor-pointer w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          ✕
        </button>
        <h3 className="text-xl font-bold mb-2 capitalize pr-6 text-[var(--app-text)]">
          {word}
        </h3>
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
                <ul className="list-disc pl-5 text-sm space-y-2 text-[var(--app-text)] opacity-90">
                  {m.definitions.slice(0, 3).map((d: any, j: number) => (
                    <li key={j}>
                      {d.definition}
                      {d.example && (
                        <p className="text-xs italic opacity-70 mt-0.5">
                          "{d.example}"
                        </p>
                      )}
                    </li>
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

const MemoizedReaderLine = React.memo(
  ({
    idx,
    lineText,
    lineState,
    highlights,
    onLineClick,
  }: {
    idx: number;
    lineText: string;
    lineState: string;
    highlights?: HighlightItem[];
    onLineClick: (idx: number) => void;
  }) => {
    let renderedContent: React.ReactNode = lineText;

    if (lineText.length > 0 && highlights && highlights.length > 0) {
      type Segment = { text: string; color?: string };
      let segments: Segment[] = [{ text: lineText }];

      for (const hl of highlights) {
        if (!hl.text) continue;
        const nextSegments: Segment[] = [];

        for (const seg of segments) {
          if (seg.color || !seg.text.includes(hl.text)) {
            nextSegments.push(seg);
          } else {
            const parts = seg.text.split(hl.text);
            for (let i = 0; i < parts.length; i++) {
              if (parts[i].length > 0) nextSegments.push({ text: parts[i] });
              if (i < parts.length - 1)
                nextSegments.push({ text: hl.text, color: hl.color });
            }
          }
        }
        segments = nextSegments;
      }

      renderedContent = (
        <>
          {segments.map((s, sIdx) =>
            s.color ? (
              <mark
                key={sIdx}
                style={{
                  backgroundColor: s.color,
                  color: "inherit",
                  padding: "0 2px",
                  borderRadius: "3px",
                }}
              >
                {s.text}
              </mark>
            ) : (
              <React.Fragment key={sIdx}>{s.text}</React.Fragment>
            ),
          )}
        </>
      );
    } else if (lineText.length === 0) {
      renderedContent = <span className="block h-[1em]">&nbsp;</span>;
    }

    return (
      <div
        id={`reader-line-${idx}`}
        onClick={() => onLineClick(idx)}
        className={`reader-line px-1 sm:px-2 py-0.5 cursor-pointer ${lineState}`}
      >
        {renderedContent}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.lineState === nextProps.lineState &&
      prevProps.lineText === nextProps.lineText &&
      JSON.stringify(prevProps.highlights) ===
        JSON.stringify(nextProps.highlights)
    );
  },
);

type SelectionData = {
  rect: DOMRect;
  text: string;
  lineEntries: { lineIdx: number; text: string }[];
};

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
  const [engineStatus, setEngineStatus] = useState<TtsEngineStatus>("idle");
  const formattedActiveTitle = activeBook
    ? cleanBookTitle(activeBook.title)
    : "";
  const MIN_FONT_SIZE = 12;
  const MAX_FONT_SIZE = 28;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  const [installedVoiceIds, setInstalledVoiceIds] = useState<string[]>(() => {
    const saved = localStorage.getItem("echoread_installed_voices");
    return saved ? JSON.parse(saved) : ["en_US-hfc_male-medium"];
  });

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

  const [activeGender, setActiveGender] = useState<"male" | "female">("male");

  const isMaleReady = installedVoiceIds.includes(maleVoiceId);
  const isFemaleReady = Boolean(
    femaleVoiceId && installedVoiceIds.includes(femaleVoiceId),
  );
  const canToggleVoices = isMaleReady && isFemaleReady;

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

  const handleInstallVoice = async () => {
    setDownloadPct(0);
    await downloadVoice(DEFAULT_PIPER_VOICE, (pct) => setDownloadPct(pct));
    setVoiceReady(true);
    setDownloadPct(null);
  };

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
  // Track if user explicitly initiated/tapped playback highlighting
  const [showActiveLineHighlight, setShowActiveLineHighlight] = useState(false);
  const handleTogglePlay = useCallback(async () => {
    if (!activeBook || !voiceReady) return;

    if (!isPlaying) {
      setShowActiveLineHighlight(true);
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
      const prevPageLines = ttsPages[prevPage] || [];
      jumpTo(prevPage, Math.max(0, prevPageLines.length - 1));
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

  useEffect(() => {
    if (activeBook) setGotoInput(String(currentPage + 1));
  }, [currentPage, activeBook]);

  const ttsLines = ttsPages[currentPage] || [];
  const displayedLines = activeBook?.displayPages?.[currentPage] || [];

  const { displayToSentence } = useMemo(
    () => mapDisplayToSentences(displayedLines, ttsLines),
    [displayedLines, ttsLines],
  );

  const handleDisplayLineClick = async (displayIdx: number) => {
    // If user is selecting text to highlight, don't trigger TTS line jump
    const selection = window.getSelection();
    if (
      selection &&
      !selection.isCollapsed &&
      selection.toString().trim().length > 0
    ) {
      return;
    }

    const sentenceIndices = displayToSentence[displayIdx] || [];
    if (sentenceIndices.length === 0) return;

    // Enable playback line highlight on explicit tap/click
    setShowActiveLineHighlight(true);
    await ensureAudioUnlocked();
    jumpTo(currentPage, sentenceIndices[0]);
  };

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
        chapters: extracted?.chapters,
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
      chapters: extracted.chapters,
      currentPage: 0,
      currentLine: 0,
      updatedAt: Date.now(),
    };

    await saveBook(newBook);
    await loadBooks();
    setActiveBook(newBook);
  };

  useEffect(() => {
    return subscribeTtsStatus((status) => {
      setEngineStatus(status);
    });
  }, []);

  useEffect(() => {
    updateMediaSessionState(isPlaying);
    if (!isPlaying) releaseScreenWakeLock();
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
        if (currentPage < activeBook.totalPages - 1) jumpTo(currentPage + 1, 0);
      },
      onPrev: () => {
        if (currentPage > 0) jumpTo(currentPage - 1, 0);
      },
    });
  }, [
    activeBook,
    currentPage,
    currentActiveVoiceId,
    handleTogglePlay,
    currentVoiceInfo,
    jumpTo,
  ]);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const readerContainerRef = useRef<HTMLElement | null>(null);

  const toggleFullscreen = async () => {
    const next = !isFullscreen;
    setIsFullscreen(next);

    if (document.fullscreenEnabled) {
      try {
        if (next && !document.fullscreenElement) {
          await readerContainerRef.current?.requestFullscreen?.();
        } else if (!next && document.fullscreenElement) {
          await document.exitFullscreen?.();
        }
      } catch {}
    }
  };

  useEffect(() => {
    const handleFsChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    const activeDisplayIdx = displayedLines.findIndex((_, i) =>
      (displayToSentence[i] || []).includes(currentLine),
    );

    if (activeDisplayIdx === -1) return;

    const container = scrollContainerRef.current;
    const targetElement = document.getElementById(
      `reader-line-${activeDisplayIdx}`,
    );

    if (container && targetElement) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const targetTop =
        targetRect.top - containerRect.top + container.scrollTop;
      const centeredOffset =
        targetTop - container.clientHeight / 2 + targetRect.height / 2;

      container.scrollTo({
        top: Math.max(0, centeredOffset),
        behavior: "smooth",
      });
    }
  }, [currentLine, currentPage, isPlaying, displayedLines, displayToSentence]);

  const [isChapterDrawerOpen, setIsChapterDrawerOpen] = useState(false);
  const [activeChapters, setActiveChapters] = useState<ChapterItem[]>([]);

  useEffect(() => {
    if (!activeBook) {
      setActiveChapters([]);
      return;
    }

    if (activeBook.chapters && activeBook.chapters.length > 0) {
      setActiveChapters(activeBook.chapters);
      return;
    }

    if (activeBook.displayPages && activeBook.displayPages.length > 0) {
      setTimeout(() => {
        const parsed = parseChaptersFromDisplayPages(activeBook.displayPages!);
        setActiveChapters(parsed);
      }, 0);
    }
  }, [activeBook]);

  const currentChapter = useMemo(() => {
    if (activeChapters.length === 0) return null;
    return [...activeChapters]
      .reverse()
      .find((c) => c.pageIndex <= currentPage);
  }, [activeChapters, currentPage]);

  const [sleepMode, setSleepMode] = useState<number | "chapter" | null>(null);
  const [sleepMins, setSleepMins] = useState<number | null>(null);
  const targetChapterPage = useRef<number | null>(null);

  useEffect(() => {
    if (typeof sleepMode !== "number") return;
    const interval = setInterval(() => {
      setSleepMins((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (isPlaying) handleTogglePlay();
          setSleepMode(null);
          return null;
        }
        return prev - 1;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [sleepMode, isPlaying, handleTogglePlay]);

  useEffect(() => {
    if (sleepMode === "chapter" && activeBook) {
      if (
        targetChapterPage.current !== null &&
        currentPage >= targetChapterPage.current
      ) {
        if (isPlaying) handleTogglePlay();
        setSleepMode(null);
        targetChapterPage.current = null;
      }
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

  const estimatedMinsLeft = activeBook
    ? Math.ceil(((activeBook.totalPages - currentPage) * 1.5) / speed)
    : 0;
  const timeLeftStr =
    estimatedMinsLeft > 60
      ? `${Math.floor(estimatedMinsLeft / 60)}h ${estimatedMinsLeft % 60}m left`
      : `${estimatedMinsLeft}m left`;

  // === MULTI-LINE SELECTION & 6-COLOR HIGHLIGHTING ===
  const [selectionParams, setSelectionParams] = useState<SelectionData | null>(
    null,
  );
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [dictWord, setDictWord] = useState<string | null>(null);
  const [dictData, setDictData] = useState<any>(null);
  const [dictLoading, setDictLoading] = useState(false);

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
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setDictData(data[0]);
    } catch {
      setDictData(null);
    } finally {
      setDictLoading(false);
    }
  };

  const handleTextSelection = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelectionParams(null);
        setShowColorPicker(false);
        return;
      }

      const fullSelectedText = sel.toString().trim();
      if (!fullSelectedText) {
        setSelectionParams(null);
        setShowColorPicker(false);
        return;
      }

      const range = sel.getRangeAt(0);
      const startLineEl = (
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? (range.startContainer as Element)
          : range.startContainer.parentElement
      )?.closest(".reader-line");
      const endLineEl = (
        range.endContainer.nodeType === Node.ELEMENT_NODE
          ? (range.endContainer as Element)
          : range.endContainer.parentElement
      )?.closest(".reader-line");

      if (!startLineEl || !endLineEl) {
        setSelectionParams(null);
        setShowColorPicker(false);
        return;
      }

      const startIdx = parseInt(startLineEl.id.replace("reader-line-", ""), 10);
      const endIdx = parseInt(endLineEl.id.replace("reader-line-", ""), 10);
      const minIdx = Math.min(startIdx, endIdx);
      const maxIdx = Math.max(startIdx, endIdx);

      const lineEntries: { lineIdx: number; text: string }[] = [];

      for (let i = minIdx; i <= maxIdx; i++) {
        const lineEl = document.getElementById(`reader-line-${i}`);
        if (!lineEl) continue;

        const lineText = lineEl.textContent || "";
        if (!lineText) continue;

        const lineRange = document.createRange();
        lineRange.selectNodeContents(lineEl);

        const testRange = range.cloneRange();
        if (
          testRange.compareBoundaryPoints(Range.START_TO_END, lineRange) > 0 &&
          testRange.compareBoundaryPoints(Range.END_TO_START, lineRange) < 0
        ) {
          const subRange = document.createRange();
          if (
            testRange.compareBoundaryPoints(Range.START_TO_START, lineRange) <=
            0
          ) {
            subRange.setStart(lineRange.startContainer, lineRange.startOffset);
          } else {
            subRange.setStart(testRange.startContainer, testRange.startOffset);
          }

          if (
            testRange.compareBoundaryPoints(Range.END_TO_END, lineRange) >= 0
          ) {
            subRange.setEnd(lineRange.endContainer, lineRange.endOffset);
          } else {
            subRange.setEnd(testRange.endContainer, testRange.endOffset);
          }

          const partialText = subRange.toString().trim();
          if (partialText) {
            lineEntries.push({ lineIdx: i, text: partialText });
          }
        }
      }

      if (lineEntries.length === 0) {
        setSelectionParams(null);
        setShowColorPicker(false);
        return;
      }

      const rect = range.getBoundingClientRect();
      setSelectionParams({ rect, text: fullSelectedText, lineEntries });
      setShowColorPicker(false);
    }, 50);
  }, []);

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

    window.getSelection()?.removeAllRanges();
    setSelectionParams(null);
    setShowColorPicker(false);
  };

  return (
    <div
      className="app-shell min-h-screen lg:h-screen lg:overflow-hidden flex flex-col font-sans"
      data-theme={theme}
      onClick={() => {
        if (selectionParams) {
          window.getSelection()?.removeAllRanges();
          setSelectionParams(null);
          setShowColorPicker(false);
        }
      }}
    >
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
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAddOrUploadBook(file);
              }}
            />
            {!activeBook && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="app-btn active:scale-95 text-xs font-semibold px-3 py-1 rounded-md transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <span>📁</span> Choose PDF
              </button>
            )}
            <span
              className="text-xs font-bold truncate block w-full sm:w-auto sm:max-w-[160px] md:max-w-xs select-none"
              title={formattedActiveTitle || "No file selected"}
            >
              {formattedActiveTitle || (
                <span className="font-medium app-muted">No file selected</span>
              )}
            </span>
          </div>

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
                <div className="flex items-center gap-1.5 w-full md:w-auto min-w-0">
                  <div className="flex items-center rounded-md border border-inherit bg-black/10 p-0.5 flex-1 md:flex-initial min-w-0">
                    <button
                      type="button"
                      disabled={!isMaleReady}
                      onClick={() => setActiveGender("male")}
                      className={`flex-1 md:flex-initial min-w-0 text-[11px] font-semibold px-2.5 py-1 rounded transition cursor-pointer flex items-center justify-center gap-1.5 select-none disabled:opacity-40 ${
                        activeGender === "male"
                          ? "bg-amber-400 text-black font-bold shadow-xs"
                          : "app-muted hover:opacity-100"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          activeGender === "male"
                            ? "bg-black animate-pulse"
                            : "bg-transparent"
                        }`}
                      />
                      <span className="truncate">{maleLabel}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!isFemaleReady) {
                          setIsVoiceModalOpen(true);
                        } else {
                          setActiveGender("female");
                        }
                      }}
                      className={`flex-1 md:flex-initial min-w-0 text-[11px] font-semibold px-2.5 py-1 rounded transition cursor-pointer flex items-center justify-center gap-1.5 select-none ${
                        activeGender === "female"
                          ? "bg-amber-400 text-black font-bold shadow-xs"
                          : "app-muted hover:opacity-100"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          activeGender === "female"
                            ? "bg-black animate-pulse"
                            : "bg-transparent"
                        }`}
                      />
                      <span className="truncate">{femaleLabel}</span>
                    </button>
                  </div>

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

                  <button
                    type="button"
                    onClick={() => setIsVoiceModalOpen(true)}
                    title="Open Voice Library"
                    className="app-btn text-xs font-semibold px-2 py-1 rounded-md transition cursor-pointer shrink-0 flex items-center"
                  >
                    <span>⚙️</span>
                  </button>
                </div>
              </>
            )}
          </div>

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
      </header>

      {compactChrome && activeBook && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-[400px] z-40 transition-all duration-300 ${
            navbarHidden
              ? "translate-y-24 opacity-0 pointer-events-none"
              : "translate-y-0 opacity-100"
          }`}
        >
          <div className="app-panel shadow-2xl rounded-3xl p-4 flex flex-col gap-3 border border-[var(--panel-border)] backdrop-blur-xl bg-opacity-95 dark:bg-opacity-95">
            <div className="flex flex-col items-center text-center px-4">
              <h4 className="text-sm font-bold text-[var(--app-text)] truncate w-full">
                {formattedActiveTitle}
              </h4>
              <div className="flex items-center gap-2 mt-0.5 justify-center w-full">
                <p className="text-[11px] text-[var(--accent)] font-semibold truncate">
                  {currentChapter?.title || `Page ${currentPage + 1}`}
                </p>
                <span className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[9px] uppercase font-bold tracking-wider opacity-80">
                  {timeLeftStr}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 sm:gap-4 mt-1">
              <button
                onClick={() => jumpTo(Math.max(0, currentPage - 1), 0)}
                disabled={currentPage === 0}
                className="app-muted hover:text-[var(--app-text)] disabled:opacity-30 text-lg p-1 cursor-pointer transition flex items-center justify-center"
              >
                ⏮
              </button>
              <button
                onClick={handlePrevLine}
                disabled={currentPage === 0 && currentLine === 0}
                className="app-muted hover:text-[var(--app-text)] disabled:opacity-30 text-lg p-1 cursor-pointer transition flex items-center justify-center"
              >
                ⏪
              </button>

              <button
                onClick={handleTogglePlay}
                disabled={!voiceReady}
                className={`w-14 h-14 flex items-center justify-center rounded-full shadow-lg cursor-pointer transition shrink-0 ${
                  isPlaying ? "app-pause" : "app-play"
                } disabled:opacity-25`}
              >
                {engineStatus !== "idle" ? (
                  <span className="inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <span className="text-xl">⏸</span>
                ) : (
                  <span className="text-xl ml-1">▶</span>
                )}
              </button>

              <button
                onClick={handleNextLine}
                disabled={
                  currentPage >= activeBook.totalPages - 1 &&
                  currentLine >= ttsLines.length - 1
                }
                className="app-muted hover:text-[var(--app-text)] disabled:opacity-30 text-lg p-1 cursor-pointer transition flex items-center justify-center"
              >
                ⏩
              </button>
              <button
                onClick={() =>
                  jumpTo(
                    Math.min(activeBook.totalPages - 1, currentPage + 1),
                    0,
                  )
                }
                disabled={currentPage >= activeBook.totalPages - 1}
                className="app-muted hover:text-[var(--app-text)] disabled:opacity-30 text-lg p-1 cursor-pointer transition flex items-center justify-center"
              >
                ⏭
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 px-3 mt-1">
              <span className="text-[10px] app-muted uppercase tracking-wider font-bold">
                Speed
              </span>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="flex-1 accent-[var(--accent)] cursor-pointer h-1 rounded"
              />
              <span className="text-xs app-accent font-mono font-bold w-8 text-right tabular-nums">
                {speed.toFixed(1)}×
              </span>
            </div>
          </div>
        </div>
      )}

      {navbarHidden && compactChrome && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={() => setNavbarHidden(false)}
            className="app-panel shadow-2xl border border-[var(--panel-border)] backdrop-blur-xl bg-opacity-90 dark:bg-opacity-90 px-5 py-2.5 rounded-full text-xs font-bold text-[var(--app-text)] flex items-center gap-2 cursor-pointer transition active:scale-95 hover:bg-[var(--btn-hover)]"
          >
            <span className="text-[14px]">👀</span>
            <span className="tracking-wide uppercase text-[10px]">
              Show Controls
            </span>
          </button>
        </div>
      )}

      {/* Floating Selection Toolbar & 6-Color Picker */}
      {selectionParams && (
        <div
          className="fixed z-50 flex items-center gap-1 app-panel border border-[var(--panel-border)] shadow-2xl rounded-lg p-1 animate-in fade-in zoom-in duration-200"
          style={{
            top: Math.max(10, selectionParams.rect.top - 50),
            left: Math.max(
              10,
              Math.min(
                window.innerWidth - 250,
                selectionParams.rect.left +
                  selectionParams.rect.width / 2 -
                  100,
              ),
            ),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {!showColorPicker ? (
            <>
              {selectionParams.text.split(/\s+/).length <= 3 && (
                <button
                  onClick={() => {
                    lookupWord(selectionParams.text);
                    window.getSelection()?.removeAllRanges();
                    setSelectionParams(null);
                  }}
                  className="px-3 py-1.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 rounded transition cursor-pointer"
                >
                  📖 Define
                </button>
              )}
              <button
                onClick={() => setShowColorPicker(true)}
                className="px-3 py-1.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 rounded transition flex items-center gap-1.5 cursor-pointer"
              >
                <span className="w-3 h-3 rounded-full bg-yellow-300"></span>{" "}
                Highlight
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5 px-1 py-0.5">
              {HIGHLIGHT_COLORS.map((col) => (
                <button
                  key={col.label}
                  onClick={() => handleApplyColor(col.value)}
                  title={col.label}
                  className={`w-6 h-6 rounded-full ${col.bg} border border-black/10 hover:scale-110 active:scale-95 transition cursor-pointer shadow-xs`}
                />
              ))}
              <button
                onClick={() => setShowColorPicker(false)}
                className="ml-1 p-1 text-xs opacity-60 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:min-h-0 lg:overflow-hidden">
        {" "}
        <main
          ref={readerContainerRef}
          className={`app-panel flex flex-col shadow-xl overflow-hidden transition-all duration-150 relative ${
            isFullscreen
              ? "fixed inset-0 z-50 w-screen h-[100dvh] rounded-none border-none"
              : "lg:col-span-8 lg:h-full rounded-lg"
          }`}
        >
          <div className="app-panel-header px-3 sm:px-5 py-2.5 flex items-center justify-between text-xs shrink-0 gap-3 relative z-20">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {activeBook?.chapters && activeBook.chapters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsChapterDrawerOpen(true)}
                  className="app-btn text-xs font-semibold px-2 py-1.5 rounded flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Table of Contents"
                >
                  <span className="text-sm">📑</span>
                  <span className="hidden sm:inline">Chapters</span>
                </button>
              )}

              <span className="font-semibold truncate">
                {activeBook
                  ? `Page ${currentPage + 1} of ${activeBook.totalPages}`
                  : "Document View"}
                {currentChapter && (
                  <span className="ml-2 font-normal opacity-70 hidden md:inline">
                    • {currentChapter.title}
                  </span>
                )}
                {activeBook && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[10px] uppercase font-bold tracking-wider opacity-80 hidden md:inline-block">
                    ⏱ {timeLeftStr}
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {activeBook && (
                <div className="relative group flex items-center shrink-0">
                  <button
                    type="button"
                    className={`app-btn text-[11px] font-semibold px-2 py-1.5 rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                      sleepMode
                        ? "app-accent shadow-sm"
                        : "border border-inherit"
                    }`}
                  >
                    <span>💤</span>
                    <span>
                      {sleepMins
                        ? `${sleepMins}m`
                        : sleepMode === "chapter"
                          ? "Chap"
                          : "Timer"}
                    </span>
                  </button>

                  <div className="absolute top-full right-0 mt-1 hidden group-hover:flex flex-col bg-[var(--app-bg)] shadow-xl border border-[var(--panel-border)] rounded-md overflow-hidden w-32">
                    {[15, 30, 60].map((m) => (
                      <button
                        key={m}
                        onClick={() => startSleepTimer(m)}
                        className="px-3 py-2 text-xs font-medium text-left hover:bg-black/10 dark:hover:bg-white/10 transition cursor-pointer"
                      >
                        {m} minutes
                      </button>
                    ))}
                    <button
                      onClick={() => startSleepTimer("chapter")}
                      className="px-3 py-2 text-xs font-medium text-left hover:bg-black/10 dark:hover:bg-white/10 transition cursor-pointer"
                    >
                      End of Chapter
                    </button>
                    {sleepMode && (
                      <button
                        onClick={() => setSleepMode(null)}
                        className="px-3 py-2 text-xs font-bold text-rose-500 text-left hover:bg-rose-500/10 transition cursor-pointer border-t border-[var(--panel-border)]"
                      >
                        Cancel Timer
                      </button>
                    )}
                  </div>
                </div>
              )}

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
                <span className="app-accent font-mono font-bold w-7 text-center tabular-nums select-none">
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

              <span className="hidden lg:inline app-muted ml-1">
                {displayedLines.length} lines
              </span>

              <button
                type="button"
                onClick={toggleFullscreen}
                title={
                  isFullscreen ? "Exit Fullscreen (Esc)" : "Enter Fullscreen"
                }
                className={`text-xs px-2 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1 shrink-0 ${
                  isFullscreen
                    ? "bg-amber-400 text-black font-bold shadow-xs"
                    : "app-btn border border-inherit"
                }`}
              >
                <span className="text-sm">{isFullscreen ? "🗗" : "⛶"}</span>
              </button>
            </div>
          </div>

          <div
            ref={scrollContainerRef}
            onClick={() => {
              if (compactChrome) {
                setNavbarHidden((prev) => !prev);
              }
            }}
            onMouseUp={handleTextSelection}
            onTouchEnd={handleTextSelection}
            className={`px-3 py-4 sm:px-6 md:p-10 flex-1 min-h-0 overflow-y-auto relative ${isFullscreen ? "h-full max-h-none" : ""}`}
          >
            {activeBook ? (
              <div
                className="text-left max-w-3xl mx-auto space-y-2 pb-6"
                style={{
                  fontFamily: readerFont.cssFamily,
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.7,
                }}
              >
                {displayedLines.map((line, idx) => {
                  const sentenceIndices = displayToSentence[idx] || [];
                  const isCurrent = sentenceIndices.includes(currentLine);
                  const lineState = isCurrent ? "is-current" : "is-pending";
                  const hlItems =
                    activeBook.highlights?.[`${currentPage}-${idx}`];

                  return (
                    <MemoizedReaderLine
                      key={idx}
                      idx={idx}
                      lineText={line}
                      lineState={lineState}
                      highlights={hlItems}
                      onLineClick={handleDisplayLineClick}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center app-muted text-sm space-y-2">
                <span className="text-2xl">📄</span>
                <p>No active document. Choose a PDF or select a saved book.</p>
              </div>
            )}
          </div>

          {!compactChrome && activeBook && (
            <div className="border-t border-[var(--panel-border)] bg-[var(--app-bg)]/90 backdrop-blur px-3 py-2 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 z-20">
              <div className="flex items-center justify-between w-full sm:w-auto gap-3 px-2 sm:px-0 order-2 sm:order-1">
                <span className="text-[10px] app-muted uppercase tracking-wider font-bold">
                  Speed
                </span>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full sm:w-20 accent-[var(--accent)] cursor-pointer h-1 rounded"
                />
                <span className="text-xs app-accent font-mono font-bold w-8 text-right tabular-nums">
                  {speed.toFixed(1)}×
                </span>
              </div>

              <div className="flex items-center justify-center gap-4 sm:gap-6 order-1 sm:order-2 w-full sm:w-auto">
                <button
                  onClick={() => jumpTo(Math.max(0, currentPage - 1), 0)}
                  disabled={currentPage === 0}
                  title="Previous Page (Ctrl + Left)"
                  className="app-muted hover:text-[var(--app-text)] disabled:opacity-30 text-lg cursor-pointer transition flex items-center justify-center"
                >
                  ⏮
                </button>
                <button
                  onClick={handlePrevLine}
                  disabled={currentPage === 0 && currentLine === 0}
                  title="Previous Line (Left Arrow)"
                  className="app-muted hover:text-[var(--app-text)] disabled:opacity-30 text-lg cursor-pointer transition flex items-center justify-center"
                >
                  ⏪
                </button>

                <button
                  onClick={handleTogglePlay}
                  disabled={!voiceReady}
                  className={`w-12 h-12 flex items-center justify-center rounded-full shadow-lg cursor-pointer transition shrink-0 ${
                    isPlaying ? "app-pause" : "app-play"
                  } disabled:opacity-25`}
                  title="Play / Pause (Spacebar)"
                >
                  {engineStatus !== "idle" ? (
                    <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <span className="text-lg">⏸</span>
                  ) : (
                    <span className="text-lg ml-1">▶</span>
                  )}
                </button>

                <button
                  onClick={handleNextLine}
                  disabled={
                    currentPage >= activeBook.totalPages - 1 &&
                    currentLine >= ttsLines.length - 1
                  }
                  title="Next Line (Right Arrow)"
                  className="app-muted hover:text-[var(--app-text)] disabled:opacity-30 text-lg cursor-pointer transition flex items-center justify-center"
                >
                  ⏩
                </button>
                <button
                  onClick={() =>
                    jumpTo(
                      Math.min(activeBook.totalPages - 1, currentPage + 1),
                      0,
                    )
                  }
                  disabled={currentPage >= activeBook.totalPages - 1}
                  title="Next Page (Ctrl + Right)"
                  className="app-muted hover:text-[var(--app-text)] disabled:opacity-30 text-lg cursor-pointer transition flex items-center justify-center"
                >
                  ⏭
                </button>
              </div>

              <div className="hidden sm:block w-[120px] order-3"></div>
            </div>
          )}
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

      <ChapterDrawer
        isOpen={isChapterDrawerOpen}
        onClose={() => setIsChapterDrawerOpen(false)}
        chapters={activeChapters}
        currentPage={currentPage}
        onSelectChapter={(pageIdx) => jumpTo(pageIdx, 0)}
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
