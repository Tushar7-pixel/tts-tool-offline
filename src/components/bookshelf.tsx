// src/components/BookShelf.tsx
import React, { useState, useMemo, useRef } from "react";
import type { BookDoc } from "../utils/db";

interface BookShelfProps {
  books: BookDoc[];
  activeBookId: string | null;
  currentPage: number;
  onSelectBook: (book: BookDoc) => void;
  onDeleteBook: (id: string) => void;
  onAddBook: (file: File) => void;
  pageSize?: number;
}

export const BookShelf: React.FC<BookShelfProps> = ({
  books,
  activeBookId,
  currentPage,
  onSelectBook,
  onDeleteBook,
  onAddBook,
  pageSize = 5,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [shelfPage, setShelfPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredBooks = useMemo(() => {
    return books.filter((b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase().trim()),
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
      e.target.value = ""; // Reset input so same file can be selected again
    }
  };

  return (
    <div className="bg-[#13151a] border border-[#2b2e38] rounded-lg shadow-xl overflow-hidden flex flex-col font-mono">
      {/* Shelf Header with + Add Book Button */}
      <div className="bg-[#181a20] border-b border-[#2b2e38] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs uppercase tracking-wider font-bold text-zinc-300">
            Book Shelf
          </h2>
          <span className="text-[11px] bg-[#242731] border border-[#353945] text-zinc-400 px-2 py-0.5 rounded">
            {books.length}
          </span>
        </div>

        {/* Small Add Book Action */}
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
            className="bg-[#242731] hover:bg-[#2e323e] border border-[#3c4150] hover:border-emerald-500/50 text-emerald-400 hover:text-emerald-300 text-[11px] font-semibold px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer"
          >
            <span>+</span> Add Book
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Live Search Input */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search books..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShelfPage(0);
            }}
            className="w-full bg-[#181a22] border border-[#2e323e] rounded px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1.5 text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Shelf Books Table */}
        {filteredBooks.length === 0 ? (
          <p className="text-xs text-zinc-500 py-6 text-center">
            {books.length === 0
              ? "No books uploaded yet."
              : "No matching books found."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-zinc-500 border-b border-[#242731]">
                  <th className="pb-2 font-medium">Title</th>
                  <th className="pb-2 text-right font-medium">Progress</th>
                  <th className="pb-2 text-right font-medium w-6"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2129]">
                {paginatedBooks.map((b) => {
                  const isSelected = b.id === activeBookId;
                  const activePageNum = isSelected
                    ? currentPage
                    : b.currentPage;
                  const progressPct = Math.round(
                    ((activePageNum + 1) / b.totalPages) * 100,
                  );

                  return (
                    <tr
                      key={b.id}
                      onClick={() => onSelectBook(b)}
                      className={`group cursor-pointer transition ${
                        isSelected
                          ? "bg-[#12241b] text-emerald-300"
                          : "hover:bg-[#181a22] text-zinc-400"
                      }`}
                    >
                      <td className="py-2.5 pr-2">
                        <div className="truncate max-w-[130px] font-medium text-zinc-300 group-hover:text-white">
                          {b.title}
                        </div>
                        <div className="w-full bg-[#20232c] h-1.5 rounded mt-1.5 overflow-hidden border border-[#2b2e38]">
                          <div
                            className="bg-emerald-500 h-full transition-all duration-300"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-2.5 text-right tabular-nums align-top">
                        <div className="text-zinc-300">
                          {activePageNum + 1}
                          <span className="text-zinc-500 font-normal">
                            {" "}
                            / {b.totalPages}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500">
                          {progressPct}%
                        </span>
                      </td>
                      <td className="py-2.5 pl-2 text-right align-middle">
                        <button
                          title="Delete PDF"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteBook(b.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition cursor-pointer"
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

        {/* Shelf Pagination Controls */}
        {totalShelfPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-[#242731] text-xs">
            <button
              disabled={currentShelfPage === 0}
              onClick={() => setShelfPage((prev) => Math.max(0, prev - 1))}
              className="px-2 py-1 bg-[#181a22] border border-[#2b2e38] rounded text-zinc-300 hover:bg-[#22252e] disabled:opacity-25 cursor-pointer"
            >
              ◀ Prev
            </button>
            <span className="text-zinc-500 text-[11px]">
              {currentShelfPage + 1} of {totalShelfPages}
            </span>
            <button
              disabled={currentShelfPage >= totalShelfPages - 1}
              onClick={() =>
                setShelfPage((prev) => Math.min(totalShelfPages - 1, prev + 1))
              }
              className="px-2 py-1 bg-[#181a22] border border-[#2b2e38] rounded text-zinc-300 hover:bg-[#22252e] disabled:opacity-25 cursor-pointer"
            >
              Next ▶
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
