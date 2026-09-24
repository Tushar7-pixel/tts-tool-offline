// src/components/ExploreBooksModal.tsx
import React, { useState, useEffect } from "react";
import type { ReaderTheme } from "../utils/readerAppearance";
import { launchExternalUrl } from "../utils/browser";

interface BookWork {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_id?: number;
}

interface ExploreBooksModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ReaderTheme;
}

interface BookDetail {
  key: string;
  title: string;
  authors?: string[];
  coverId?: number;
  year?: number;
  description?: string;
  openLibraryUrl: string;
}

const GENRES = [
  { id: "fantasy", label: "Fantasy", icon: "🧙‍♂️" },
  { id: "romance", label: "Romance", icon: "💖" },
  { id: "science_fiction", label: "Sci-Fi", icon: "🚀" },
  { id: "thriller", label: "Thriller & Mystery", icon: "🔍" },
  { id: "historical_fiction", label: "Historical", icon: "🏛️" },
  { id: "young_adult", label: "Young Adult", icon: "✨" },
  { id: "horror", label: "Horror", icon: "👻" },
  { id: "dystopian", label: "Dystopian", icon: "⚡" },
];

const PRESET_AUTHORS = [
  { id: "colleen_hoover", name: "Colleen Hoover" },
  { id: "rebecca_yarros", name: "Rebecca Yarros" },
  { id: "sarah_j_maas", name: "Sarah J. Maas" },
  { id: "lynn_painter", name: "Lynn Painter" },
  { id: "elsie_silver", name: "Elsie Silver" },
  { id: "tahereh_mafi", name: "Tahereh Mafi" },
  { id: "stephen_king", name: "Stephen King" },
  { id: "brandon_sanderson", name: "Brandon Sanderson" },
];

