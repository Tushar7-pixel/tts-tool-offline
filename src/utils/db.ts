// src/utils/db.ts
import { openDB } from 'idb';
import type { ChapterItem } from './pdf';

const DB_NAME = 'PiperBookLibraryDB';
const STORE_NAME = 'books';
const STATS_STORE = 'reading_stats';

export type HighlightItem = {
    id: string;
    text: string;
    color: string;
    note?: string;
    createdAt?: number;
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
    highlights?: Record<string, HighlightItem[]>;
};

export type ReadingStats = {
    id: string; // 'global_stats'
    totalReadingSeconds: number;
    totalLinesRead: number;
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string; // 'YYYY-MM-DD'
    dailySeconds: Record<string, number>; // 'YYYY-MM-DD' -> seconds
};

const DEFAULT_STATS: ReadingStats = {
    id: 'global_stats',
    totalReadingSeconds: 0,
    totalLinesRead: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    dailySeconds: {},
};

const getDB = () =>
    openDB(DB_NAME, 3, {
        upgrade(db,) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STATS_STORE)) {
                db.createObjectStore(STATS_STORE, { keyPath: 'id' });
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
    const createdAt = Date.now();

    for (const item of entries) {
        const key = `${item.page}-${item.line}`;
        if (!book.highlights[key]) {
            book.highlights[key] = [];
        }
        book.highlights[key].push({
            id: highlightId,
            text: item.text,
            color: item.color,
            createdAt,
        });
    }

    book.updatedAt = Date.now();
    await db.put(STORE_NAME, book);
}

export async function deleteHighlightById(
    bookId: string,
    highlightId: string
): Promise<Record<string, HighlightItem[]>> {
    const db = await getDB();
    const book = await db.get(STORE_NAME, bookId);
    if (!book || !book.highlights) return {};

    const updatedHighlights: Record<string, HighlightItem[]> = {};
    const entries = Object.entries(book.highlights) as [string, HighlightItem[]][];

    for (const [key, items] of entries) {
        const filtered = items.filter((h: HighlightItem) => h.id !== highlightId);
        if (filtered.length > 0) {
            updatedHighlights[key] = filtered;
        }
    }

    book.highlights = updatedHighlights;
    book.updatedAt = Date.now();
    await db.put(STORE_NAME, book);
    return updatedHighlights;
}

export async function updateHighlightNote(
    bookId: string,
    highlightId: string,
    note: string
): Promise<Record<string, HighlightItem[]>> {
    const db = await getDB();
    const book = await db.get(STORE_NAME, bookId);
    if (!book || !book.highlights) return {};

    const values = Object.values(book.highlights) as HighlightItem[][];

    for (const items of values) {
        for (const item of items) {
            if (item.id === highlightId) {
                item.note = note.trim() ? note.trim() : undefined;
            }
        }
    }

    book.updatedAt = Date.now();
    await db.put(STORE_NAME, book);
    return { ...book.highlights };
}

export async function deleteBook(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
}

export async function exportLibrary(): Promise<string> {
    const db = await getDB();
    const books = await db.getAll(STORE_NAME);
    const stats = await getReadingStats();
    return JSON.stringify({ books, stats });
}

export async function importLibrary(jsonData: string): Promise<number> {
    const db = await getDB();
    const parsed = JSON.parse(jsonData);

    // Support previous schema (direct array) or new schema ({ books, stats })
    const books: BookDoc[] = Array.isArray(parsed) ? parsed : (parsed.books || []);
    let importedCount = 0;

    const tx = db.transaction(STORE_NAME, 'readwrite');
    for (const book of books) {
        await tx.store.put(book);
        importedCount++;
    }
    await tx.done;

    if (!Array.isArray(parsed) && parsed.stats) {
        await saveReadingStats(parsed.stats);
    }

    return importedCount;
}

// === STATS & STREAK MANAGEMENT ===

function getLocalDateString(d = new Date()): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export async function getReadingStats(): Promise<ReadingStats> {
    const db = await getDB();
    const stats = await db.get(STATS_STORE, 'global_stats');
    return stats ? { ...DEFAULT_STATS, ...stats } : { ...DEFAULT_STATS };
}

export async function saveReadingStats(stats: ReadingStats): Promise<void> {
    const db = await getDB();
    await db.put(STATS_STORE, stats);
}

export async function recordReadingProgress(additionalSeconds: number, linesRead: number = 0): Promise<ReadingStats> {
    const db = await getDB();
    const current = (await db.get(STATS_STORE, 'global_stats')) || { ...DEFAULT_STATS };
    const today = getLocalDateString();

    // Streak calculation
    let streak = current.currentStreak || 0;
    if (current.lastActiveDate !== today) {
        if (!current.lastActiveDate) {
            streak = 1;
        } else {
            const lastDate = new Date(current.lastActiveDate);
            const todayDate = new Date(today);
            const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

            if (diffDays === 1) {
                streak += 1;
            } else if (diffDays > 1) {
                streak = 1;
            }
        }
        current.lastActiveDate = today;
    }

    const longest = Math.max(current.longestStreak || 0, streak);
    const daily = { ...(current.dailySeconds || {}) };
    daily[today] = (daily[today] || 0) + additionalSeconds;

    const updated: ReadingStats = {
        ...current,
        totalReadingSeconds: (current.totalReadingSeconds || 0) + additionalSeconds,
        totalLinesRead: (current.totalLinesRead || 0) + linesRead,
        currentStreak: streak,
        longestStreak: longest,
        lastActiveDate: today,
        dailySeconds: daily,
    };

    await db.put(STATS_STORE, updated);
    return updated;
}