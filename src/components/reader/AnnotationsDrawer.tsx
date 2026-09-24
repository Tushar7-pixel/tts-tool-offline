// src/components/reader/AnnotationsDrawer.tsx
import React, { useState } from "react";
import type { HighlightItem } from "../../utils/db";

interface AnnotationEntry {
  page: number;
  line: number;
  item: HighlightItem;
}

interface AnnotationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  highlights?: Record<string, HighlightItem[]>;
  currentPage: number;
  onJumpTo: (page: number, line: number) => void;
  onDeleteHighlight: (id: string) => void;
  onSaveNote: (id: string, note: string) => void;
}

export const AnnotationsDrawer: React.FC<AnnotationsDrawerProps> = ({
  isOpen,
  onClose,
  highlights,
  currentPage,
  onJumpTo,
  onDeleteHighlight,
  onSaveNote,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState<string>("");

  if (!isOpen) return null;

  // Aggregate and deduplicate highlight items spanning multiple lines
  const entries: AnnotationEntry[] = [];
  const seenIds = new Set<string>();

  if (highlights) {
    const sortedKeys = Object.keys(highlights).sort((a, b) => {
      const [pA, lA] = a.split("-").map(Number);
      const [pB, lB] = b.split("-").map(Number);
      return pA !== pB ? pA - pB : lA - lB;
    });

    for (const key of sortedKeys) {
      const [page, line] = key.split("-").map(Number);
      const items = highlights[key] || [];

      for (const item of items) {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          entries.push({ page, line, item });
        }
      }
    }
  }

  const handleStartEdit = (item: HighlightItem) => {
    setEditingId(item.id);
    setNoteInput(item.note || "");
  };

  const handleSaveEdit = (id: string) => {
    onSaveNote(id, noteInput);
    setEditingId(null);
    setNoteInput("");
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs font-sans">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="app-panel relative z-10 w-full max-w-md h-full flex flex-col shadow-2xl border-l border-[var(--panel-border)] animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="app-panel-header px-4 py-3 flex items-center justify-between border-b border-[var(--panel-border)]">
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <h3 className="text-xs uppercase font-bold tracking-wider">
              Highlights & Notes ({entries.length})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-xs font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {entries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center app-muted text-xs space-y-2 py-12">
              <span className="text-3xl">🖍️</span>
              <p>No highlights yet.</p>
              <p className="text-[11px] opacity-75">
                Select text in any chapter and click Highlight to save quotes.
              </p>
            </div>
          ) : (
            entries.map(({ page, line, item }) => {
              const isCurrent = page === currentPage;
              const isEditing = editingId === item.id;

              return (
                <div
                  key={item.id}
                  className={`app-panel p-3 rounded-xl border transition ${
                    isCurrent
                      ? "border-amber-400/60 shadow-xs"
                      : "border-[var(--panel-border)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-bold text-[var(--accent)] flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-xs"
                        style={{ backgroundColor: item.color }}
                      />
                      Page {page + 1}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          onJumpTo(page, line);
                          onClose();
                        }}
                        className="app-btn text-[10px] font-semibold px-2 py-0.5 rounded cursor-pointer"
                      >
                        Jump ↗
                      </button>
                      <button
                        onClick={() => onDeleteHighlight(item.id)}
                        className="p-1 text-xs text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer transition"
                        title="Delete highlight"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <blockquote className="text-xs italic pl-2.5 border-l-2 border-inherit opacity-90 leading-relaxed">
                    "{item.text}"
                  </blockquote>

                  {/* Note Section */}
                  {isEditing ? (
                    <div className="mt-2.5 space-y-1.5 pt-2 border-t border-[var(--panel-border)]">
                      <textarea
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        placeholder="Add your thoughts or note..."
                        className="app-input w-full rounded-md p-2 text-xs focus:outline-none resize-none"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => setEditingId(null)}
                          className="app-btn text-[10px] px-2 py-1 rounded cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(item.id)}
                          className="app-btn app-accent text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer"
                        >
                          Save Note
                        </button>
                      </div>
                    </div>
                  ) : item.note ? (
                    <div
                      onClick={() => handleStartEdit(item)}
                      className="mt-2 text-xs p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-inherit cursor-pointer hover:border-[var(--accent)] transition"
                      title="Click to edit note"
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold opacity-60 mb-0.5">
                        <span>NOTE</span>
                        <span>✎ Edit</span>
                      </div>
                      <p className="whitespace-pre-wrap">{item.note}</p>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartEdit(item)}
                      className="mt-2 text-[10px] text-[var(--accent)] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>+ Add Note</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
