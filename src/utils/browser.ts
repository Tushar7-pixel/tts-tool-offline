// src/utils/browser.ts

export function launchExternalUrl(url: string, useDuckDuckGoFallback = false) {
    let targetUrl = url;

    if (useDuckDuckGoFallback) {
        // Strips direct site tracking and avoids landing-page redirect traps
        const searchMatch = url.match(/[?&]s=([^&]+)/);
        const query = searchMatch ? decodeURIComponent(searchMatch[1]) : "";
        targetUrl = `https://duckduckgo.com/?q=${encodeURIComponent(`site:oceanofpdf.com ${query}`)}`;
    }

    const isAndroid = /android/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;

    // If installed as a PWA on Android, invoke Android Intent to kick it out to system browser
    if (isAndroid && isStandalone) {
        try {
            const parsed = new URL(targetUrl);
            const scheme = parsed.protocol.replace(":", "");
            const intentUri = `intent://${parsed.host}${parsed.pathname}${parsed.search}#Intent;scheme=${scheme};action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end`;

            window.location.href = intentUri;
            return;
        } catch {
            // Fallback to standard window.open on parsing failure
        }
    }

    // Desktop / standard browser tab
    window.open(targetUrl, "_blank", "noopener,noreferrer");
}