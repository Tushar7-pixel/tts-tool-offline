// src/App.tsx
import React, { useState, useEffect, useRef } from "react";
import { extractPdfPages } from "./utils/pdf";
import { isVoiceInstalled, downloadVoice } from "./utils/tts";
import { saveBook, getAllBooks, getBook, type BookDoc } from "./utils/db";
import { useReader } from "./hooks/useReader";

export default function App() {
  const [books, setBooks] = useState<BookDoc[]>([]);
  const [activeBook, setActiveBook] = useState<BookDoc | null>(null);
  const [voiceReady, setVoiceReady] = useState(false);
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const [gotoInput, setGotoInput] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);

  const loadBooks = async () => {
    const list = await getAllBooks();
    setBooks(list.sort((a, b) => b.updatedAt - a.updatedAt));
  };

  useEffect(() => {
    isVoiceInstalled().then(setVoiceReady);
    loadBooks();
  }, []);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const id = `${file.name}_${file.size}`;
    const cached = await getBook(id);

    if (cached) {
      setActiveBook(cached);
      return;
    }

    const pages = await extractPdfPages(file);
    const newBook: BookDoc = {
      id,
      title: file.name.replace(/\.pdf$/i, ""),
      pages,
      totalPages: pages.length,
      currentPage: 0,
      currentLine: 0,
      updatedAt: Date.now(),
    };

    await saveBook(newBook);
    await loadBooks();
    setActiveBook(newBook);
  };

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

  const displayedLines = activeBook?.pages[currentPage] || [];

  return (
    <div className="min-h-screen bg-[#0e0f12] text-[#d4d4d8] flex flex-col font-mono selection:bg-emerald-950 selection:text-emerald-300">
      {/* Top Navbar Section */}
      <header className="sticky top-0 z-30 bg-[#15171c] border-b border-[#2a2d35] px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* File Upload Button + Active Title */}
          <div className="flex items-center gap-3 min-w-0">
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#242731] hover:bg-[#2e323e] active:scale-95 border border-[#3c4150] text-zinc-100 text-xs font-semibold px-3.5 py-2 rounded-md transition flex items-center gap-2 cursor-pointer shrink-0 shadow-sm"
            >
              <span>📁</span> Choose PDF
            </button>
            <span className="text-xs text-zinc-300 font-medium truncate block max-w-[180px] sm:max-w-xs md:max-w-sm">
              {activeBook?.title || "No file selected"}
            </span>
          </div>

          {/* Center: Pagination controls
          {activeBook && (
            <div className="flex items-center gap-2 bg-[#1b1e24] border border-[#2e323e] px-2.5 py-1.5 rounded-md">
              <button
                disabled={currentPage === 0}
                onClick={() => jumpTo(Math.max(0, currentPage - 1), 0)}
                className="px-2 py-0.5 text-xs text-zinc-300 hover:text-white disabled:opacity-20 cursor-pointer"
              >
                ◀ Prev
              </button>
              <span className="text-xs text-emerald-400 font-bold px-1 tabular-nums">
                Page {currentPage + 1} / {activeBook.totalPages}
              </span>
              <button
                disabled={currentPage >= activeBook.totalPages - 1}
                onClick={() =>
                  jumpTo(
                    Math.min(activeBook.totalPages - 1, currentPage + 1),
                    0,
                  )
                }
                className="px-2 py-0.5 text-xs text-zinc-300 hover:text-white disabled:opacity-20 cursor-pointer"
              >
                Next ▶
              </button>
            </div>
          )} */}
          {/* Center: Pagination & Go-To Controls */}
          {activeBook && (
            <form
              onSubmit={handlePageJump}
              className="flex items-center gap-1.5 bg-[#1b1e24] border border-[#2e323e] px-2 py-1 rounded-md"
            >
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => jumpTo(Math.max(0, currentPage - 1), 0)}
                className="px-2 py-0.5 text-xs text-zinc-300 hover:text-white disabled:opacity-20 cursor-pointer"
              >
                ◀ Prev
              </button>

              <div className="flex items-center gap-1 px-1">
                <span className="text-zinc-500 text-xs select-none">Pg</span>
                <input
                  type="number"
                  min={1}
                  max={activeBook.totalPages}
                  value={gotoInput}
                  onChange={(e) => setGotoInput(e.target.value)}
                  onBlur={handlePageJump}
                  className="w-12 bg-[#121316] border border-[#353945] rounded text-center text-xs text-emerald-400 font-bold focus:outline-none focus:border-emerald-500 py-0.5 font-mono"
                />
                <span className="text-xs text-zinc-500 font-normal">
                  / {activeBook.totalPages}
                </span>
              </div>

              <button
                type="submit"
                className="bg-[#242731] hover:bg-[#2e323e] border border-[#3c4150] text-zinc-200 text-[11px] font-semibold px-2 py-0.5 rounded cursor-pointer transition"
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
                className="px-2 py-0.5 text-xs text-zinc-300 hover:text-white disabled:opacity-20 cursor-pointer"
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
                className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs px-3 py-1.5 rounded-md hover:bg-amber-500/20 transition cursor-pointer"
              >
                {downloadPct !== null
                  ? `Loading (${downloadPct}%)`
                  : "Load Voice (63MB)"}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] bg-[#10261b] text-emerald-400 px-2.5 py-1 rounded-md border border-[#1b4e33]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                hfc_male
              </span>
            )}

            <button
              onClick={togglePlay}
              disabled={!activeBook || !voiceReady}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
                isPlaying
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-25"
              }`}
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
          </div>
          <div className="flex items-center gap-2 bg-[#1b1e24] border border-[#2e323e] px-2.5 py-1.5 rounded-md">
            <span className="text-[11px] text-zinc-400 font-mono select-none">
              Speed
            </span>
            <input
              type="range"
              min="0.5"
              max="2.0"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-16 md:w-20 accent-emerald-500 cursor-pointer bg-zinc-700 h-1 rounded"
            />
            <span className="text-xs text-emerald-400 font-mono font-bold w-9 text-right tabular-nums select-none">
              {speed.toFixed(1)}×
            </span>
          </div>
        </div>
      </header>

      {/* Two-Column App Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PDF Reading Area with Explicit Border Outline */}
        <main className="lg:col-span-8 bg-[#13151a] border border-[#2b2e38] rounded-lg flex flex-col shadow-xl overflow-hidden">
          {/* Header inside the text reader container */}
          <div className="bg-[#181a20] border-b border-[#2b2e38] px-5 py-3 flex items-center justify-between text-xs text-zinc-400">
            <span>
              {activeBook
                ? `Page ${currentPage + 1} of ${activeBook.totalPages}`
                : "Document View"}
            </span>
            <span>{displayedLines.length} Sentences</span>
          </div>

          <div className="p-6 md:p-8 space-y-3 flex-1 overflow-y-auto max-h-[75vh]">
            {activeBook ? (
              displayedLines.map((line, idx) => {
                const isCurrent = idx === currentLine;
                return (
                  <div
                    key={idx}
                    ref={isCurrent ? activeLineRef : null}
                    onClick={() => jumpTo(currentPage, idx)}
                    className={`flex items-start gap-4 p-3 rounded-md transition cursor-pointer border ${
                      isCurrent
                        ? "bg-[#10261b] border-emerald-500/60 text-emerald-200 shadow-md"
                        : "border-transparent hover:border-[#2b2e38] hover:bg-[#181a22] text-zinc-400"
                    }`}
                  >
                    <span className="text-[11px] font-mono text-zinc-600 select-none pt-1 shrink-0 w-6 text-right">
                      {idx + 1}
                    </span>
                    <p className="text-[14px] leading-relaxed font-sans text-left flex-1 select-text">
                      {line}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-zinc-500 text-sm space-y-2">
                <span className="text-2xl">📄</span>
                <p>No active document. Choose a PDF or select a saved book.</p>
              </div>
            )}
          </div>
        </main>

        {/* Saved Books / Shelf Section with Border Frame */}
        <aside className="lg:col-span-4 flex flex-col">
          <div className="bg-[#13151a] border border-[#2b2e38] rounded-lg shadow-xl overflow-hidden flex flex-col">
            <div className="bg-[#181a20] border-b border-[#2b2e38] px-4 py-3 flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-wider font-bold text-zinc-300">
                Book Shelf
              </h2>
              <span className="text-[11px] bg-[#242731] border border-[#353945] text-zinc-400 px-2 py-0.5 rounded">
                {books.length} Saved
              </span>
            </div>

            <div className="p-4">
              {books.length === 0 ? (
                <p className="text-xs text-zinc-500 py-8 text-center">
                  No cached documents found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="text-zinc-500 border-b border-[#242731]">
                        <th className="pb-2 font-medium">Title</th>
                        <th className="pb-2 text-right font-medium">
                          Progress
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2129]">
                      {books.map((b) => {
                        const isSelected = b.id === activeBook?.id;
                        const activePage = isSelected
                          ? currentPage
                          : b.currentPage;
                        const progressPct = Math.round(
                          ((activePage + 1) / b.totalPages) * 100,
                        );

                        return (
                          <tr
                            key={b.id}
                            onClick={() => {
                              setActiveBook(b);
                              loadBooks();
                            }}
                            className={`cursor-pointer transition ${
                              isSelected
                                ? "bg-[#12241b] text-emerald-300"
                                : "hover:bg-[#181a22] text-zinc-400"
                            }`}
                          >
                            <td className="py-3 pr-3">
                              <div className="truncate max-w-[150px] font-medium text-zinc-300">
                                {b.title}
                              </div>
                              <div className="w-full bg-[#20232c] h-1.5 rounded mt-2 overflow-hidden border border-[#2b2e38]">
                                <div
                                  className="bg-emerald-500 h-full transition-all duration-300"
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </td>
                            <td className="py-3 text-right tabular-nums align-top">
                              <div className="text-zinc-300">
                                {activePage + 1}
                                <span className="text-zinc-500 font-normal">
                                  {" "}
                                  / {b.totalPages}
                                </span>
                              </div>
                              <span className="text-[10px] text-zinc-500">
                                {progressPct}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
