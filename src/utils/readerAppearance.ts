// src/utils/readerAppearance.ts

export type ReaderTheme = "dark" | "sepia" | "eink-light" | "eink-dark";

export type ReaderFontId =
  | "hand"
  | "caveat"
  | "merriweather"
  | "serif"
  | "lora"
  | "hyperlegible"
  | "sans"
  | "mono";

export type ReaderFontOption = {
  id: ReaderFontId;
  label: string;
  cssFamily: string;
  googleHref?: string;
};

const THEME_KEY = "piper-reader-theme";
const FONT_KEY = "piper-reader-font";

export const READER_FONTS: ReaderFontOption[] = [
  {
    id: "hand",
    label: "Handwritten",
    cssFamily: '"Patrick Hand", "Comic Sans MS", cursive',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap",
  },
  {
    id: "caveat",
    label: "Playful Script",
    cssFamily: '"Caveat", cursive',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&display=swap",
  },
  {
    id: "serif",
    label: "Classic Book",
    cssFamily: 'Literata, Georgia, "Times New Roman", serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,500;7..72,600&display=swap",
  },
  {
    id: "merriweather",
    label: "Modern Editorial",
    cssFamily: '"Merriweather", Georgia, serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Merriweather:wght@300;400;700&display=swap",
  },
  {
    id: "lora",
    label: "Literary Serif",
    cssFamily: '"Lora", serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Lora:wght@400..700&display=swap",
  },
  {
    id: "hyperlegible",
    label: "Hyperlegible",
    cssFamily: '"Atkinson Hyperlegible", system-ui, sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap",
  },
  {
    id: "sans",
    label: "Clean Sans",
    cssFamily: '"Inter", system-ui, sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap",
  },
  {
    id: "mono",
    label: "E-Paper Type",
    cssFamily: '"Space Mono", monospace',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap",
  },
];

export function loadReaderTheme(): ReaderTheme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "sepia" || stored === "eink-light" || stored === "eink-dark") {
      return stored;
    }
    // Backward compatibility with legacy "ereader" key
    if (stored === "ereader") return "eink-light";
  } catch { }
  return "eink-light";
}

export function loadReaderFontId(): ReaderFontId {
  try {
    const stored = localStorage.getItem(FONT_KEY);
    if (READER_FONTS.some((font) => font.id === stored)) {
      return stored as ReaderFontId;
    }
  } catch { }
  return "hand";
}

export function saveReaderTheme(theme: ReaderTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch { }
}

export function saveReaderFontId(fontId: ReaderFontId) {
  try {
    localStorage.setItem(FONT_KEY, fontId);
  } catch { }
}

export function getReaderFont(fontId: ReaderFontId): ReaderFontOption {
  return READER_FONTS.find((font) => font.id === fontId) ?? READER_FONTS[0];
}

export function loadGoogleFont(href: string) {
  const id = `gf-${encodeURIComponent(href)}`;
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}