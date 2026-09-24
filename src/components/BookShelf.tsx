// src/components/BookShelf.tsx
import React, { useState, useMemo, useRef } from "react";
import type { BookDoc } from "../utils/db";
import { exportLibrary, importLibrary } from "../utils/db";
import { FindBookModal } from "./FindBookModal";
import { ExploreBooksModal } from "./ExploreBooksModal";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

interface BookShelfProps {
  books: BookDoc[];
  activeBookId: string | null;
  currentPage: number;
  onSelectBook: (book: BookDoc) => void;
  onDeleteBook: (id: string) => void;
  onAddBook: (file: File) => void;
  pageSize?: number;
  theme: "dark" | "ereader";
}

export function cleanBookTitle(rawTitle: string): string {
  return (
    rawTitle
      .replace(/^([_.\s-]*oceanofpdf(\.com)?|[_.\s-]*com)[_.\s-]+/i, "")
      .replace(/\s+\d{6}(\s+\d{6})?.*$/i, "")
      .replace(/[_-]+/g, " ")
      .trim() || rawTitle
  );
}

export const BookShelf: React.FC<BookShelfProps> = ({
  books,
  activeBookId,
  currentPage,
  onSelectBook,
  onDeleteBook,
  onAddBook,
  pageSize = 5,
  theme,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [shelfPage, setShelfPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const isOnline = useOnlineStatus();

  const [isFindModalOpen, setIsFindModalOpen] = useState(false);
  const [isExploreModalOpen, setIsExploreModalOpen] = useState(false);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return books.filter(
      (b) =>
        cleanBookTitle(b.title).toLowerCase().includes(q) ||
        b.title.toLowerCase().includes(q),
    );
  }, [books, searchQuery]);

  const totalShelfPages = Math.ceil(filteredBooks.length / pageSize) || 1;
  const currentShelfPage = Math.min(shelfPage, totalShelfPages - 1);

  const paginatedBooks = useMemo(() => {
    const start = currentShelfPage * pageSize;
    return filteredBooks.slice(start, start + pageSize);
  }, [filteredBooks, currentShelfPage, pageSize]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddBook(file);
      e.target.value = "";
    }
  };

  const handleExportLibrary = async () => {
    try {
      const jsonStr = await exportLibrary();
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `EchoRead_Backup_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export library:", err);
      alert("Failed to export library.");
    }
  };

  const handleImportLibrary = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const count = await importLibrary(text);
      alert(`Successfully imported ${count} books! Please refresh the page.`);
      window.location.reload();
    } catch (err) {
      console.error("Import failed:", err);
      alert(
        "Failed to import backup file. Ensure it is a valid EchoRead JSON export.",
      );
    } finally {
      e.target.value = "";
    }
  };

  function resolveChapterTitle(
    book: BookDoc,
    activePage: number,
  ): string | null {
    if (book.currentChapter) return book.currentChapter;
    if (!book.chapters || book.chapters.length === 0) return null;

    const matching = [...book.chapters]
      .sort((a, b) => a.pageIndex - b.pageIndex)
      .filter((ch) => ch.pageIndex <= activePage + 1)
      .pop();

    return matching?.title ?? null;
  }

  return (
    <>
      <div className="app-panel rounded-lg overflow-hidden flex flex-col">
        <div className="app-panel-header px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs uppercase tracking-wider font-bold">
              Book Shelf
            </h2>
            <span className="shelf-count text-[11px] px-2 py-0.5 rounded">
              {books.length}
            </span>
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              className="hidden"
              onChange={handleFileInputChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="app-btn shelf-add text-[11px] font-semibold px-2.5 py-1 transition flex items-center gap-1 cursor-pointer"
            >
              <span>+</span> Add Book
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3 flex-1 flex flex-col">
          <div className="relative">
            <input
              type="text"
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShelfPage(0);
              }}
              className="app-input w-full rounded px-3 py-1.5 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1.5 app-muted text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {filteredBooks.length === 0 ? (
            <p className="text-xs app-muted py-6 text-center">
              {books.length === 0
                ? "No books uploaded yet."
                : "No matching books found."}
            </p>
          ) : (
            <div className="w-full">
              <table className="w-full text-left text-xs border-collapse table-fixed">
                <thead>
                  <tr className="app-muted border-b border-[var(--panel-border)]">
                    <th className="pb-2 font-medium w-[58%]">Book</th>
                    <th className="pb-2 text-right font-medium w-[34%]">
                      Progress
                    </th>
                    <th className="pb-2 text-right font-medium w-[8%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--panel-border)]">
                  {paginatedBooks.map((b) => {
                    const isSelected = b.id === activeBookId;
                    const activePageNum = isSelected
                      ? currentPage
                      : b.currentPage;
                    const progressPct = Math.round(
                      ((activePageNum + 1) / b.totalPages) * 100,
                    );
                    const formattedTitle = cleanBookTitle(b.title);
                    const chapterName = resolveChapterTitle(b, activePageNum);

                    return (
                      <tr
                        key={b.id}
                        onClick={() => onSelectBook(b)}
                        className={`shelf-row group cursor-pointer transition ${
                          isSelected ? "is-selected" : ""
                        }`}
                      >
                        <td className="py-2.5 pr-2 truncate">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-12 rounded bg-black/10 border border-inherit flex items-center justify-center shrink-0 overflow-hidden">
                              {b.coverUrl ? (
                                <img
                                  src={b.coverUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-xs select-none opacity-40">
                                  📖
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div
                                className="shelf-title font-medium truncate text-xs"
                                title={formattedTitle}
                              >
                                {formattedTitle}
                              </div>
                              <div className="shelf-progress w-full h-1.5 rounded mt-1.5 overflow-hidden">
                                <div
                                  className="shelf-progress-fill h-full transition-all duration-300"
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 text-right align-middle whitespace-nowrap">
                          {chapterName && (
                            <div
                              className="text-[11px] font-medium text-[var(--accent)] truncate max-w-[110px] ml-auto"
                              title={chapterName}
                            >
                              {chapterName}
                            </div>
                          )}
                          <div className="tabular-nums">
                            {activePageNum + 1}
                            <span className="app-muted font-normal text-[10px]">
                              {" "}
                              / {b.totalPages}
                            </span>
                          </div>
                          <span className="text-[10px] app-muted tabular-nums">
                            {progressPct}%
                          </span>
                        </td>

                        <td className="py-2.5 text-right align-middle">
                          <button
                            title="Delete PDF"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteBook(b.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 app-muted hover:text-rose-400 p-1 rounded transition cursor-pointer"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalShelfPages > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-[var(--panel-border)] text-xs">
              <button
                disabled={currentShelfPage === 0}
                onClick={() => setShelfPage((prev) => Math.max(0, prev - 1))}
                className="app-btn px-2 py-1 disabled:opacity-25 cursor-pointer"
              >
                ◀ Prev
              </button>
              <span className="app-muted text-[11px]">
                {currentShelfPage + 1} of {totalShelfPages}
              </span>
              <button
                disabled={currentShelfPage >= totalShelfPages - 1}
                onClick={() =>
                  setShelfPage((prev) =>
                    Math.min(totalShelfPages - 1, prev + 1),
                  )
                }
                className="app-btn px-2 py-1 disabled:opacity-25 cursor-pointer"
              >
                Next ▶
              </button>
            </div>
          )}

          <div className="mt-3 flex flex-col gap-1.5 w-full">
            <div className="flex gap-2 w-full">
              <button
                type="button"
                disabled={!isOnline}
                onClick={() => setIsFindModalOpen(true)}
                title={
                  isOnline
                    ? "Search books across repositories"
                    : "Internet connection required"
                }
                className="app-btn text-xs font-medium py-2 px-3 rounded-lg flex-1 flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>🔍</span>
                <span>Find Book Online</span>
              </button>

              <button
                type="button"
                disabled={!isOnline}
                onClick={() => setIsExploreModalOpen(true)}
                title={
                  isOnline
                    ? "Browse genres and author catalogs"
                    : "Internet connection required"
                }
                className="app-btn app-accent text-xs font-bold py-2 px-3 rounded-lg flex-1 flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>🧭</span>
                <span>Explore Books</span>
              </button>
            </div>

            {/* DATA MANAGEMENT ACTIONS */}
            <div className="flex gap-2 w-full mt-1 border-t border-[var(--panel-border)] pt-2.5">
              <button
                type="button"
                onClick={handleExportLibrary}
                className="app-btn text-[11px] font-medium py-1.5 px-2 rounded flex-1 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>💾</span> Backup Library
              </button>

              <input
                type="file"
                ref={importInputRef}
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportLibrary}
              />
              <button
                type="button"
                onClick={() => importInputRef.current?.click()}
                className="app-btn text-[11px] font-medium py-1.5 px-2 rounded flex-1 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>📂</span> Restore Data
              </button>
            </div>

            {!isOnline && (
              <p className="text-[10px] app-muted text-center tracking-tight select-none mt-1">
                ⚡ Offline mode: online catalog and discovery are disabled.
              </p>
            )}
          </div>
        </div>
      </div>

      <FindBookModal
        isOpen={isFindModalOpen && isOnline}
        onClose={() => setIsFindModalOpen(false)}
        theme={theme}
      />
      <ExploreBooksModal
        isOpen={isExploreModalOpen && isOnline}
        onClose={() => setIsExploreModalOpen(false)}
        theme={theme}
      />
    </>
  );
};
