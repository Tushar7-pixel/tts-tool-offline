// src/components/player/DesktopPlaybackDock.tsx
import React from "react";
import type { TtsEngineStatus } from "../../utils/tts";

interface DesktopPlaybackDockProps {
  speed: number;
  onSpeedChange: (speed: number) => void;
  isPlaying: boolean;
  engineStatus: TtsEngineStatus;
  voiceReady: boolean;
  currentPage: number;
  totalPages: number;
  currentLine: number;
  totalLines: number;
  onTogglePlay: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPrevLine: () => void;
  onNextLine: () => void;
}

export const DesktopPlaybackDock: React.FC<DesktopPlaybackDockProps> = ({
  speed,
  onSpeedChange,
  isPlaying,
  engineStatus,
  voiceReady,
  currentPage,
  totalPages,
  currentLine,
  totalLines,
  onTogglePlay,
  onPrevPage,
  onNextPage,
  onPrevLine,
  onNextLine,
}) => {
  return (
    <div className="border-t border-[var(--panel-border)] bg-[var(--app-bg)]/90 backdrop-blur px-3 py-2 sm:py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 z-20">
      <div className="flex items-center justify-between w-full sm:w-auto gap-3 px-2 sm:px-0 order-2 sm:order-1">
        <span className="text-[10px] app-muted uppercase tracking-wider font-bold">
          Speed
        </span>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={speed}
          onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
          className="w-full sm:w-20 accent-[var(--accent)] cursor-pointer h-1 rounded"
        />
        <span className="text-xs app-accent font-mono font-bold w-8 text-right tabular-nums">
          {speed.toFixed(1)}×
        </span>
      </div>

      <div className="flex items-center justify-center gap-4 sm:gap-6 order-1 sm:order-2 w-full sm:w-auto">
        <button
          onClick={onPrevPage}
          disabled={currentPage === 0}
          title="Previous Page"
          className="app-muted hover:text-[var(--app-text)] disabled:opacity-30 text-lg cursor-pointer transition flex items-center justify-center"
        >
          ⏮
        </button>
        <button
          onClick={onPrevLine}
          disabled={currentPage === 0 && currentLine === 0}
          title="Previous Line"
          className="app-muted hover:text-[var(--app-text)] disabled:opacity-30 text-lg cursor-pointer transition flex items-center justify-center"
        >
          ⏪
        </button>

        <button
          onClick={onTogglePlay}
          disabled={!voiceReady}
          className={`w-12 h-12 flex items-center justify-center rounded-full shadow-lg cursor-pointer transition shrink-0 ${
            isPlaying ? "app-pause" : "app-play"
          } disabled:opacity-25`}
          title="Play / Pause (Spacebar)"
        >
          {engineStatus !== "idle" ? (
            <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <span className="text-lg">⏸</span>
          ) : (
            <span className="text-lg ml-1">▶</span>
          )}
        </button>

        <button
          onClick={onNextLine}
          disabled={
            currentPage >= totalPages - 1 && currentLine >= totalLines - 1
          }
          title="Next Line"
          className="app-muted hover:text-[var(--app-text)] disabled:opacity-30 text-lg cursor-pointer transition flex items-center justify-center"
        >
          ⏩
        </button>
        <button
          onClick={onNextPage}
          disabled={currentPage >= totalPages - 1}
          title="Next Page"
          className="app-muted hover:text-[var(--app-text)] disabled:opacity-30 text-lg cursor-pointer transition flex items-center justify-center"
        >
          ⏭
        </button>
      </div>

      <div className="hidden sm:block w-[120px] order-3"></div>
    </div>
  );
};
