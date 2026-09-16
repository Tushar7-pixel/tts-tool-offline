// src/utils/tts.ts
import * as ort from 'onnxruntime-web';
import * as tts from '@mintplex-labs/piper-tts-web';
import { getSharedAudioContext } from './backgroundAudio';
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

export async function playRawAudioBuffer(audioData: Float32Array | AudioBuffer) {
    const ctx = getSharedAudioContext();
    
    // AudioContext MUST be running
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  
    // Create source and play as normal
    const source = ctx.createBufferSource();
    // ... bind buffer and connect to ctx.destination
    source.connect(ctx.destination);
    source.start(0);
  }