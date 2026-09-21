// src/utils/tts.ts

import * as piperTts from "@mintplex-labs/piper-tts-web";
import { getSharedAudioContext } from "./backgroundAudio";

export const DEFAULT_PIPER_VOICE = "en_US-hfc_male-medium";

/**
 * -------------------------------------------------------------
 * RUNTIME CAPABILITY DETECTION
 * -------------------------------------------------------------
 *
 * We do NOT decide based on "mobile" vs "desktop".
 *
 * A modern Android phone can run Web Workers perfectly well.
 * What matters is whether this browser can run the TTS engine
 * in a Worker.
 */

export type TtsRuntimeCapabilities = {
  worker: boolean;
  wasm: boolean;
  sharedArrayBuffer: boolean;
  crossOriginIsolated: boolean;
  wasmThreads: boolean;
  hardwareConcurrency: number;
};

export function getTtsRuntimeCapabilities(): TtsRuntimeCapabilities {
  const worker =
    typeof Worker !== "undefined";

  const wasm =
    typeof WebAssembly !== "undefined";

  const sharedArrayBuffer =
    typeof SharedArrayBuffer !== "undefined";

  const crossOriginIsolated =
    typeof window !== "undefined" &&
    window.crossOriginIsolated === true;

  const hardwareConcurrency =
    typeof navigator !== "undefined" &&
      navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 2;

  return {
    worker,
    wasm,
    sharedArrayBuffer,
    crossOriginIsolated,
    wasmThreads:
      crossOriginIsolated && sharedArrayBuffer,
    hardwareConcurrency,
  };
}

/**
 * Keep this export because other parts of the app may still use it.
 *
 * IMPORTANT:
 * This is now only device information.
 * It is NOT used to decide whether TTS should use Workers.
 */
export const isMobileDevice = (): boolean => {
  if (typeof navigator === "undefined") {
    return false;
  }

  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent || ""
    ) ||
    (typeof window !== "undefined" &&
      !!window.matchMedia &&
      window.matchMedia("(max-width: 768px)").matches)
  );
};

export type TtsEngineStatus =
  | "idle"
  | "loading_voice"
  | "generating";

const statusListeners = new Set<
  (status: TtsEngineStatus) => void
>();

let currentStatus: TtsEngineStatus = "idle";

function updateGlobalStatus(
  nextStatus: TtsEngineStatus
) {
  if (nextStatus !== currentStatus) {
    currentStatus = nextStatus;

    statusListeners.forEach((listener) => {
      try {
        listener(currentStatus);
      } catch {
        // Never allow a UI listener to break TTS.
      }
    });
  }
}

export function subscribeTtsStatus(
  cb: (status: TtsEngineStatus) => void
) {
  statusListeners.add(cb);

  cb(currentStatus);

  return () => {
    statusListeners.delete(cb);
  };
}

/**
 * -------------------------------------------------------------
 * DIRECT / MAIN THREAD FALLBACK
 * -------------------------------------------------------------
 *
 * This is ONLY a fallback.
 *
 * We don't intentionally send mobile devices here anymore.
 */

let loadedMainThreadVoice: string | null = null;
let isMainThreadBusy = false;

/**
 * Used to invalidate old direct synthesis requests.
 *
 * We intentionally DO NOT set isMainThreadBusy = false while
 * Piper is still running. Doing that could allow two Piper
 * sessions to run concurrently and corrupt the internal session.
 */
let directGeneration = 0;

