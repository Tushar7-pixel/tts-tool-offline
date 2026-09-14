import React, { useEffect, useRef } from "react";
import {
  READER_FONTS,
  loadGoogleFont,
  type ReaderFontId,
  type ReaderTheme,
} from "../utils/readerAppearance";

type AppearanceMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  theme: ReaderTheme;
  fontId: ReaderFontId;
  onThemeChange: (theme: ReaderTheme) => void;
  onFontChange: (fontId: ReaderFontId) => void;
};

export function AppearanceMenu({
  open,
  onOpenChange,
  theme,
  fontId,
  onThemeChange,
  onFontChange,
}: AppearanceMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    READER_FONTS.forEach((font) => {
      if (font.googleHref) loadGoogleFont(font.googleHref);
    });

    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        aria-label="Appearance settings"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="app-btn w-9 h-9 flex items-center justify-center text-lg leading-none cursor-pointer"
      >
        ⋮
      </button>
      {open && (
        <div className="app-menu absolute right-0 top-full mt-2 w-64 z-50 p-3 text-left">
          <p className="app-menu-label">Theme</p>
          <div className="grid grid-cols-2 gap-1.5 mb-3">
            <button
              type="button"
              onClick={() => onThemeChange("dark")}
              className={`app-choice ${theme === "dark" ? "is-active" : ""}`}
            >
              Dark
            </button>
            <button
              type="button"
              onClick={() => onThemeChange("ereader")}
              className={`app-choice ${theme === "ereader" ? "is-active" : ""}`}
            >
              eReader
            </button>
          </div>

          <p className="app-menu-label">Reader font</p>
          <div className="flex flex-col gap-1">
            {READER_FONTS.map((font) => (
              <button
                key={font.id}
                type="button"
                onClick={() => onFontChange(font.id)}
                className={`app-choice text-left ${fontId === font.id ? "is-active" : ""}`}
                style={{ fontFamily: font.cssFamily }}
              >
                {font.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