export const ExploreBooksModal: React.FC<ExploreBooksModalProps> = ({
  isOpen,
  onClose,
  theme,
}) => {
  const [activeTab, setActiveTab] = useState<"genres" | "authors">("genres");
  const [selectedGenre, setSelectedGenre] = useState<string>(GENRES[0].id);
  const [activeAuthor, setActiveAuthor] = useState<string>(
    PRESET_AUTHORS[0].name,
  );
  const [authorInput, setAuthorInput] = useState("");
  const [books, setBooks] = useState<BookWork[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<BookDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // const [openingKey, setOpeningKey] = useState<string | null>(null);

  const handleOpenDetail = async (book: BookWork) => {
    // 1. Immediately create the base detail object with cover, title & author
    const detail: BookDetail = {
      key: book.key,
      title: book.title,
      authors: book.author_name,
      coverId: book.cover_id,
      year: book.first_publish_year,
      openLibraryUrl: `https://openlibrary.org${book.key}`,
      description: undefined,
    };

    // 2. Open the detail view right away and start loading
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

        // 3. Update the description once it arrives
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

  useEffect(() => {
    if (!isOpen) return;

    const fetchBooks = async () => {
      setLoading(true);
      setError(null);
      setBooks([]);

      try {
        let url = "";
        if (activeTab === "genres") {
          url = `https://openlibrary.org/subjects/${encodeURIComponent(
            selectedGenre,
          )}.json?limit=18`;
        } else {
          url = `https://openlibrary.org/search.json?author=${encodeURIComponent(
            activeAuthor,
          )}&limit=18&fields=key,title,author_name,first_publish_year,cover_i`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch books");
        const data = await res.json();

        if (activeTab === "genres") {
          const works = (data.works || []).map((w: any) => ({
            key: w.key,
            title: w.title,
            author_name: w.authors?.map((a: any) => a.name) || [],
            cover_id: w.cover_id,
            first_publish_year: w.first_publish_year,
          }));
          setBooks(works);
        } else {
          const docs = (data.docs || []).map((d: any) => ({
            key: d.key,
            title: d.title,
            author_name: d.author_name || [],
            cover_id: d.cover_i,
            first_publish_year: d.first_publish_year,
          }));
          setBooks(docs);
        }
      } catch {
        setError("Failed to load catalog books. Check your connection.");
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, [isOpen, activeTab, selectedGenre, activeAuthor]);

  if (!isOpen) return null;

  const handleAuthorSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = authorInput.trim();
    if (clean) {
      setActiveDetail(null);
      setActiveAuthor(clean);
    }
  };

  const openOcean = (
    title: string,
    author?: string,
    useAdFreeSearch = true,
  ) => {
    const query = author ? `${title} ${author}` : title;
    const oceanUrl = `https://oceanofpdf.com/?s=${encodeURIComponent(query)}`;

    // Set second arg to false if you prefer direct Ocean of PDF over DuckDuckGo
    launchExternalUrl(oceanUrl, useAdFreeSearch);
  };

  const handleResetAuthor = () => {
    setAuthorInput("");
    setActiveDetail(null);
    setActiveAuthor(PRESET_AUTHORS[0].name);
  };

  return (
    <div
      data-theme={theme}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 font-sans"
    >
      <div className="app-panel w-full max-w-4xl max-h-[90vh] rounded-xl flex flex-col shadow-2xl overflow-hidden border">
        {/* Header */}
        <div className="app-panel-header px-4 sm:px-5 py-3 flex items-center justify-between border-b border-inherit shrink-0">
          <div className="flex items-center gap-2">
            <span>🧭</span>
            <h2 className="text-xs uppercase font-bold tracking-wider">
              Explore Library
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

        {/* Tab Selector */}
        <div className="p-3 border-b border-inherit bg-black/5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex rounded-md p-0.5 bg-black/10 border border-inherit">
            <button
              type="button"
              onClick={() => {
                setActiveDetail(null);
                setActiveTab("genres");
              }}
              className={`text-xs px-3 py-1 rounded font-semibold transition cursor-pointer ${
                activeTab === "genres"
                  ? "bg-amber-400 text-black font-bold shadow-xs"
                  : "app-muted hover:opacity-100"
              }`}
            >
              Browse by Genre
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveDetail(null);
                setActiveTab("authors");
              }}
              className={`text-xs px-3 py-1 rounded font-semibold transition cursor-pointer ${
                activeTab === "authors"
                  ? "bg-amber-400 text-black font-bold shadow-xs"
                  : "app-muted hover:opacity-100"
              }`}
            >
              Browse by Author
            </button>
          </div>
        </div>

        {/* Dynamic Controls Bar */}
        <div className="p-3 border-b border-inherit/40 flex flex-col gap-2.5 shrink-0">
          {activeTab === "authors" && (
            <form
              onSubmit={handleAuthorSearch}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search any author (e.g. Franz Kafka, Colleen Hoover)..."
                  value={authorInput}
                  onChange={(e) => setAuthorInput(e.target.value)}
                  className="app-input w-full rounded-md pl-3 pr-7 py-1.5 text-xs focus:outline-none"
                />
                {authorInput && (
                  <button
                    type="button"
                    onClick={() => setAuthorInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs app-muted hover:opacity-100 cursor-pointer"
                    title="Clear input"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!authorInput.trim() || loading}
                className="app-btn text-xs font-semibold px-3 py-1.5 rounded-md transition cursor-pointer shrink-0 disabled:opacity-40"
              >
                Search
              </button>

              {/* Reset Button */}
              <button
                type="button"
                onClick={handleResetAuthor}
                title="Reset to default author"
                className="app-btn text-xs font-medium px-2.5 py-1.5 rounded-md transition cursor-pointer shrink-0 flex items-center gap-1 opacity-80 hover:opacity-100"
              >
                <span>↺</span>
                <span className="hidden sm:inline">Reset</span>
              </button>
            </form>
          )}

          {/* Preset Pills */}
          <div className="overflow-x-auto flex items-center gap-1.5 no-scrollbar py-0.5">
            {activeTab === "genres"
              ? GENRES.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      setActiveDetail(null);
                      setSelectedGenre(g.id);
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer flex items-center gap-1 border ${
                      selectedGenre === g.id
                        ? "bg-amber-400 text-black font-bold border-amber-400 shadow-xs"
                        : "app-btn border-inherit"
                    }`}
                  >
                    <span>{g.icon}</span>
                    <span>{g.label}</span>
                  </button>
                ))
              : PRESET_AUTHORS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setActiveDetail(null);
                      setActiveAuthor(a.name);
                      setAuthorInput(a.name);
                    }}
                    className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition cursor-pointer border ${
                      activeAuthor.toLowerCase() === a.name.toLowerCase()
                        ? "bg-amber-400 text-black font-bold border-amber-400 shadow-xs"
                        : "app-btn border-inherit"
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1">
          {/* Catalog Loading State */}
          {loading && (
            <div className="py-20 text-center app-muted text-xs space-y-2">
              <span className="text-xl inline-block animate-spin">⏳</span>
              <p>
                Loading{" "}
                {activeTab === "authors"
                  ? `books by ${activeAuthor}`
                  : "category books"}
                ...
              </p>
            </div>
          )}

          {/* Catalog Error State */}
          {error && !loading && (
            <div className="py-16 text-center space-y-2">
              <p className="text-xs text-red-400 font-semibold">{error}</p>
              <button
                type="button"
                onClick={() => {
                  if (activeTab === "authors") {
                    setActiveAuthor((prev) => `${prev}`);
                  } else {
                    setSelectedGenre((prev) => `${prev}`);
                  }
                }}
                className="app-btn text-xs font-semibold px-3 py-1.5 rounded transition cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Content Views (When not loading and no error) */}
          {!loading &&
            !error &&
            (activeDetail ? (
              /* Book Summary & Details Panel */
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setActiveDetail(null)}
                  className="app-btn text-xs font-semibold px-3 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer"
                >
                  <span>←</span>
                  <span>Back to Books</span>
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
                        By{" "}
                        {activeDetail.authors?.join(", ") || "Unknown Author"}
                        {activeDetail.year && (
                          <span> • First published {activeDetail.year}</span>
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          openOcean(
                            activeDetail.title,
                            activeDetail.authors?.[0],
                          )
                        }
                        className="app-btn app-accent text-xs font-bold py-1.5 px-3 rounded flex items-center gap-1 transition cursor-pointer"
                      >
                        <span>OceanofPDF</span>
                        <span className="text-[10px]">↗</span>
                      </button>

                      <a
                        href={`https://archive.org/search?query=${encodeURIComponent(
                          `${activeDetail.title}${activeDetail.authors?.[0] || ""}`,
                        )}&and[]=mediatype%3A"texts"`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="app-btn text-xs font-medium py-1.5 px-3 rounded flex items-center gap-1 border border-inherit transition"
                      >
                        <span>Internet Archive</span>
                        <span className="text-[10px] opacity-75">↗</span>
                      </a>

                      <a
                        href={activeDetail.openLibraryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="app-btn text-xs font-medium py-1.5 px-3 rounded flex items-center gap-1 border border-inherit transition"
                      >
                        <span>Open Library</span>
                        <span className="text-[10px] opacity-75">↗</span>
                      </a>
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
            ) : /* Standard Results Grid */
            books.length === 0 ? (
              <div className="py-16 text-center app-muted text-xs space-y-1">
                <p>No titles found for this selection.</p>
                <p className="text-[11px] opacity-75">
                  Try checking another genre or author name.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {books.map((b) => (
                  <div
                    key={b.key}
                    onClick={() => handleOpenDetail(b)}
                    className="app-control p-2.5 rounded-lg border border-inherit flex gap-3 items-center shadow-xs cursor-pointer hover:border-amber-400/50 transition"
                  >
                    <div className="w-12 h-16 bg-black/10 rounded border border-inherit flex items-center justify-center shrink-0 overflow-hidden">
                      {b.cover_id ? (
                        <img
                          src={`https://covers.openlibrary.org/b/id/${b.cover_id}-M.jpg`}
                          alt={b.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-[10px] app-muted text-center px-0.5">
                          No cover
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4
                        className="text-xs font-bold truncate"
                        title={b.title}
                      >
                        {b.title}
                      </h4>
                      <p className="text-[11px] app-muted truncate">
                        {b.author_name?.[0] || "Various Authors"}
                      </p>
                      <span className="text-[10px] text-amber-500 font-medium inline-block mt-1">
                        View Details →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