async function synthesizeDirect(
  text: string,
  voiceId: string
): Promise<Blob> {
  const activeVoice =
    voiceId || DEFAULT_PIPER_VOICE;

  const cleanText = text.trim();

  if (!cleanText) {
    return new Blob([], {
      type: "audio/wav",
    });
  }

  /**
   * Wait until the previous direct inference has completely
   * finished.
   */
  while (isMainThreadBusy) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
  }

  isMainThreadBusy = true;

  const generation = directGeneration;

  updateGlobalStatus("generating");

  try {
    if (loadedMainThreadVoice !== activeVoice) {
      updateGlobalStatus("loading_voice");

      try {
        const TtsSession = (piperTts as any).TtsSession;

        if (TtsSession) {
          TtsSession._instance = null;
        }
      } catch (error) {
        console.warn(
          "[TTS] Failed to reset direct Piper session:",
          error
        );
      }

      loadedMainThreadVoice = null;
    }

    const blob = await piperTts.predict({
      text: cleanText,
      voiceId: activeVoice,
    });

    /**
     * The request may have been cancelled while Piper was
     * generating.
     *
     * We cannot truly abort Piper.predict(), but we can prevent
     * the result from being treated as current.
     */
    if (generation !== directGeneration) {
      throw new Error(
        "TTS synthesis cancelled"
      );
    }

    if (!blob) {
      throw new Error(
        "Piper returned an empty audio blob"
      );
    }

    loadedMainThreadVoice = activeVoice;

    return blob;
  } catch (error: any) {
    const message =
      error?.message ||
      String(error);

    console.error(
      "[TTS] Direct synthesis failed:",
      message
    );

    /**
     * Some versions of Piper/OPFS can report errors such as:
     *
     * "Entry not found"
     * "Unable to read getDirectory"
     *
     * We reset Piper's session so the next request has a clean
     * session.
     *
     * We don't automatically download again here because an
     * OPFS problem may be an actual browser/platform problem.
     */
    if (
      message.includes("Entry not found") ||
      message.includes("getDirectory")
    ) {
      try {
        const TtsSession =
          (piperTts as any).TtsSession;

        if (TtsSession) {
          TtsSession._instance = null;
        }
      } catch {
        // Ignore cleanup errors.
      }

      loadedMainThreadVoice = null;
    }

    throw error;
  } finally {
    isMainThreadBusy = false;

    updateGlobalStatus("idle");
  }
}

/**
 * -------------------------------------------------------------
 * WORKER ENGINE
 * -------------------------------------------------------------
 */

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

const activeJobs = new Map<
  number,
  {
    job: PendingJob;
    workerIndex: number;
  }
>();

let schedulingCursor = 0;

/**
 * Worker availability is based on browser capabilities,
 * NOT mobile/desktop detection.
 */
const runtimeCapabilities =
  getTtsRuntimeCapabilities();

let workerEngineAvailable =
  runtimeCapabilities.worker &&
  runtimeCapabilities.wasm;

console.log("[TTS] Runtime capabilities:", {
  ...runtimeCapabilities,
  workerEngineAvailable,
});

/**
 * -------------------------------------------------------------
 * WORKER MANAGEMENT
 * -------------------------------------------------------------
 */

function findAvailableWorker(): number | null {
  if (workers.length === 0) {
    return null;
  }

  for (
    let offset = 0;
    offset < workers.length;
    offset++
  ) {
    const index =
      (schedulingCursor + offset) %
      workers.length;

    if (!workers[index].busy) {
      schedulingCursor =
        (index + 1) % workers.length;

      return index;
    }
  }

  return null;
}

