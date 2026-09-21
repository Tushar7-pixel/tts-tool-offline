// src/utils/tts.ts
import * as piperTts from "@mintplex-labs/piper-tts-web";
import { getSharedAudioContext } from "./backgroundAudio";

export const DEFAULT_PIPER_VOICE = "en_US-hfc_male-medium";

// Detect mobile device
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ""
  ) || (window.matchMedia && window.matchMedia("(max-width: 768px)").matches);
};

const IS_MOBILE = isMobileDevice();

export type TtsEngineStatus = "idle" | "loading_voice" | "generating";

const statusListeners = new Set<(status: TtsEngineStatus) => void>();
let currentStatus: TtsEngineStatus = "idle";

function updateGlobalStatus(nextStatus: TtsEngineStatus) {
  if (nextStatus !== currentStatus) {
    currentStatus = nextStatus;
    statusListeners.forEach((listener) => listener(currentStatus));
  }
}

export function subscribeTtsStatus(cb: (status: TtsEngineStatus) => void) {
  statusListeners.add(cb);
  cb(currentStatus);
  return () => {
    statusListeners.delete(cb);
  };
}

// -------------------------------------------------------------
// 1. MOBILE DIRECT IN-THREAD ENGINE (No Workers, No OPFS bug)
// -------------------------------------------------------------
let loadedMainThreadVoice: string | null = null;
let isMainThreadBusy = false;

async function synthesizeDirect(text: string, voiceId: string): Promise<Blob> {
  const activeVoice = voiceId || DEFAULT_PIPER_VOICE;
  const cleanText = text.trim();

  if (!cleanText) {
    return new Blob([], { type: "audio/wav" });
  }

  // Queue calls sequentially if busy
  while (isMainThreadBusy) {
    await new Promise((res) => setTimeout(res, 50));
  }

  isMainThreadBusy = true;
  updateGlobalStatus("generating");

  try {
    if (loadedMainThreadVoice !== activeVoice) {
      updateGlobalStatus("loading_voice");
      const TtsSession = (piperTts as any).TtsSession;
      if (TtsSession) TtsSession._instance = null;
    }

    const blob = await piperTts.predict({ text: cleanText, voiceId: activeVoice });
    loadedMainThreadVoice = activeVoice;
    return blob;
  } catch (err) {
    console.error("Main thread TTS synthesis error:", err);
    throw err;
  } finally {
    isMainThreadBusy = false;
    updateGlobalStatus("idle");
  }
}

// -------------------------------------------------------------
// 2. DESKTOP WORKER ENGINE (Unchanged)
// -------------------------------------------------------------
type PendingJob = {
  id: number;
  text: string;
  voiceId: string;
  resolve: (blob: Blob) => void;
  reject: (error: unknown) => void;
};

type WorkerState = {
  worker: Worker;
  busy: boolean;
  status: TtsEngineStatus;
};

let workers: WorkerState[] = [];
let nextMessageId = 0;
const jobQueue: PendingJob[] = [];
const activeJobs = new Map<number, { job: PendingJob; workerIndex: number }>();
let schedulingCursor = 0;

function findAvailableWorker(): number | null {
  if (workers.length === 0) return null;
  for (let offset = 0; offset < workers.length; offset++) {
    const index = (schedulingCursor + offset) % workers.length;
    if (!workers[index].busy) {
      schedulingCursor = (index + 1) % workers.length;
      return index;
    }
  }
  return null;
}

function dispatchJobs() {
  while (jobQueue.length > 0) {
    const workerIndex = findAvailableWorker();
    if (workerIndex === null) break;

    const job = jobQueue.shift()!;
    const workerState = workers[workerIndex];

    workerState.busy = true;
    workerState.status = "generating";
    activeJobs.set(job.id, { job, workerIndex });

    try {
      workerState.worker.postMessage({
        id: job.id,
        type: "SYNTHESIZE",
        text: job.text,
        voiceId: job.voiceId,
      });
    } catch (error) {
      activeJobs.delete(job.id);
      workerState.busy = false;
      workerState.status = "idle";
      job.reject(error);
    }
  }
}

