// src/utils/tts.ts
import * as ort from 'onnxruntime-web';
import * as tts from '@mintplex-labs/piper-tts-web';

// Point WASM binary paths to your local public assets
ort.env.wasm.wasmPaths = '/onnx-wasm/';

// Fallback: If you do not want SharedArrayBuffer/threads, force single-threaded execution:
// ort.env.wasm.numThreads = 1;

export const VOICE_ID = 'en_US-hfc_male-medium';

export async function isVoiceInstalled(): Promise<boolean> {
    try {
        const installed = await tts.stored();
        return installed.includes(VOICE_ID);
    } catch {
        return false;
    }
}

export async function downloadVoice(onProgress?: (pct: number) => void): Promise<void> {
    await tts.download(VOICE_ID, (progress) => {
        if (onProgress && progress.total) {
            onProgress(Math.round((progress.loaded * 100) / progress.total));
        }
    });
}

export async function synthesize(text: string): Promise<Blob> {
    return await tts.predict({
        text,
        voiceId: VOICE_ID,
    });
}