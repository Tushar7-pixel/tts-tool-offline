// src/components/AppearanceMenu.tsx
import React, { useRef, useEffect } from "react";
import {
  READER_FONTS,
  type ReaderFontId,
  type ReaderTheme,
} from "../utils/readerAppearance";

interface AppearanceMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: ReaderTheme;
  fontId: ReaderFontId;
  onThemeChange: (theme: ReaderTheme) => void;
  onFontChange: (fontId: ReaderFontId) => void;
}

const THEME_OPTIONS: { id: ReaderTheme; label: string; desc: string }[] = [
  { id: "eink-light", label: "E-Paper", desc: "Monochrome" },
  { id: "sepia", label: "Sepia", desc: "Warm Book" },
  { id: "eink-dark", label: "E-Ink Dark", desc: "Carbon" },
  { id: "dark", label: "Slate", desc: "Emerald" },
];

export const AppearanceMenu: React.FC<AppearanceMenuProps> = ({
  open,
  onOpenChange,
  theme,
  fontId,
  onThemeChange,
  onFontChange,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange]);

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="app-btn p-1.5 rounded cursor-pointer flex items-center justify-center text-sm"
        title="Appearance Settings"
      >
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop for mobile only */}
          <div
            className="fixed inset-0 bg-black/40 z-50 md:hidden backdrop-blur-xs"
            onClick={() => onOpenChange(false)}
          />

          {/* Dialog Container */}
          <div
            className="fixed inset-x-4 top-20 z-50 max-w-sm mx-auto p-4 rounded-xl shadow-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--app-text)] flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-150 md:absolute md:inset-auto md:right-0 md:top-full md:mt-2 md:w-64 md:p-3 md:rounded-md"
            style={{
              backgroundColor: "var(--panel-bg)",
              color: "var(--app-text)",
            }}
          >
            {/* Mobile Header with Close Button */}
            <div className="flex items-center justify-between pb-1 border-b border-[var(--panel-border)] md:hidden">
              <span className="text-xs font-mono font-bold uppercase tracking-wider">
                Appearance
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="p-1 text-xs opacity-70 hover:opacity-100 font-bold"
              >
                ✕
              </button>
            </div>

            {/* 4 Themes Selection Grid */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70 mb-1.5 font-mono">
                Reading Theme
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {THEME_OPTIONS.map((opt) => {
                  const isActive = theme === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onThemeChange(opt.id)}
                      className={`text-xs py-2 px-2.5 rounded text-left border transition cursor-pointer flex flex-col gap-0.5 ${
                        isActive
                          ? "bg-[var(--app-text)] text-[var(--app-bg)] font-bold border-transparent"
                          : "bg-[var(--control-bg)] border-[var(--control-border)] hover:bg-black/5 dark:hover:bg-white/5"
                      }`}
                    >
                      <span className="leading-tight">{opt.label}</span>
                      <span className="text-[9px] opacity-70 font-normal">
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reader Font Section */}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70 mb-1.5 font-mono">
                Reader Font
              </span>
              <div className="flex flex-col gap-1 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                {READER_FONTS.map((f) => {
                  const isSelected = fontId === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onFontChange(f.id)}
                      className={`text-xs py-1.5 px-2.5 rounded text-left border border-transparent transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? "bg-[var(--app-text)] text-[var(--app-bg)] font-bold"
                          : "hover:bg-black/5 dark:hover:bg-white/5 text-[var(--app-text)]"
                      }`}
                      style={{ fontFamily: f.cssFamily }}
                    >
                      <span>{f.label}</span>
                      {isSelected && <span className="text-[10px]">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
