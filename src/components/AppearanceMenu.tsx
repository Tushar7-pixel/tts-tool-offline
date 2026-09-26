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
    <div className="relative" ref={menuRef}>
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
        <div
          className="absolute right-0 top-full mt-2 w-56 p-3 z-50 rounded shadow-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] text-[var(--app-text)] flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-100"
          style={{
            backgroundColor: "var(--panel-bg)",
            color: "var(--app-text)",
          }}
        >
          {/* Theme Section */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70 mb-1.5 font-mono">
              Theme
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onThemeChange("dark")}
                className={`text-xs py-1.5 px-2 rounded font-semibold border border-[var(--panel-border)] transition cursor-pointer ${
                  theme === "dark"
                    ? "bg-[var(--app-text)] text-[var(--app-bg)] font-bold"
                    : "bg-[var(--control-bg)] hover:bg-black/10 dark:hover:bg-white/10"
                }`}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => onThemeChange("ereader")}
                className={`text-xs py-1.5 px-2 rounded font-semibold border border-[var(--panel-border)] transition cursor-pointer ${
                  theme === "ereader"
                    ? "bg-[var(--app-text)] text-[var(--app-bg)] font-bold"
                    : "bg-[var(--control-bg)] hover:bg-black/10 dark:hover:bg-white/10"
                }`}
              >
                eReader
              </button>
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
      )}
    </div>
  );
};
