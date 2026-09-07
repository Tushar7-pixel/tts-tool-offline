// src/utils/pdf.ts
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

export async function extractPdfPages(file: File): Promise<string[][]> {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages: string[][] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const rawText = content.items
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ');

        const lines = rawText
            .split(/(?<=[.?!])\s+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

        pages.push(lines.length > 0 ? lines : ['[Empty or non-text page]']);
    }

    return pages;
}