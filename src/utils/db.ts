// src/utils/db.ts
import { openDB } from 'idb';

const DB_NAME = 'PiperBookLibraryDB';
const STORE_NAME = 'books';

export type BookDoc = {
    id: string;
    title: string;
    pages: string[][]; // Array of pages, each containing an array of sentence lines
    totalPages: number;
    currentPage: number;
    currentLine: number;
    updatedAt: number;
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
// In src/utils/db.ts
export async function deleteBook(id: string): Promise<void> {
    const db = await getDB();
    await db.delete(STORE_NAME, id);
}