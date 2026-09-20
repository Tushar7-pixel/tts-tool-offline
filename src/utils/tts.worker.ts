// src/utils/tts.worker.ts
import * as ort from "onnxruntime-web";
import * as piperTts from "@mintplex-labs/piper-tts-web";
// Cap internal WASM threads to prevent the browser from freezing
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = "/onnx-wasm/";


let loadedPiperVoice: string | null = null;
let isProcessing = false;

function resetPiperSession() {
  const TtsSession = (piperTts as any).TtsSession;
  if (TtsSession) {
    TtsSession._instance = null;
  }
  loadedPiperVoice = null;
}

async function yieldForMemoryCleanup() {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

self.onmessage = async (event: MessageEvent) => {
  const { id, type, text, voiceId } = event.data;

  if (type !== "SYNTHESIZE") return;

  if (isProcessing) {
    self.postMessage({ id, type: "ERROR", error: "Worker busy" });
    return;
  }

  isProcessing = true;

  try {
    const needsVoiceLoad = loadedPiperVoice !== voiceId;

    if (needsVoiceLoad) {
      self.postMessage({ type: "STATUS", status: "loading_voice" });
      resetPiperSession();
      await yieldForMemoryCleanup();
    }

    self.postMessage({ type: "STATUS", status: "generating" });

    const blob = await piperTts.predict({ text, voiceId });
    loadedPiperVoice = voiceId;

    self.postMessage({ id, type: "SUCCESS", blob });
  } catch (error: any) {
    self.postMessage({
      id,
      type: "ERROR",
      error: error?.message || String(error),
    });
  } finally {
    isProcessing = false;
    self.postMessage({ type: "STATUS", status: "idle" });
  }
};