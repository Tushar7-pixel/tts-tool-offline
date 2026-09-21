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
  chapters: ChapterItem[];
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
  // Normalize spacing and fix spaced ellipses (e.g., ". . .")
  const cleaned = rawText
    .replace(/(?:\.\s*){2,}\./g, "...")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];

  let rawSegments: string[] = [];

  // 1. Extract raw sentences natively
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    rawSegments = Array.from(segmenter.segment(cleaned))
      .map((s) => s.segment.trim())
      .filter((s) => s.length > 0);
  } else {
    rawSegments = cleaned
      .split(/(?<=(?<!\.)[.?!][\u201D\u2019"'’”\)\]]*)\s+(?=[A-Z"'\u201C\u2018])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  const finalChunks: string[] = [];
  let currentChunk = "";

  // Helper to detect if a boundary represents a change in speaker/paragraph
  const isSpeakerBoundary = (a: string, b: string) => {
    // True if chunk A ends with punctuation/quote AND chunk B starts with a quote
    const aEndsWithPunctOrQuote = /[.?!"'”’]$/.test(a.trim());
    const bStartsWithQuote = /^["'“‘]/.test(b.trim());
    return aEndsWithPunctOrQuote && bStartsWithQuote;
  };

  // 2. Smart Merging Pass
  for (const seg of rawSegments) {
    if (!currentChunk) {
      currentChunk = seg;
      continue;
    }

    const boundary = isSpeakerBoundary(currentChunk, seg);

    // If it's a hard dialogue switch, NEVER merge them 
    if (boundary) {
      finalChunks.push(currentChunk);
      currentChunk = seg;
      continue;
    }

    // Merge if:
    // 1. The combined chunk is short enough for comfortable reading (~120 chars)
    // 2. OR the new segment is a micro-sentence so it doesn't get orphaned
    if (currentChunk.length + seg.length < 120 || seg.length < 15) {
      currentChunk += " " + seg;
    } else {
      finalChunks.push(currentChunk);
      currentChunk = seg;
    }
  }

  if (currentChunk) {
    finalChunks.push(currentChunk);
  }

  return finalChunks;
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
  const chapters = await extractPdfChapters(pdf, displayPages);

  // 2. Return the generated coverUrl alongside the parsed text pages
  return { pages, displayPages, coverUrl, chapters };
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


export type ChapterItem = {
  title: string;
  pageIndex: number;
};

const NUMBER_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred";

const NOVEL_CHAPTER_REGEX = new RegExp(
  `^(?:` +
    // 1. Explicit Chapter/Part + Number/Word (e.g., "Chapter 1", "Part Two")
    `(?:chapter|part|act|book)\\s+(?:\\d+|[ivxlcdm]+|(?:(?:${NUMBER_WORDS})[\\s-]?)+)` +
    // 2. Structural framing
    `|prologue|epilogue|interlude|prelude|afterword` +
    // 3. Temporal jumps
    `|(?:(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\\d+)\\s+(?:years?|months?|weeks?|days?|hours?)\\s+later)` +
    // 4. Strict standalone Roman numerals (requires exact bounds)
    `|\\b(?:I|V|X|L|C|D|M)+\\b\\.?` +
  `)$`,
  "i"
);

// Analyzes the whole document to find headers that repeat on almost every page
function detectRunningHeaders(displayPages: string[][]): Set<string> {
  const headerCounts = new Map<string, number>();
  
  for (const lines of displayPages) {
    if (!lines || lines.length === 0) continue;
    const nonEmpty = lines.map(l => l.trim()).filter(l => l.length > 0);
    if (nonEmpty.length > 0) {
      const topStr = nonEmpty[0].toLowerCase();
      headerCounts.set(topStr, (headerCounts.get(topStr) || 0) + 1);
    }
  }

  const runningHeaders = new Set<string>();
  for (const [header, count] of headerCounts.entries()) {
    // If a string appears at the very top of more than 4 pages, it's a running header, not a chapter start
    if (count > 4) runningHeaders.add(header);
  }
  return runningHeaders;
}

export function parseChaptersFromDisplayPages(displayPages: string[][]): ChapterItem[] {
  const chapters: ChapterItem[] = [];
  const runningHeaders = detectRunningHeaders(displayPages);

  for (let pIdx = 0; pIdx < displayPages.length; pIdx++) {
    const lines = displayPages[pIdx];
    if (!lines || lines.length === 0) continue;

    const nonEmpty = lines.map((l) => l.trim()).filter((l) => l.length > 0);
    if (nonEmpty.length < 3) continue; // Skip blank/filler pages

    // Inspect only the top 3 lines of the page
    const searchSlice = nonEmpty.slice(0, 3);

    for (let i = 0; i < searchSlice.length; i++) {
      const line = searchSlice[i];
      const normalizedLine = line.toLowerCase();

      if (runningHeaders.has(normalizedLine)) continue;

      const isDirectMatch = NOVEL_CHAPTER_REGEX.test(line);

      // POV / Character Name Detection (e.g., "RHETT", "SUMMER")
      // Criteria: Top 2 lines, short length, all uppercase or single title-case word, no trailing punctuation
      const isPovOrMinimalist = 
        i <= 1 && 
        line.length <= 25 && 
        /^(?:[A-Z0-9\s/:-]+|[A-Z][a-z]+)$/.test(line) && 
        !/[.,;!?]$/.test(line);

      if (isDirectMatch || isPovOrMinimalist) {
        let fullTitle = line;

        // Merge with subtitle if the next line is a short character name or title
        const nextLine = searchSlice[i + 1];
        if (
          nextLine &&
          nextLine.length <= 35 &&
          !/[.,;!?]$/.test(nextLine) &&
          !NOVEL_CHAPTER_REGEX.test(nextLine) &&
          !runningHeaders.has(nextLine.toLowerCase())
        ) {
          fullTitle = `${line} • ${nextLine}`;
        }

        if (!chapters.some((c) => c.pageIndex === pIdx)) {
          chapters.push({
            title: fullTitle.replace(/\s+/g, " ").trim(),
            pageIndex: pIdx,
          });
        }
        break; 
      }
    }
  }

  return chapters;
}

export async function extractPdfChapters(
  pdf: pdfjsLib.PDFDocumentProxy,
  displayPages: string[][]
): Promise<ChapterItem[]> {
  try {
    const outline = await pdf.getOutline();
    if (outline && outline.length > 1) {
      const outlineChapters: ChapterItem[] = [];
      for (const item of outline) {
        if (!item.dest) continue;
        try {
          const dest = typeof item.dest === "string" ? await pdf.getDestination(item.dest) : item.dest;
          if (Array.isArray(dest) && dest[0]) {
            const pageIndex = await pdf.getPageIndex(dest[0]);
            if (pageIndex >= 0) {
              outlineChapters.push({
                title: item.title?.trim() || `Page ${pageIndex + 1}`,
                pageIndex,
              });
            }
          }
        } catch {
          // Skip invalid destination reference
        }
      }
      if (outlineChapters.length > 1) {
        return outlineChapters.sort((a, b) => a.pageIndex - b.pageIndex);
      }
    }
  } catch (err) {
    console.warn("[PDF] Unable to inspect native outline:", err);
  }

  return parseChaptersFromDisplayPages(displayPages);
}