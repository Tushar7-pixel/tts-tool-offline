// src/utils/pdf.ts
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export type ExtractedPdf = {
  pages: string[][];
  displayPages: string[][];
  coverUrl?: string;
};

type PdfTextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const EMPTY_PAGE = "[Empty or non-text page]";

function isTextItem(
  item: unknown,
): item is { str: string; transform: number[]; width: number; height: number } {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    typeof (item as { str: unknown }).str === "string" &&
    "transform" in item
  );
}

function joinLineItems(items: PdfTextItem[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let out = "";
  let prevEnd: number | null = null;

  for (const item of sorted) {
    if (prevEnd !== null) {
      const gap = item.x - prevEnd;
      const needsSpace = gap > Math.max(item.height * 0.15, 1.2);
      if (needsSpace && !out.endsWith(" ") && !item.str.startsWith(" ")) {
        out += " ";
      }
    }
    out += item.str;
    prevEnd = item.x + item.width;
  }

  return out.replace(/\s+/g, " ").trim();
}

function groupVisualLines(items: PdfTextItem[]): string[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => {
    const yDiff = b.y - a.y;
    const threshold = Math.max(a.height, b.height, 4) * 0.6;
    if (Math.abs(yDiff) > threshold) return yDiff;
    return a.x - b.x;
  });

  const clusters: PdfTextItem[][] = [];
  for (const item of sorted) {
    const last = clusters[clusters.length - 1];
    if (!last) {
      clusters.push([item]);
      continue;
    }

    const ref = last[0];
    const threshold = Math.max(item.height, ref.height, 4) * 0.6;
    if (Math.abs(item.y - ref.y) <= threshold) {
      last.push(item);
    } else {
      clusters.push([item]);
    }
  }

  const lines: string[] = [];
  for (let i = 0; i < clusters.length; i++) {
    const text = joinLineItems(clusters[i]);
    if (i > 0) {
      const prev = clusters[i - 1][0];
      const curr = clusters[i][0];
      const lineHeight = Math.max(prev.height, curr.height, 8);
      const gap = prev.y - curr.y;
      if (gap > lineHeight * 1.7) {
        lines.push("");
      }
    }
    if (text) lines.push(text);
  }

  return lines;
}

// src/utils/pdf.ts

export function splitSentences(rawText: string): string[] {
  const cleaned = rawText.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  // Use Intl.Segmenter (supported in all modern Chromium/WebKit browsers)
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    const segments = segmenter.segment(cleaned);
    return Array.from(segments)
      .map((s) => s.segment.trim())
      .filter((s) => s.length > 0);
  }

  // Fallback regex that accounts for closing quotes, brackets, and dialogue markers
  return cleaned
    .split(/(?<=[.?!][\u201D\u2019"'’”\)\]]*)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  return aStart < bEnd && aEnd > bStart;
}

export function mapDisplayToSentences(
  displayLines: string[],
  sentences: string[],
): { displayToSentence: number[][]; sentenceToDisplay: number[][] } {
  const displayToSentence = displayLines.map(() => [] as number[]);
  const sentenceToDisplay = sentences.map(() => [] as number[]);

  if (displayLines.length === 0 || sentences.length === 0) {
    return { displayToSentence, sentenceToDisplay };
  }

  const lineRanges: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const line of displayLines) {
    const normalized = line.replace(/\s+/g, " ").trim();
    if (!normalized) {
      lineRanges.push({ start: -1, end: -1 });
      continue;
    }
    if (cursor > 0) cursor += 1;
    lineRanges.push({ start: cursor, end: cursor + normalized.length });
    cursor += normalized.length;
  }

  const rawText = displayLines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join(" ");

  let searchFrom = 0;
  const sentenceRanges = sentences.map((sentence) => {
    const idx = rawText.indexOf(sentence, searchFrom);
    if (idx === -1) {
      return { start: -1, end: -1 };
    }
    searchFrom = idx + sentence.length;
    return { start: idx, end: idx + sentence.length };
  });

  for (let d = 0; d < displayLines.length; d++) {
    const lineRange = lineRanges[d];
    if (lineRange.start < 0) continue;
    for (let s = 0; s < sentences.length; s++) {
      const sentenceRange = sentenceRanges[s];
      if (sentenceRange.start < 0) continue;
      if (
        rangesOverlap(
          lineRange.start,
          lineRange.end,
          sentenceRange.start,
          sentenceRange.end,
        )
      ) {
        displayToSentence[d].push(s);
        sentenceToDisplay[s].push(d);
      }
    }
  }

  const mappedSentences = sentenceToDisplay.filter((rows) => rows.length > 0);
  if (mappedSentences.length === 0 && displayLines.length === sentences.length) {
    for (let i = 0; i < sentences.length; i++) {
      displayToSentence[i] = [i];
      sentenceToDisplay[i] = [i];
    }
  }

  return { displayToSentence, sentenceToDisplay };
}

export async function extractPdfPages(file: File): Promise<ExtractedPdf> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  // 1. Generate page 1 thumbnail using the loaded `pdf` document proxy
  const coverUrl = await generatePdfThumbnail(pdf);

  const pages: string[][] = [];
  const displayPages: string[][] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = [];

    for (const item of content.items) {
      if (!isTextItem(item)) continue;
      items.push({
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height: item.height,
      });
    }

    const displayLines = groupVisualLines(items);
    const rawText = displayLines
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter((line) => line.length > 0)
      .join(" ")
      .replace(/\s+/g, " ");

    const sentences = splitSentences(rawText);

    displayPages.push(
      displayLines.length > 0 ? displayLines : [EMPTY_PAGE],
    );
    pages.push(sentences.length > 0 ? sentences : [EMPTY_PAGE]);
  }

  // 2. Return the generated coverUrl alongside the parsed text pages
  return { pages, displayPages, coverUrl };
}

export async function generatePdfThumbnail(pdf: pdfjsLib.PDFDocumentProxy): Promise<string | undefined> {
  try {
    const page = await pdf.getPage(1);
    const unscaledViewport = page.getViewport({ scale: 1 });
    
    // Scale target: width of 120px for crisp, lightweight cover
    const scale = 120 / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Pass both canvas and canvasContext to satisfy RenderParameters
    const renderTask = page.render({
      canvas: canvas,
      canvasContext: ctx,
      viewport: viewport,
    });

    await renderTask.promise;
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch (err) {
    console.error('PDF Cover thumbnail generation error:', err);
    return undefined;
  }
}