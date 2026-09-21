// src/utils/tts.worker.ts

import * as ort from "onnxruntime-web";
import * as piperTts from "@mintplex-labs/piper-tts-web";

/**
 * ONNX Runtime WASM configuration
 *
 * WASM multi-threading requires:
 *   - crossOriginIsolated === true
 *   - SharedArrayBuffer available
 *
 * Otherwise we safely fall back to one WASM thread.
 */

const canUseWasmThreads =
  typeof crossOriginIsolated !== "undefined" &&
  crossOriginIsolated &&
  typeof SharedArrayBuffer !== "undefined";

const hardwareThreads =
  typeof navigator !== "undefined" && navigator.hardwareConcurrency
    ? navigator.hardwareConcurrency
    : 2;

// Do not blindly use all CPU cores.
// Piper inference can become very heavy on mobile devices.
const wasmThreads = canUseWasmThreads
  ? Math.min(4, Math.max(1, hardwareThreads))
  : 1;

ort.env.wasm.numThreads = wasmThreads;
ort.env.wasm.wasmPaths = "/onnx-wasm/";

console.log("[TTS Worker] initialized", {
  crossOriginIsolated:
    typeof crossOriginIsolated !== "undefined"
      ? crossOriginIsolated
      : false,

  sharedArrayBuffer:
    typeof SharedArrayBuffer !== "undefined",

  hardwareThreads,

  wasmThreads,
});

let loadedPiperVoice: string | null = null;
let isProcessing = false;

/**
 * Piper keeps an internal TtsSession singleton.
 *
 * When changing voices, force Piper to recreate its session.
 */
function resetPiperSession() {
  try {
    const TtsSession = (piperTts as any).TtsSession;

    if (TtsSession) {
      TtsSession._instance = null;
    }
  } catch (error) {
    console.warn("[TTS Worker] Failed to reset Piper session:", error);
  }

  loadedPiperVoice = null;
}

/**
 * Give the browser a chance to release references/memory
 * before initializing a new Piper session.
 */
async function yieldForMemoryCleanup() {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

self.onmessage = async (event: MessageEvent) => {
  const {
    id,
    type,
    text,
    voiceId,
  } = event.data;

  if (type !== "SYNTHESIZE") {
    return;
  }

  if (isProcessing) {
    self.postMessage({
      id,
      type: "ERROR",
      error: "Worker busy",
    });

    return;
  }

  isProcessing = true;

  try {
    const cleanText = String(text || "").trim();
    const activeVoice = String(voiceId || "");

    if (!cleanText) {
      throw new Error("Cannot synthesize empty text");
    }

    if (!activeVoice) {
      throw new Error("No Piper voice selected");
    }

    const needsVoiceLoad = loadedPiperVoice !== activeVoice;

    if (needsVoiceLoad) {
      self.postMessage({
        type: "STATUS",
        status: "loading_voice",
      });

      resetPiperSession();

      await yieldForMemoryCleanup();
    }

    self.postMessage({
      type: "STATUS",
      status: "generating",
    });

    const blob = await piperTts.predict({
      text: cleanText,
      voiceId: activeVoice,
    });

    if (!blob) {
      throw new Error("Piper returned an empty audio blob");
    }

    loadedPiperVoice = activeVoice;

    self.postMessage({
      id,
      type: "SUCCESS",
      blob,
    });
  } catch (error: any) {
    const message =
      error?.message ||
      String(error) ||
      "Unknown TTS worker error";

    console.error("[TTS Worker] synthesis failed:", message);

    self.postMessage({
      id,
      type: "ERROR",
      error: message,
    });
  } finally {
    isProcessing = false;

    self.postMessage({
      type: "STATUS",
      status: "idle",
    });
  }
};