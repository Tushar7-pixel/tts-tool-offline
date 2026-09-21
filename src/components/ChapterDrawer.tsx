// src/components/ChapterDrawer.tsx
import React, { useEffect, useRef } from "react";
import type { ChapterItem } from "../utils/pdf";

interface ChapterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: ChapterItem[];
  currentPage: number;
  onSelectChapter: (pageIndex: number) => void;
}

export const ChapterDrawer: React.FC<ChapterDrawerProps> = ({
  isOpen,
  onClose,
  chapters,
  currentPage,
  onSelectChapter,
}) => {
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

  // Scroll current chapter into view inside the drawer
  useEffect(() => {
    if (isOpen && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine which chapter is active based on current page
  const activeChapterIndex = [...chapters]
    .reverse()
    .find((c) => c.pageIndex <= currentPage)?.pageIndex ?? -1;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose} 
      />

      {/* Slide-over Drawer - Styled with app-panel theme variables */}
      <div className="app-panel relative z-10 w-full max-w-xs sm:max-w-sm h-full flex flex-col shadow-2xl border-y-0 border-l-0">
        
        {/* Drawer Header - Styled with app-panel-header */}
        <div className="app-panel-header flex items-center justify-between px-4 py-3.5 shrink-0 border-x-0 border-t-0">
          <div className="flex items-center gap-2">
            <span className="text-base">📑</span>
            <h3 className="font-bold text-sm text-[var(--app-text)]">Table of Contents</h3>
            <span className="text-[11px] app-muted">({chapters.length})</span>
          </div>
          <button
            onClick={onClose}
            className="app-btn p-1.5 rounded-md text-sm cursor-pointer flex items-center justify-center w-7 h-7 border-transparent shadow-none bg-transparent"
          >
            ✕
          </button>
        </div>

        {/* Chapter List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {chapters.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center app-muted text-xs text-center px-4">
              <p>No chapters or headings detected for this document.</p>
            </div>
          ) : (
            chapters.map((ch, idx) => {
              const isCurrent = ch.pageIndex === activeChapterIndex;
              return (
                <button
                  key={`${ch.pageIndex}-${idx}`}
                  ref={isCurrent ? activeItemRef : null}
                  onClick={() => {
                    onSelectChapter(ch.pageIndex);
                    onClose();
                  }}
                  /* Utilize the shelf-row and is-selected classes from index.css for perfect theme matching */
                  className={`w-full text-left px-3 py-2.5 rounded-md text-xs transition flex items-center justify-between gap-2 cursor-pointer shelf-row ${
                    isCurrent ? "is-selected font-bold" : ""
                  }`}
                >
                  <span className="truncate flex-1">{ch.title}</span>
                  <span className={`text-[10px] font-mono shrink-0 ${isCurrent ? 'opacity-80' : 'opacity-50'}`}>
                    Pg {ch.pageIndex + 1}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};