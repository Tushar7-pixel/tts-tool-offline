// src/utils/readerAppearance.ts

export type ReaderTheme = "dark" | "ereader";

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
      "https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,300&display=swap",
  },
  {
    id: "lora",
    label: "Literary Serif",
    cssFamily: '"Lora", serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&display=swap",
  },
  {
    id: "hyperlegible",
    label: "Hyperlegible",
    cssFamily: '"Atkinson Hyperlegible", system-ui, sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap",
  },
  {
    id: "sans",
    label: "Clean Sans",
    cssFamily: '"Inter", ui-sans-serif, system-ui, sans-serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
  },
  {
    id: "mono",
    label: "Typewriter",
    cssFamily: '"Courier Prime", "Courier New", Courier, monospace',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap",
  },
];

export function loadReaderTheme(): ReaderTheme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    // Defaults to "ereader" (Light mode)
    return stored === "dark" ? "dark" : "ereader";
  } catch {
    return "ereader";
  }
}

export function loadReaderFontId(): ReaderFontId {
  try {
    const stored = localStorage.getItem(FONT_KEY);
    if (READER_FONTS.some((font) => font.id === stored)) {
      return stored as ReaderFontId;
    }
  } catch {
    /* ignore */
  }
  // Defaults to "hand" (Handwritten)
  return "hand";
}

export function saveReaderTheme(theme: ReaderTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function saveReaderFontId(fontId: ReaderFontId) {
  try {
    localStorage.setItem(FONT_KEY, fontId);
  } catch {
    /* ignore */
  }
}

export function getReaderFont(fontId: ReaderFontId): ReaderFontOption {
  return READER_FONTS.find((font) => font.id === fontId) ?? READER_FONTS[0];
}

export function loadGoogleFont(href: string) {
  const id = `gf-${encodeURIComponent(href)}`;
  if (document.getElementById(id)) return;

  if (!document.getElementById("gf-preconnect-googleapis")) {
    const preconnect = document.createElement("link");
    preconnect.id = "gf-preconnect-googleapis";
    preconnect.rel = "preconnect";
    preconnect.href = "https://fonts.googleapis.com";
    document.head.appendChild(preconnect);

    const gstatic = document.createElement("link");
    gstatic.id = "gf-preconnect-gstatic";
    gstatic.rel = "preconnect";
    gstatic.href = "https://fonts.gstatic.com";
    gstatic.crossOrigin = "anonymous";
    document.head.appendChild(gstatic);
  }

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}