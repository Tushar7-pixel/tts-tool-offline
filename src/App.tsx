// src/App.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { extractPdfPages, mapDisplayToSentences } from "./utils/pdf";
import { isVoiceInstalled, downloadVoice } from "./utils/tts";
import { saveBook, getAllBooks, type BookDoc, deleteBook } from "./utils/db";
import { useReader } from "./hooks/useReader";
import { BookShelf } from "./components/bookshelf";
import { AppearanceMenu } from "./components/appearanceMenu";
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

export default function App() {
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
  const activeLineRef = useRef<HTMLDivElement | null>(null);

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

  // Keep the input value in sync when the reader turns the page
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
      // Revert to current page if invalid input is entered
      setGotoInput(String(currentPage + 1));
    }
  };
  const handleInstallVoice = async () => {
    setDownloadPct(0);
    await downloadVoice(setDownloadPct);
    setVoiceReady(true);
    setDownloadPct(null);
  };

  const {
    currentPage,
    currentLine,
    queuedLines,
    processedLines,
    isPlaying,
    speed,
    setSpeed,
    togglePlay,
    jumpTo,
  } = useReader(
    activeBook?.id || null,
    activeBook?.pages || [],
    activeBook?.currentPage || 0,
    activeBook?.currentLine || 0,
  );
  useEffect(() => {
    activeLineRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [currentLine, currentPage]);
  useEffect(() => {
    if (activeBook) {
      setGotoInput(String(currentPage + 1));
    }
  }, [currentPage, activeBook]);

  const ttsLines = activeBook?.pages[currentPage] || [];
  const displayedLines =
    activeBook?.displayPages?.[currentPage] || ttsLines;
  const { displayToSentence } = useMemo(
    () => mapDisplayToSentences(displayedLines, ttsLines),
    [displayedLines, ttsLines],
  );
  const firstCurrentDisplayIdx = useMemo(
    () =>
      displayedLines.findIndex((_, i) =>
        (displayToSentence[i] || []).includes(currentLine),
      ),
    [displayedLines, displayToSentence, currentLine],
  );

  const handleDisplayLineClick = (displayIdx: number) => {
    const hits = displayToSentence[displayIdx] || [];
    if (hits.length === 0) return;
    const nextOnLine = hits.find((s) => s > currentLine);
    if (hits.includes(currentLine) && nextOnLine !== undefined) {
      jumpTo(currentPage, nextOnLine);
      return;
    }
    jumpTo(currentPage, hits[0]);
  };

  const readerFont = getReaderFont(fontId);

  const handleAddOrUploadBook = async (file: File) => {
    const cleanTitle = file.name.replace(/\.pdf$/i, "");

    // Find any existing book with the exact same title
    const existingBook = books.find(
      (b) => b.title.toLowerCase() === cleanTitle.toLowerCase(),
    );

    if (existingBook) {
      const shouldReplace = window.confirm(
        `"${cleanTitle}" already exists on your shelf.\n\nDo you want to replace it? (Progress will reset to Page 1)`,
      );

      if (!shouldReplace) return;

      // Parse newly provided file and reset reading index to 0
      const extracted = await extractPdfPages(file);
      const replacedBook: BookDoc = {
        ...existingBook,
        pages: extracted.pages,
        displayPages: extracted.displayPages,
        totalPages: extracted.pages.length,
        currentPage: 0,
        currentLine: 0,
        updatedAt: Date.now(),
      };

      await saveBook(replacedBook);
      await loadBooks();
      setActiveBook(replacedBook);
      return;
    }

    // Add brand new book
    const extracted = await extractPdfPages(file);
    const newBook: BookDoc = {
      id: `${cleanTitle}_${Date.now()}`,
      title: cleanTitle,
      pages: extracted.pages,
      displayPages: extracted.displayPages,
      totalPages: extracted.pages.length,
      currentPage: 0,
      currentLine: 0,
      updatedAt: Date.now(),
    };

    await saveBook(newBook);
    await loadBooks();
    setActiveBook(newBook);
  };
  return (
    <div
      className="app-shell min-h-screen flex flex-col font-sans"
      data-theme={theme}
    >
      {/* Top Navbar Section */}
      <header
        className={`app-header sticky top-0 z-30 px-4 py-3 ${
          navbarHidden ? "hidden" : ""
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* File Upload Button + Active Title */}
          <div className="flex items-center gap-3 min-w-0">
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
              className="app-btn active:scale-95 text-xs font-semibold px-3.5 py-2 transition flex items-center gap-2 cursor-pointer shrink-0"
            >
              <span>📁</span> Choose PDF
            </button>
            <span className="text-xs font-medium truncate block max-w-[180px] sm:max-w-xs md:max-w-sm">
              {activeBook?.title || "No file selected"}
            </span>
          </div>

          {/* Center: Pagination & Go-To Controls */}
          {activeBook && (
            <form
              onSubmit={handlePageJump}
              className="app-control flex items-center gap-1.5 px-2 py-1 rounded-md"
            >
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => jumpTo(Math.max(0, currentPage - 1), 0)}
                className="px-2 py-0.5 text-xs app-muted hover:opacity-80 disabled:opacity-20 cursor-pointer"
              >
                ◀ Prev
              </button>

              <div className="flex items-center gap-1 px-1">
                <span className="app-muted text-xs select-none">Pg</span>
                <input
                  type="number"
                  min={1}
                  max={activeBook.totalPages}
                  value={gotoInput}
                  onChange={(e) => setGotoInput(e.target.value)}
                  onBlur={handlePageJump}
                  className="app-input w-12 rounded text-center text-xs font-bold py-0.5 font-mono"
                />
                <span className="text-xs app-muted font-normal">
                  / {activeBook.totalPages}
                </span>
              </div>

              <button
                type="submit"
                className="app-btn text-[11px] font-semibold px-2 py-0.5 cursor-pointer"
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
                className="px-2 py-0.5 text-xs app-muted hover:opacity-80 disabled:opacity-20 cursor-pointer"
              >
                Next ▶
              </button>
            </form>
          )}

          {/* Right Action Controls */}
          <div className="flex items-center gap-3 shrink-0">
            {!voiceReady ? (
              <button
                onClick={handleInstallVoice}
                disabled={downloadPct !== null}
                className="app-btn text-xs px-3 py-1.5 cursor-pointer"
              >
                {downloadPct !== null
                  ? `Loading (${downloadPct}%)`
                  : "Load Voice (63MB)"}
              </button>
            ) : (
              <span className="app-chip inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                hfc_male
              </span>
            )}

            <button
              onClick={togglePlay}
              disabled={!activeBook || !voiceReady}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                isPlaying ? "app-pause" : "app-play"
              } disabled:opacity-25`}
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
          </div>
          <div className="app-control flex items-center gap-2 px-2.5 py-1.5 rounded-md">
            <span className="text-[11px] app-muted select-none">Speed</span>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-16 md:w-20 accent-current cursor-pointer h-1 rounded"
            />
            <span className="text-xs app-accent font-mono font-bold w-9 text-right tabular-nums select-none">
              {speed.toFixed(1)}×
            </span>
          </div>
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
      </header>

      {navbarHidden && compactChrome && (
        <div className="fixed top-2 right-2 z-40 flex items-center gap-1.5">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!activeBook || !voiceReady}
            className={`px-3 py-1.5 rounded-md text-[11px] font-bold shadow-lg cursor-pointer ${
              isPlaying ? "app-pause" : "app-play"
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
        {/* PDF Reading Area with Explicit Border Outline */}
        <main className="app-panel lg:col-span-8 rounded-lg flex flex-col shadow-xl overflow-hidden">
          {/* Header inside the text reader container */}
          <div className="app-panel-header px-5 py-3 flex items-center justify-between text-xs">
            <span>
              {activeBook
                ? `Page ${currentPage + 1} of ${activeBook.totalPages}`
                : "Document View"}
            </span>
            <div className="flex items-center gap-2">
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
                <span className="app-accent font-mono font-bold w-8 text-center tabular-nums">
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
              <span>{displayedLines.length} lines</span>
            </div>
          </div>

          <div className="px-2 py-4 sm:px-6 md:p-10 flex-1 overflow-y-auto max-h-[75vh]">
            {activeBook ? (
              <div
                className="text-left max-w-3xl"
                style={{
                  fontFamily: readerFont.cssFamily,
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.7,
                }}
              >
                {displayedLines.map((line, idx) => {
                  const sentenceHits = displayToSentence[idx] || [];
                  const isCurrent = sentenceHits.includes(currentLine);
                  const isQueued =
                    !isCurrent &&
                    sentenceHits.some((s) => queuedLines.includes(s));
                  const isProcessed =
                    !isCurrent &&
                    !isQueued &&
                    sentenceHits.some((s) => processedLines.includes(s));
                  const isFirstCurrent = idx === firstCurrentDisplayIdx;
                  const lineState = isCurrent
                    ? "is-current"
                    : isQueued
                      ? "is-queued"
                      : isProcessed
                        ? "is-processed"
                        : "is-pending";

                  return (
                    <div
                      key={idx}
                      ref={isFirstCurrent ? activeLineRef : null}
                      onClick={() => handleDisplayLineClick(idx)}
                      className={`reader-line px-1 sm:px-2 py-0.5 cursor-pointer ${lineState}`}
                    >
                      {line.length > 0 ? (
                        line
                      ) : (
                        <span className="block h-[1em]">&nbsp;</span>
                      )}
                    </div>
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

        {/* Saved Books / Shelf Section with Border Frame */}
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
          />
        </aside>
      </div>
    </div>
  );
}
