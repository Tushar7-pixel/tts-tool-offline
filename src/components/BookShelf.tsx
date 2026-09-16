// src/components/BookShelf.tsx
import React, { useState, useMemo, useRef } from "react";
import type { BookDoc } from "../utils/db";
import { FindBookModal } from "./FindBookModal";

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
  const [isFindModalOpen, setIsFindModalOpen] = useState(false);

  const filteredBooks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return books.filter((b) =>
      cleanBookTitle(b.title).toLowerCase().includes(q) ||
      b.title.toLowerCase().includes(q)
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
  function cleanBookTitle(rawTitle: string): string {
    return rawTitle
      // Strip leading variations: com, _com_, OceanofPDF, _OceanofPDF.com_, etc.
      .replace(/^([_.\s-]*oceanofpdf(\.com)?|[_.\s-]*com)[_.\s-]+/i, '')
      // Strip trailing export timestamps like "260305 203703" or "2..."
      .replace(/\s+\d{6}(\s+\d{6})?.*$/i, '')
      // Replace underscores and hyphens with clean spaces
      .replace(/[_-]+/g, ' ')
      .trim() || rawTitle;
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
                    <th className="pb-2 font-medium w-[68%]">Book</th>
                    <th className="pb-2 text-right font-medium w-[24%]">Progress</th>
                    <th className="pb-2 text-right font-medium w-[8%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--panel-border)]">
                  {paginatedBooks.map((b) => {
                    const isSelected = b.id === activeBookId;
                    const activePageNum = isSelected ? currentPage : b.currentPage;
                    const progressPct = Math.round(
                      ((activePageNum + 1) / b.totalPages) * 100
                    );
                    const formattedTitle = cleanBookTitle(b.title);

                    return (
                      <tr
                        key={b.id}
                        onClick={() => onSelectBook(b)}
                        className={`shelf-row group cursor-pointer transition ${isSelected ? "is-selected" : ""
                          }`}
                      >
                        {/* Cover + Title + Progress Bar */}
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
                                <span className="text-xs select-none opacity-40">📖</span>
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

                        {/* Progress Fraction and Percentage */}
                        <td className="py-2.5 text-right tabular-nums align-middle whitespace-nowrap">
                          <div>
                            {activePageNum + 1}
                            <span className="app-muted font-normal text-[10px]">
                              {" "}
                              / {b.totalPages}
                            </span>
                          </div>
                          <span className="text-[10px] app-muted">{progressPct}%</span>
                        </td>

                        {/* Delete Button */}
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
                  setShelfPage((prev) => Math.min(totalShelfPages - 1, prev + 1))
                }
                className="app-btn px-2 py-1 disabled:opacity-25 cursor-pointer"
              >
                Next ▶
              </button>
            </div>
          )}

          {/* Shelf Bottom Footer */}
          <div className="pt-3 mt-auto">
            <button
              type="button"
              onClick={() => setIsFindModalOpen(true)}
              className="app-btn w-full text-xs font-semibold py-2 px-4 rounded-md flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99] border border-inherit"
            >
              <span>🔍</span>
              <span>Find Book Online</span>
            </button>
          </div>
        </div>
      </div>

      <FindBookModal
        isOpen={isFindModalOpen}
        onClose={() => setIsFindModalOpen(false)}
        theme={theme}
      />
    </>
  );
};