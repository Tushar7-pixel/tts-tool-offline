// src/utils/db.ts
import { openDB } from 'idb';
import type { ChapterItem } from './pdf';

const DB_NAME = 'PiperBookLibraryDB';
const STORE_NAME = 'books';

export type HighlightItem = {
    id: string;
    text: string;
    color: string;
};

export type BookDoc = {
    id: string;
    title: string;
    pages: string[][];
    displayPages?: string[][];
    totalPages: number;
    currentPage: number;
    coverUrl?: string;
    currentLine: number;
    updatedAt: number;
    chapters?: ChapterItem[];
    currentChapter?: string;
    highlights?: Record<string, HighlightItem[]>; // "page-line" -> array of highlighted segments
};

const getDB = () =>
    openDB(DB_NAME, 2, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        },
    });

export async function saveBook(book: BookDoc): Promise<void> {
    const db = await getDB();
    await db.put(STORE_NAME, book);
}

export async function getAllBooks(): Promise<BookDoc[]> {
    const db = await getDB();
    return db.getAll(STORE_NAME);
}

export async function getBook(id: string): Promise<BookDoc | undefined> {
    const db = await getDB();
    return db.get(STORE_NAME, id);
}

export async function updateBookProgress(
    id: string,
    page: number,
    line: number
): Promise<void> {
    const db = await getDB();
    const book = await db.get(STORE_NAME, id);
    if (book) {
        book.currentPage = page;
        book.currentLine = line;
        book.updatedAt = Date.now();
        await db.put(STORE_NAME, book);
    }
}

export async function applyMultiLineHighlight(
    bookId: string,
    entries: { page: number; line: number; text: string; color: string }[]
): Promise<void> {
    const db = await getDB();
    const book = await db.get(STORE_NAME, bookId);
    if (!book) return;

    if (!book.highlights) book.highlights = {};
    const highlightId = `hl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    for (const item of entries) {
        const key = `${item.page}-${item.line}`;
        if (!book.highlights[key]) {
            book.highlights[key] = [];
        }
        book.highlights[key].push({
            id: highlightId,
            text: item.text,
            color: item.color,
        });
    }

    book.updatedAt = Date.now();
    await db.put(STORE_NAME, book);
}

export async function deleteBook(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
}

export async function exportLibrary(): Promise<string> {
    const db = await getDB();
    const books = await db.getAll(STORE_NAME);
    return JSON.stringify(books);
}

export async function importLibrary(jsonData: string): Promise<number> {
    const db = await getDB();
    const books: BookDoc[] = JSON.parse(jsonData);
    let importedCount = 0;

    const tx = db.transaction(STORE_NAME, 'readwrite');
    for (const book of books) {
        await tx.store.put(book);
        importedCount++;
    }
    await tx.done;
    return importedCount;
}