function createWorker(index: number): WorkerState {
  const worker = new Worker(new URL("./tts.worker.ts", import.meta.url), {
    type: "module",
  });

  const state: WorkerState = {
    worker,
    busy: false,
    status: "idle",
  };

  worker.onmessage = (event: MessageEvent) => {
    const { id, type, blob, error, status } = event.data;

    if (type === "STATUS") {
      state.status = status;
      return;
    }

    if ((type === "SUCCESS" || type === "ERROR") && typeof id === "number") {
      const active = activeJobs.get(id);
      if (!active) return;

      activeJobs.delete(id);
      state.busy = false;
      state.status = "idle";

      if (type === "SUCCESS") {
        active.job.resolve(blob);
      } else {
        active.job.reject(new Error(error || "TTS synthesis failed"));
      }

      dispatchJobs();
    }
  };

  worker.onerror = (event) => {
    let failedJobId: number | null = null;
    for (const [id, active] of activeJobs.entries()) {
      if (active.workerIndex === index) {
        failedJobId = id;
        break;
      }
    }
    if (failedJobId !== null) {
      const active = activeJobs.get(failedJobId);
      if (active) {
        activeJobs.delete(failedJobId);
        active.job.reject(new Error(event.message || "TTS worker crashed"));
      }
    }
    state.busy = false;
    state.status = "idle";
    dispatchJobs();
  };

  return state;
}

function initWorkers() {
  if (IS_MOBILE) return; // Completely skip worker initialization on mobile

  if ((window as any).__echoread_tts_workers) {
    (window as any).__echoread_tts_workers.forEach((w: WorkerState) => {
      w.worker.onmessage = null;
      w.worker.onerror = null;
      w.worker.terminate();
    });
  }

  workers = [createWorker(0)];
  schedulingCursor = 0;
  (window as any).__echoread_tts_workers = workers;
}

initWorkers();

// -------------------------------------------------------------
// 3. PUBLIC API
// -------------------------------------------------------------
export function clearTTSQueue() {
  while (jobQueue.length > 0) {
    const job = jobQueue.shift()!;
    job.reject(new Error("Synthesis skipped due to page jump/pause"));
  }
}

export function cancelPendingSynthesis() {
  if (IS_MOBILE) {
    const TtsSession = (piperTts as any).TtsSession;
    if (TtsSession) TtsSession._instance = null;
    loadedMainThreadVoice = null;
    isMainThreadBusy = false;
    return;
  }

  while (jobQueue.length > 0) {
    const job = jobQueue.shift()!;
    job.reject(new Error("Synthesis cancelled due to voice switch"));
  }
  for (const [, active] of activeJobs) {
    active.job.reject(new Error("Synthesis cancelled due to voice switch"));
  }
  activeJobs.clear();

  for (const state of workers) {
    state.worker.onmessage = null;
    state.worker.onerror = null;
    state.worker.terminate();
  }
  workers = [];
  initWorkers();
}

export async function isVoiceInstalled(voiceId: string = DEFAULT_PIPER_VOICE): Promise<boolean> {
  try {
    const installed = await piperTts.stored();
    return installed.includes(voiceId);
  } catch {
    return false;
  }
}

export async function downloadVoice(
  targetId: string = DEFAULT_PIPER_VOICE,
  onProgress?: (pct: number) => void,
): Promise<void> {
  await piperTts.download(targetId, (progress) => {
    if (onProgress && progress.total) {
      onProgress(Math.round((progress.loaded * 100) / progress.total));
    }
  });
}

export async function synthesize(text: string, voiceId?: string): Promise<Blob> {
  // Mobile directly runs on the main thread
  if (IS_MOBILE) {
    return synthesizeDirect(text, voiceId || DEFAULT_PIPER_VOICE);
  }

  // Desktop runs via Web Worker
  const activeVoice = voiceId || DEFAULT_PIPER_VOICE;
  const cleanText = text.trim();

  if (!cleanText) {
    return new Blob([], { type: "audio/wav" });
  }

  return new Promise<Blob>((resolve, reject) => {
    const job: PendingJob = {
      id: ++nextMessageId,
      text: cleanText,
      voiceId: activeVoice,
      resolve,
      reject,
    };
    jobQueue.push(job);
    dispatchJobs();
  });
}

export async function playRawAudioBuffer() {
  const ctx = getSharedAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  const source = ctx.createBufferSource();
  source.connect(ctx.destination);
  source.start(0);
}