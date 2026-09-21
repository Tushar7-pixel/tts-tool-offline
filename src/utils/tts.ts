// src/utils/tts.ts
import * as piperTts from "@mintplex-labs/piper-tts-web";
import { getSharedAudioContext } from "./backgroundAudio";

export const DEFAULT_PIPER_VOICE = "en_US-hfc_male-medium";

export type TtsEngineStatus = "idle" | "loading_voice" | "generating";

const statusListeners = new Set<(status: TtsEngineStatus) => void>();
let currentStatus: TtsEngineStatus = "idle";

export function subscribeTtsStatus(cb: (status: TtsEngineStatus) => void) {
  statusListeners.add(cb);
  cb(currentStatus);
  return () => {
    statusListeners.delete(cb);
  };
}

// CRITICAL FIX: Limit outer worker to 1. 
// ONNX handles internal multithreading. Multiple outer workers duplicate model RAM.
const WORKER_COUNT = 1;

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

function updateGlobalStatus() {
  let nextStatus: TtsEngineStatus = "idle";

  if (workers.some((worker) => worker.status === "loading_voice")) {
    nextStatus = "loading_voice";
  } else if (workers.some((worker) => worker.status === "generating")) {
    nextStatus = "generating";
  } else if (activeJobs.size > 0) {
    nextStatus = "generating";
  }

  if (nextStatus !== currentStatus) {
    currentStatus = nextStatus;
    statusListeners.forEach((listener) => {
      listener(currentStatus);
    });
  }
}

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
    updateGlobalStatus();

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
      updateGlobalStatus();
    }
  }
  updateGlobalStatus();
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
      updateGlobalStatus();
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
      updateGlobalStatus();
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
    updateGlobalStatus();
  };

  return state;
}

function initWorkers() {
  // CRITICAL FIX: Kill orphaned Web Workers caused by React Fast Refresh (HMR)
  if ((window as any).__echoread_tts_workers) {
    (window as any).__echoread_tts_workers.forEach((w: WorkerState) => {
      w.worker.onmessage = null;
      w.worker.onerror = null;
      w.worker.terminate();
    });
  }

  workers = [];
  for (let i = 0; i < WORKER_COUNT; i++) {
    workers.push(createWorker(i));
  }
  schedulingCursor = 0;
  updateGlobalStatus();

  // Register the new active workers globally for the next potential HMR reload
  (window as any).__echoread_tts_workers = workers;
}
initWorkers();

export function clearTTSQueue() {
  while (jobQueue.length > 0) {
    const job = jobQueue.shift()!;
    job.reject(new Error("Synthesis skipped due to page jump/pause"));
  }
  updateGlobalStatus();
}

export function cancelPendingSynthesis() {
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