function dispatchJobs() {
  while (jobQueue.length > 0) {
    const workerIndex =
      findAvailableWorker();

    if (workerIndex === null) {
      break;
    }

    const job = jobQueue.shift()!;

    const workerState =
      workers[workerIndex];

    workerState.busy = true;
    workerState.status = "generating";

    activeJobs.set(job.id, {
      job,
      workerIndex,
    });

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

function createWorker(
  index: number
): WorkerState {
  const worker = new Worker(
    new URL(
      "./tts.worker.ts",
      import.meta.url
    ),
    {
      type: "module",
    }
  );

  const state: WorkerState = {
    worker,
    busy: false,
    status: "idle",
  };

  worker.onmessage = (
    event: MessageEvent
  ) => {
    const {
      id,
      type,
      blob,
      error,
      status,
    } = event.data;

    /**
     * Worker status messages don't have a job ID.
     */
    if (type === "STATUS") {
      state.status = status;

      if (status === "loading_voice") {
        updateGlobalStatus(
          "loading_voice"
        );
      } else if (status === "generating") {
        updateGlobalStatus(
          "generating"
        );
      }

      return;
    }

    if (
      (type === "SUCCESS" ||
        type === "ERROR") &&
      typeof id === "number"
    ) {
      const active =
        activeJobs.get(id);

      if (!active) {
        return;
      }

      activeJobs.delete(id);

      state.busy = false;
      state.status = "idle";

      if (type === "SUCCESS") {
        active.job.resolve(blob);
      } else {
        active.job.reject(
          new Error(
            error ||
            "TTS synthesis failed"
          )
        );
      }

      dispatchJobs();

      if (
        activeJobs.size === 0 &&
        jobQueue.length === 0
      ) {
        updateGlobalStatus("idle");
      }
    }
  };

  worker.onerror = (
    event: ErrorEvent
  ) => {
    let failedJobId: number | null =
      null;

    for (
      const [
        id,
        active,
      ] of activeJobs.entries()
    ) {
      if (
        active.workerIndex === index
      ) {
        failedJobId = id;
        break;
      }
    }

    if (failedJobId !== null) {
      const active =
        activeJobs.get(
          failedJobId
        );

      if (active) {
        activeJobs.delete(
          failedJobId
        );

        active.job.reject(
          new Error(
            event.message ||
            "TTS worker crashed"
          )
        );
      }
    }

    state.busy = false;
    state.status = "idle";

    /**
     * Don't immediately disable the whole worker engine.
     *
     * The caller can fall back to direct synthesis if the
     * individual worker request fails.
     */
    dispatchJobs();

    if (
      activeJobs.size === 0 &&
      jobQueue.length === 0
    ) {
      updateGlobalStatus("idle");
    }
  };

  return state;
}

function terminateWorkers() {
  for (const state of workers) {
    state.worker.onmessage = null;
    state.worker.onerror = null;

    try {
      state.worker.terminate();
    } catch {
      // Ignore termination errors.
    }
  }

  workers = [];

  schedulingCursor = 0;

  if (
    typeof window !== "undefined"
  ) {
    (
      window as any
    ).__echoread_tts_workers = [];
  }
}

function initWorkers(): boolean {
  if (!workerEngineAvailable) {
    return false;
  }

  try {
    terminateWorkers();

    /**
     * ONE worker intentionally.
     *
     * The worker itself may use multiple WASM threads when
     * crossOriginIsolated is available.
     *
     * This is much safer than:
     *
     *   2 workers × 4 WASM threads
     *
     * which can destroy performance on phones.
     */
    workers = [
      createWorker(0),
    ];

    schedulingCursor = 0;

    if (
      typeof window !== "undefined"
    ) {
      (
        window as any
      ).__echoread_tts_workers =
        workers;
    }

    return true;
  } catch (error) {
    console.error(
      "[TTS] Failed to initialize worker:",
      error
    );

    terminateWorkers();

    workerEngineAvailable = false;

    return false;
  }
}

/**
 * Initialize at module load.
 */
initWorkers();

/**
 * -------------------------------------------------------------
 * PUBLIC QUEUE CONTROL
 * -------------------------------------------------------------
 */

export function clearTTSQueue() {
  while (jobQueue.length > 0) {
    const job =
      jobQueue.shift()!;

    job.reject(
      new Error(
        "Synthesis skipped due to page jump/pause"
      )
    );
  }

  updateGlobalStatus("idle");
}

/**
 * Cancel active worker requests.
 *
 * Worker jobs cannot safely be "aborted" from Piper itself,
 * so we terminate the workers.
 */
export function cancelPendingSynthesis() {
  /**
   * Invalidate direct/main-thread synthesis.
   *
   * IMPORTANT:
   * We don't set isMainThreadBusy=false here.
   *
   * Piper.predict() may still be running.
   */
  directGeneration++;

  /**
   * Reject queued worker jobs.
   */
  while (jobQueue.length > 0) {
    const job =
      jobQueue.shift()!;

    job.reject(
      new Error(
        "Synthesis cancelled"
      )
    );
  }

  /**
   * Reject currently active worker jobs.
   */
  for (
    const [, active] of
    activeJobs
  ) {
    active.job.reject(
      new Error(
        "Synthesis cancelled"
      )
    );
  }

  activeJobs.clear();

  /**
   * Recreate workers.
   */
  if (workerEngineAvailable) {
    terminateWorkers();

    initWorkers();
  }

  updateGlobalStatus("idle");
}

/**
 * -------------------------------------------------------------
 * VOICE STORAGE
 * -------------------------------------------------------------
 */

export async function isVoiceInstalled(
  voiceId: string =
    DEFAULT_PIPER_VOICE
): Promise<boolean> {
  try {
    const installed =
      await piperTts.stored();

    return installed.includes(
      voiceId
    );
  } catch (error) {
    console.error(
      "[TTS] Unable to inspect installed voices:",
      error
    );

    return false;
  }
}

export async function downloadVoice(
  targetId: string =
    DEFAULT_PIPER_VOICE,
  onProgress?: (
    pct: number
  ) => void
): Promise<void> {
  await piperTts.download(
    targetId,
    (progress) => {
      if (
        onProgress &&
        progress.total
      ) {
        onProgress(
          Math.round(
            (progress.loaded * 100) /
            progress.total
          )
        );
      }
    }
  );
}

/**
 * -------------------------------------------------------------
 * SYNTHESIS
 * -------------------------------------------------------------
 */

function synthesizeWithWorker(
  text: string,
  voiceId: string
): Promise<Blob> {
  return new Promise<Blob>(
    (resolve, reject) => {
      if (
        workers.length === 0
      ) {
        reject(
          new Error(
            "TTS worker engine unavailable"
          )
        );

        return;
      }

      const job: PendingJob = {
        id: ++nextMessageId,
        text,
        voiceId,
        resolve,
        reject,
      };

      jobQueue.push(job);

      dispatchJobs();
    }
  );
}

export async function synthesize(
  text: string,
  voiceId?: string
): Promise<Blob> {
  const activeVoice =
    voiceId ||
    DEFAULT_PIPER_VOICE;

  const cleanText =
    text.trim();

  if (!cleanText) {
    return new Blob([], {
      type: "audio/wav",
    });
  }

  /**
   * PRIMARY PATH:
   *
   * Worker works on desktop AND mobile.
   */
  if (
    workerEngineAvailable &&
    workers.length > 0
  ) {
    try {
      return await synthesizeWithWorker(
        cleanText,
        activeVoice
      );
    } catch (error: any) {
      const message =
        error?.message ||
        String(error);

      console.warn(
        "[TTS] Worker synthesis failed:",
        message
      );

      /**
       * The worker might fail because of:
       *
       * - OPFS implementation
       * - browser Worker restrictions
       * - Piper initialization
       * - WASM loading
       *
       * Try the direct path once.
       *
       * This is especially useful on mobile browsers.
       */
      try {
        return await synthesizeDirect(
          cleanText,
          activeVoice
        );
      } catch (directError) {
        console.error(
          "[TTS] Direct fallback also failed:",
          directError
        );

        throw directError;
      }
    }
  }

  /**
   * FALLBACK:
   *
   * Browser has no usable Worker.
   */
  return synthesizeDirect(
    cleanText,
    activeVoice
  );
}

/**
 * -------------------------------------------------------------
 * AUDIO
 * -------------------------------------------------------------
 */

export async function playRawAudioBuffer() {
  const ctx =
    getSharedAudioContext();

  if (
    ctx.state === "suspended"
  ) {
    await ctx.resume();
  }

  const source =
    ctx.createBufferSource();

  source.connect(
    ctx.destination
  );

  source.start(0);
}