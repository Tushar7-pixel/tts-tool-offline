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
    <div className="border-t border-[var(--panel-border)] bg-[var(--app-bg)] px-4 py-2.5 flex items-center justify-between shrink-0 z-20 select-none">
      {/* Speed Slider */}
      <div className="flex items-center gap-3 w-48">
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
          className="w-20 accent-[var(--app-text)] cursor-pointer h-1 rounded"
        />
        <span className="text-xs font-mono font-bold tabular-nums text-[var(--app-text)]">
          {speed.toFixed(1)}×
        </span>
      </div>

      {/* Playback Controls (Clean Monochrome SVGs) */}
      <div className="flex items-center gap-4 sm:gap-6 text-[var(--app-text)]">
        {/* Previous Page */}
        <button
          type="button"
          onClick={onPrevPage}
          disabled={currentPage === 0}
          title="Previous Page"
          className="opacity-75 hover:opacity-100 disabled:opacity-20 cursor-pointer transition p-1.5 flex items-center justify-center"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>

        {/* Previous Line */}
        <button
          type="button"
          onClick={onPrevLine}
          disabled={currentPage === 0 && currentLine === 0}
          title="Previous Line"
          className="opacity-75 hover:opacity-100 disabled:opacity-20 cursor-pointer transition p-1.5 flex items-center justify-center"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
          </svg>
        </button>

        {/* Center Disc Button */}
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={!voiceReady}
          className={`w-11 h-11 flex items-center justify-center rounded-full shadow-sm cursor-pointer transition shrink-0 ${
            isPlaying ? "app-pause" : "app-play"
          } disabled:opacity-25 border border-[var(--panel-border)]`}
          title="Play / Pause"
        >
          {engineStatus !== "idle" ? (
            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Next Line */}
        <button
          type="button"
          onClick={onNextLine}
          disabled={
            currentPage >= totalPages - 1 && currentLine >= totalLines - 1
          }
          title="Next Line"
          className="opacity-75 hover:opacity-100 disabled:opacity-20 cursor-pointer transition p-1.5 flex items-center justify-center"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
          </svg>
        </button>

        {/* Next Page */}
        <button
          type="button"
          onClick={onNextPage}
          disabled={currentPage >= totalPages - 1}
          title="Next Page"
          className="opacity-75 hover:opacity-100 disabled:opacity-20 cursor-pointer transition p-1.5 flex items-center justify-center"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>
      </div>

      <div className="w-48" />
    </div>
  );
};
