// src/components/FindBookModal.tsx
import React, { useState } from "react";
import type { ReaderTheme } from "../utils/readerAppearance";
import { openBookInPlatform } from "../utils/browser";

interface BookResult {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
}

interface BookDetail {
  key: string;
  title: string;
  authors?: string[];
  coverId?: number;
  year?: number;
  description?: string;
}

interface FindBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ReaderTheme;
}

export const FindBookModal: React.FC<FindBookModalProps> = ({
  isOpen,
  onClose,
  theme,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail / Preview States
  const [activeDetail, setActiveDetail] = useState<BookDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const handleOpenDetail = async (book: BookResult) => {
    const detail: BookDetail = {
      key: book.key,
      title: book.title,
      authors: book.author_name,
      coverId: book.cover_i,
      year: book.first_publish_year,
      description: undefined,
    };

    setActiveDetail(detail);
    setDetailLoading(true);

    try {
      const res = await fetch(`https://openlibrary.org${book.key}.json`);
      if (res.ok) {
        const data = await res.json();
        let fetchedDesc: string | undefined;

        if (typeof data.description === "string") {
          fetchedDesc = data.description;
        } else if (
          data.description &&
          typeof data.description.value === "string"
        ) {
          fetchedDesc = data.description.value;
        }

        if (fetchedDesc) {
          setActiveDetail((prev) =>
            prev ? { ...prev, description: fetchedDesc } : null,
          );
        }
      }
    } catch (err) {
      console.warn("Could not fetch book summary:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setActiveDetail(null);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(
          cleanQuery,
        )}&limit=15&fields=key,title,author_name,first_publish_year,cover_i`,
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.docs || []);
    } catch {
      setError("Unable to fetch books. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-theme={theme}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans"
    >
      <div className="app-panel w-full max-w-2xl max-h-[85vh] rounded-xl flex flex-col shadow-2xl overflow-hidden border">
        {/* Header */}
        <div className="app-panel-header px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span>🔍</span>
            <h2 className="text-xs uppercase font-bold tracking-wider">
              Find Book Online
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-muted hover:opacity-100 text-sm px-2 py-0.5 rounded transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Search Input */}
        <form
          onSubmit={handleSearch}
          className="p-4 border-b border-inherit bg-black/5 flex gap-2 shrink-0"
        >
          <input
            type="text"
            placeholder="Search by title or author..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="app-input flex-1 rounded-md px-3 py-2 text-xs focus:outline-none transition"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading}
            className="app-btn text-xs font-semibold px-4 py-2 rounded-md transition cursor-pointer shrink-0 disabled:opacity-40"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {/* Results Body / Preview View */}
        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <p className="text-xs text-red-400 py-4 text-center">{error}</p>
          )}

          {activeDetail ? (
            /* Book Detail & Synopsis View */
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setActiveDetail(null)}
                className="app-btn text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>←</span>
                <span>Back to Search Results</span>
              </button>

              <div className="flex flex-col sm:flex-row gap-4 items-start pt-1">
                <div className="w-28 sm:w-36 h-40 sm:h-52 bg-black/10 rounded-lg border border-inherit flex items-center justify-center shrink-0 overflow-hidden shadow-md">
                  {activeDetail.coverId ? (
                    <img
                      src={`https://covers.openlibrary.org/b/id/${activeDetail.coverId}-L.jpg`}
                      alt={activeDetail.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-xs app-muted">No Cover</span>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-2.5">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold">
                      {activeDetail.title}
                    </h3>
                    <p className="text-xs app-muted">
                      By {activeDetail.authors?.join(", ") || "Unknown Author"}
                      {activeDetail.year && (
                        <span> • First published {activeDetail.year}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        openBookInPlatform(
                          "ocean",
                          activeDetail.title,
                          activeDetail.authors?.[0],
                        )
                      }
                      className="app-btn app-accent text-xs font-bold py-1.5 px-3 rounded flex items-center gap-1 transition cursor-pointer"
                    >
                      <span>OceanofPDF</span>
                      <span className="text-[10px]">↗</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openBookInPlatform(
                          "archive",
                          activeDetail.title,
                          activeDetail.authors?.[0],
                        )
                      }
                      className="app-btn text-xs font-medium py-1.5 px-3 rounded flex items-center gap-1 border border-inherit transition cursor-pointer"
                    >
                      <span>Internet Archive</span>
                      <span className="text-[10px] opacity-75">↗</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        openBookInPlatform(
                          "openlibrary",
                          activeDetail.title,
                          activeDetail.authors?.[0],
                          activeDetail.key,
                        )
                      }
                      className="app-btn text-xs font-medium py-1.5 px-3 rounded flex items-center gap-1 border border-inherit transition cursor-pointer"
                    >
                      <span>Open Library</span>
                      <span className="text-[10px] opacity-75">↗</span>
                    </button>
                  </div>

                  <div className="pt-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider app-muted mb-1">
                      Summary
                    </h4>
                    <div className="text-xs leading-relaxed max-h-56 overflow-y-auto pr-1 whitespace-pre-line opacity-90">
                      {detailLoading ? (
                        <div className="flex items-center gap-2 py-3 text-amber-500">
                          <div
                            className="w-3.5 h-3.5 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin"
                            role="status"
                          />
                          <span className="text-xs">
                            Loading summary from Open Library...
                          </span>
                        </div>
                      ) : activeDetail.description ? (
                        activeDetail.description
                      ) : (
                        <span className="app-muted italic">
                          No synopsis is available for this title in Open
                          Library's public records.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Search Results List */
            <>
              {!loading && results.length === 0 && !error && (
                <div className="py-12 text-center app-muted text-xs space-y-1">
                  <p>Type a book name above to search covers & editions.</p>
                  <p className="text-[11px] opacity-75">
                    Click any title to view its synopsis and download sources.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {results.map((book) => {
                  const author = book.author_name?.[0];
                  const coverUrl = book.cover_i
                    ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                    : null;

                  return (
                    <div
                      key={book.key}
                      onClick={() => handleOpenDetail(book)}
                      className="app-control flex gap-3.5 p-3 rounded-lg border border-inherit shadow-sm transition items-center cursor-pointer hover:border-amber-400/50"
                    >
                      {/* Book Cover */}
                      <div className="w-14 h-20 bg-black/10 rounded border border-inherit flex items-center justify-center shrink-0 overflow-hidden">
                        {coverUrl ? (
                          <img
                            src={coverUrl}
                            alt={book.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-[10px] app-muted text-center px-1">
                            No cover
                          </span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <h3
                          className="text-xs font-bold truncate"
                          title={book.title}
                        >
                          {book.title}
                        </h3>
                        <p className="text-[11px] app-muted mt-0.5 truncate">
                          {author || "Unknown Author"}
                          {book.first_publish_year && (
                            <span className="opacity-60 ml-1.5 font-mono">
                              ({book.first_publish_year})
                            </span>
                          )}
                        </p>
                        <span className="text-[10px] text-amber-500 font-medium inline-block mt-1">
                          View Details & Links →
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
