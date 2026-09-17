// src/components/FindBookModal.tsx
import React, { useState } from 'react';
import type { ReaderTheme } from '../utils/readerAppearance';

interface BookResult {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(
          cleanQuery
        )}&limit=15&fields=key,title,author_name,first_publish_year,cover_i`
      );
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data.docs || []);
    } catch {
      setError('Unable to fetch books. Please check your network connection.');
    } finally {
      setLoading(false);
    }
  };

  const openOcean = (book: BookResult) => {
    const author = book.author_name?.[0];
    const target = author ? `${book.title} ${author}` : book.title;
    window.open(
      `https://oceanofpdf.com/?s=${encodeURIComponent(target)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div
      data-theme={theme}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans"
    >
      <div className="app-panel w-full max-w-2xl max-h-[85vh] rounded-xl flex flex-col shadow-2xl overflow-hidden border">
        {/* Header */}
        <div className="app-panel-header px-5 py-3.5 flex items-center justify-between">
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
          className="p-4 border-b border-inherit bg-black/5 flex gap-2"
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
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Results */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {error && (
            <p className="text-xs text-red-400 py-4 text-center">{error}</p>
          )}

          {!loading && results.length === 0 && !error && (
            <div className="py-12 text-center app-muted text-xs space-y-1">
              <p>Type a book name above to search covers & editions.</p>
              <p className="text-[11px] opacity-75">
                Results open direct search queries on OceanofPDF.
              </p>
            </div>
          )}

          {results.map((book) => {
            const author = book.author_name?.[0];
            const coverUrl = book.cover_i
              ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
              : null;

            return (
              <div
                key={book.key}
                className="app-control flex gap-3.5 p-3 rounded-lg border border-inherit shadow-sm transition items-center"
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
                  <h3 className="text-xs font-bold truncate" title={book.title}>
                    {book.title}
                  </h3>
                  <p className="text-[11px] app-muted mt-0.5 truncate">
                    {author || 'Unknown Author'}
                    {book.first_publish_year && (
                      <span className="opacity-60 ml-1.5 font-mono">
                        ({book.first_publish_year})
                      </span>
                    )}
                  </p>
                </div>

                {/* OceanofPDF Link */}
                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => openOcean(book)}
                    className="app-btn app-accent text-[11px] font-bold py-1.5 px-3 rounded flex items-center gap-1 cursor-pointer transition active:scale-[0.98]"
                  >
                    <span>OceanofPDF</span>
                    <span className="text-[10px] shrink-0">↗</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};