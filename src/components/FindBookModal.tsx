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

const SUPPORTED_LANGUAGES = [
  { code: 'eng', label: 'English' },
  { code: '', label: 'All Languages' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fre', label: 'French' },
  { code: 'ger', label: 'German' },
  { code: 'hin', label: 'Hindi' },
  { code: 'ita', label: 'Italian' },
];

export const FindBookModal: React.FC<FindBookModalProps> = ({ isOpen, onClose, theme }) => {
  const [query, setQuery] = useState('');
  const [lang, setLang] = useState('eng'); // Default to English
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

    // Append language filter if selected (e.g. "Normal People language:eng")
    const searchString = lang ? `${cleanQuery} language:${lang}` : cleanQuery;

    try {
      const res = await fetch(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(
          searchString
        )}&limit=12&fields=key,title,author_name,first_publish_year,cover_i`
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

  const openOceanOfPdf = (title: string, author?: string) => {
    const searchTerm = author ? `${title} ${author}` : title;
    const url = `https://oceanofpdf.com/?s=${encodeURIComponent(searchTerm)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      data-theme={theme}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans"
    >
      <div className="app-panel w-full max-w-2xl max-h-[85vh] rounded-xl flex flex-col shadow-2xl overflow-hidden border">
        
        {/* Modal Header */}
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

        {/* Search & Language Bar */}
        <form onSubmit={handleSearch} className="p-4 border-b border-inherit bg-black/5 flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Search by title or author..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="app-input flex-1 rounded-md px-3 py-2 text-xs focus:outline-none transition"
              autoFocus
            />
            {/* Language Dropdown */}
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="app-input rounded-md px-2 py-2 text-xs cursor-pointer focus:outline-none"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-[#14151a] text-zinc-200">
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="app-btn text-xs font-semibold px-4 py-2 rounded-md transition cursor-pointer shrink-0 disabled:opacity-40"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Results Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {error && <p className="text-xs text-red-400 py-4 text-center">{error}</p>}

          {!loading && results.length === 0 && !error && (
            <div className="py-12 text-center app-muted text-xs space-y-1">
              <p>Type a book name above to search covers & metadata.</p>
              <p className="text-[11px] opacity-75">
                Filtered to <strong>{SUPPORTED_LANGUAGES.find(l => l.code === lang)?.label}</strong> editions.
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
                onClick={() => openOceanOfPdf(book.title, author)}
                className="app-control group flex gap-4 p-3 rounded-lg cursor-pointer transition shadow-sm border border-transparent hover:border-inherit"
              >
                {/* Book Cover */}
                <div className="w-14 h-20 bg-black/20 rounded border border-inherit flex items-center justify-center shrink-0 overflow-hidden">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-[10px] app-muted text-center px-1">No cover</span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                  <div>
                    <h3 className="text-xs font-semibold truncate group-hover:underline">
                      {book.title}
                    </h3>
                    <p className="text-[11px] app-muted mt-0.5 truncate">
                      {author || 'Unknown Author'}
                      {book.first_publish_year && (
                        <span className="opacity-60 ml-1.5">({book.first_publish_year})</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] app-muted">
                      OceanofPDF ↗
                    </span>
                    <span className="text-[11px] app-accent font-bold group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      Download PDF ↗
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};