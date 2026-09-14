export type ReaderTheme = "dark" | "ereader";
export type ReaderFontId = "sans" | "hand" | "serif" | "mono";

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
    id: "sans",
    label: "Standard Sans",
    cssFamily: "ui-sans-serif, system-ui, sans-serif",
  },
  {
    id: "hand",
    label: "Hand-drawn",
    cssFamily: '"Patrick Hand", "Comic Sans MS", cursive',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Patrick+Hand&display=swap",
  },
  {
    id: "serif",
    label: "Classic Book",
    cssFamily: 'Literata, Georgia, "Times New Roman", serif',
    googleHref:
      "https://fonts.googleapis.com/css2?family=Literata:opsz,wght@7..72,400;7..72,500;7..72,600&display=swap",
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
    return stored === "ereader" ? "ereader" : "dark";
  } catch {
    return "dark";
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
  return "sans";
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
