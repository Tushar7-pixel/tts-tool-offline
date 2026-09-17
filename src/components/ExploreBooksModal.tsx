// src/components/ExploreBooksModal.tsx
import React, { useState, useEffect } from "react";
import type { ReaderTheme } from "../utils/readerAppearance";

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
  const [activeAuthor, setActiveAuthor] = useState<string>(PRESET_AUTHORS[0].name);
  const [authorInput, setAuthorInput] = useState("");
  const [books, setBooks] = useState<BookWork[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            selectedGenre
          )}.json?limit=18`;
        } else {
          url = `https://openlibrary.org/search.json?author=${encodeURIComponent(
            activeAuthor
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
      setActiveAuthor(clean);
    }
  };

  const openOcean = (title: string, author?: string) => {
    const query = author ? `${title} ${author}` : title;
    window.open(
      `https://oceanofpdf.com/?s=${encodeURIComponent(query)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };
  

  const handleResetAuthor = () => {
    setAuthorInput('');
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
              onClick={() => setActiveTab("genres")}
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
              onClick={() => setActiveTab("authors")}
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
        {activeTab === 'authors' && (
            <form onSubmit={handleAuthorSearch} className="flex items-center gap-2">
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
                    onClick={() => setAuthorInput('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs app-muted hover:opacity-100 cursor-pointer"
                    title="Clear input"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!authorInput.trim()}
                className="app-btn text-xs font-semibold px-3 py-1.5 rounded-md transition cursor-pointer shrink-0 disabled:opacity-40"
              >
                Search
              </button>

              {/* Reset Button: Reverts to the first default preset author */}
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
                    onClick={() => setSelectedGenre(g.id)}
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
          {loading && (
            <div className="py-20 text-center app-muted text-xs space-y-2">
              <span className="text-xl inline-block animate-spin">⏳</span>
              <p>
                Loading {activeTab === "authors" ? `books by ${activeAuthor}` : "category books"}...
              </p>
            </div>
          )}

          {error && !loading && (
            <p className="text-xs text-red-400 text-center py-10">{error}</p>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {books.map((b) => {
                const coverUrl = b.cover_id
                  ? `https://covers.openlibrary.org/b/id/${b.cover_id}-M.jpg`
                  : null;
                const author = b.author_name?.[0] || activeAuthor || "Various Authors";

                return (
                  <div
                    key={b.key}
                    className="app-control p-2.5 rounded-lg border border-inherit flex gap-3 items-center shadow-xs"
                  >
                    <div className="w-12 h-16 bg-black/10 rounded border border-inherit flex items-center justify-center shrink-0 overflow-hidden">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
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
                      <h4 className="text-xs font-bold truncate" title={b.title}>
                        {b.title}
                      </h4>
                      <p className="text-[11px] app-muted truncate">{author}</p>
                      <button
                        type="button"
                        onClick={() => openOcean(b.title, author)}
                        className="mt-1.5 app-btn app-accent text-[10px] font-bold py-1 px-2 rounded inline-flex items-center gap-1 cursor-pointer transition active:scale-95"
                      >
                        <span>OceanofPDF</span>
                        <span className="text-[9px]">↗</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};