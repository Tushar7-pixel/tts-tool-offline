// src/utils/browser.ts

export type BookPlatform = "ocean" | "archive" | "openlibrary";

export function buildBookPlatformUrl(
    platform: BookPlatform,
    title: string,
    author?: string,
    openLibraryKey?: string
): string {
    const query = (author ? `${title} ${author}` : title).trim();
    const encodedQuery = encodeURIComponent(query);

    switch (platform) {
        case "ocean":
            return `https://oceanofpdf.com/?s=${encodedQuery}`;

        case "archive":
            return `https://archive.org/search?query=${encodedQuery}&and[]=mediatype%3A"texts"`;

        case "openlibrary":
            if (openLibraryKey) {
                return `https://openlibrary.org${openLibraryKey}`;
            }
            return `https://openlibrary.org/search?q=${encodedQuery}&mode=everything`;
    }
}

export function openExternalUrl(targetUrl: string): void {
    const isAndroid = /android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

    // On Android standalone PWAs, invoke the Android intent scheme
    // so the default external browser (Brave / Chrome) takes over
    if (isAndroid && isStandalone) {
        try {
            const parsed = new URL(targetUrl);
            const scheme = parsed.protocol.replace(":", "");
            const intentUri = `intent://${parsed.host}${parsed.pathname}${parsed.search}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;

            window.location.href = intentUri;
            return;
        } catch {
            // Fallback below
        }
    }

    // Desktop or standard browser tabs
    window.open(targetUrl, "_blank", "noopener,noreferrer");
}

export function openBookInPlatform(
    platform: BookPlatform,
    title: string,
    author?: string,
    openLibraryKey?: string
): void {
    const url = buildBookPlatformUrl(platform, title, author, openLibraryKey);
    openExternalUrl(url);
}