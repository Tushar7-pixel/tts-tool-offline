# Piper PDF Reader

A lightweight, privacy-first, responsive web application that turns any PDF into an audiobook using local neural text-to-speech. Powered by [Piper TTS](https://github.com/rhasspy/piper) via ONNX Runtime WebAssembly, the entire voice synthesis and document parsing runs **100% client-side** inside the browser—no external backend, no API keys, and full offline support after initial setup.

---

## Features

- **In-Browser Neural TTS**: High-quality local voice synthesis using the Piper `en_US-hfc_male-medium` ONNX model.
- **Client-Side Document Parsing**: Uses `pdfjs-dist` to extract, clean, and chunk PDF text into manageable reading units on a page-by-page basis.
- **Stateful Library Tracking**: Stores uploaded books, parsed pages, total reading progress, and exact last-read sentence positions in IndexedDB.
- **Page Travel & Jump-to-Line**: Click any sentence to immediately jump playback to that section, with smooth auto-scroll to keep the active sentence in view.
- **Mobile-Ready & PWA Optimized**:
- Screen Wake Lock API integration to prevent phones from sleeping mid-sentence.
- Native MediaSession support for lock-screen play/pause/skip controls.
- Standalone installable PWA layout.

- **Dark Mode Terminal Aesthetic**: Focused, high-contrast UI built with Tailwind CSS and monospace typography.

---

## Architecture & Tech Stack

- **Framework**: React 18 / 19 + TypeScript (Vite)
- **Styling**: Tailwind CSS
- **TTS Engine**: `@mintplex-labs/piper-tts-web` + `onnxruntime-web` (WASM + SIMD)
- **PDF Engine**: `pdfjs-dist`
- **Database / Cache**: `idb` (IndexedDB) & Origin Private File System (OPFS) / CacheStorage
- **Deployment**: Vercel-ready with Cross-Origin Isolation headers (`COOP`/`COEP`)

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

1. **Clone the repository:**

```bash
git clone https://github.com/<YOUR_USERNAME>/piper-pdf-reader.git
cd piper-pdf-reader

```

2. **Install dependencies:**

```bash
npm install

```

3. **Start local development server:**

```bash
npm run dev

```

_Note: To test on a mobile device over the local network, run `npm run dev -- --host` and open the local HTTPS address displayed in your terminal._

---

## Deployment (Vercel)

WebAssembly multi-threading (`SharedArrayBuffer`) requires specific HTTP headers to enable browser Cross-Origin Isolation.

This repository includes a `vercel.json` file configured out of the box:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        },
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "credentialless"
        }
      ]
    }
  ]
}
```

### Deploying via Vercel CLI / Dashboard:

1. Push your repository to GitHub.
2. Import the project into your [Vercel Dashboard](https://vercel.com).
3. Keep default settings (Vite preset, `npm run build`, output directory `dist`).
4. Click **Deploy**.

---

## Usage Guide

1. **Download Voice Model**: On the first visit, click **"Load Voice"** in the top navigation bar. The app downloads the ~63MB `hfc_male` ONNX weights and stores them permanently in browser storage.
2. **Open a PDF**: Click **"Choose PDF"** to import any document. The app parses the text into pages and saves the book in your local shelf.
3. **Playback**:

- Hit **Play** to start continuous reading.
- Click any sentence directly to jump playback to that spot.
- Use **Prev / Next** controls to change pages manually.

4. **Resuming**: Your reading position (page and line) is automatically saved to IndexedDB. Reopening the app or selecting a previously loaded book from the shelf restores your exact position.

---

## License

MIT License. Feel free to modify and use for your personal reading workflows.
