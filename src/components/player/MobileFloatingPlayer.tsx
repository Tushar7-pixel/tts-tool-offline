// src/components/player/MobileFloatingPlayer.tsx
import React from "react";
import type { TtsEngineStatus } from "../../utils/tts";

interface MobileFloatingPlayerProps {
  title: string;
  chapterTitle?: string;
  timeLeftStr: string;
  navbarHidden: boolean;
  isPlaying: boolean;
  engineStatus: TtsEngineStatus;
  voiceReady: boolean;
  speed: number;
  currentPage: number;
  totalPages: number;
  currentLine: number;
  totalLines: number;
  onSpeedChange: (speed: number) => void;
  onTogglePlay: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPrevLine: () => void;
  onNextLine: () => void;
  onShowControls: () => void;
}

export const MobileFloatingPlayer: React.FC<MobileFloatingPlayerProps> = ({
  title,
  chapterTitle,
  timeLeftStr,
  navbarHidden,
  isPlaying,
  engineStatus,
  voiceReady,
  speed,
  currentPage,
  totalPages,
  currentLine,
  totalLines,
  onSpeedChange,
  onTogglePlay,
  onPrevPage,
  onNextPage,
  onPrevLine,
  onNextLine,
  onShowControls,
}) => {
  return (
    <>
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 w-[92%] max-w-[400px] z-40 transition-all duration-300 ${
          navbarHidden
            ? "translate-y-24 opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100"
        }`}
      >
        <div className="app-panel shadow-2xl rounded-3xl p-4 flex flex-col gap-3 border border-[var(--panel-border)] backdrop-blur-xl bg-opacity-95 dark:bg-opacity-95">
          <div className="flex flex-col items-center text-center px-4">
            <h4 className="text-sm font-bold text-[var(--app-text)] truncate w-full">
              {title}
            </h4>
            <div className="flex items-center gap-2 mt-0.5 justify-center w-full">
              <p className="text-[11px] text-[var(--accent)] font-semibold truncate">
                {chapterTitle || `Page ${currentPage + 1}`}
              </p>
              <span className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[9px] uppercase font-bold tracking-wider opacity-80">
                {timeLeftStr}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 sm:gap-4 mt-1 text-[var(--app-text)]">
            <button
              onClick={onPrevPage}
              disabled={currentPage === 0}
              className="opacity-75 hover:opacity-100 disabled:opacity-30 p-2 cursor-pointer transition flex items-center justify-center"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>
            <button
              onClick={onPrevLine}
              disabled={currentPage === 0 && currentLine === 0}
              className="opacity-75 hover:opacity-100 disabled:opacity-30 p-2 cursor-pointer transition flex items-center justify-center"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
              </svg>
            </button>

            <button
              onClick={onTogglePlay}
              disabled={!voiceReady}
              className={`w-14 h-14 flex items-center justify-center rounded-full shadow-lg cursor-pointer transition shrink-0 ${
                isPlaying ? "app-pause" : "app-play"
              } disabled:opacity-25 border border-[var(--panel-border)]`}
            >
              {engineStatus !== "idle" ? (
                <span className="inline-block w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isPlaying ? (
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 fill-current ml-0.5"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            <button
              onClick={onNextLine}
              disabled={
                currentPage >= totalPages - 1 && currentLine >= totalLines - 1
              }
              className="opacity-75 hover:opacity-100 disabled:opacity-30 p-2 cursor-pointer transition flex items-center justify-center"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
              </svg>
            </button>
            <button
              onClick={onNextPage}
              disabled={currentPage >= totalPages - 1}
              className="opacity-75 hover:opacity-100 disabled:opacity-30 p-2 cursor-pointer transition flex items-center justify-center"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 px-3 mt-1">
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
              className="flex-1 accent-[var(--accent)] cursor-pointer h-1 rounded"
            />
            <span className="text-xs app-accent font-mono font-bold w-8 text-right tabular-nums">
              {speed.toFixed(1)}×
            </span>
          </div>
        </div>
      </div>

      {navbarHidden && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
          <button
            onClick={onShowControls}
            className="app-panel shadow-2xl border border-[var(--panel-border)] backdrop-blur-xl bg-opacity-90 dark:bg-opacity-90 px-5 py-2.5 rounded-full text-xs font-bold text-[var(--app-text)] flex items-center gap-2 cursor-pointer transition active:scale-95 hover:bg-[var(--btn-hover)]"
          >
            <span className="text-[14px]">👀</span>
            <span className="tracking-wide uppercase text-[10px]">
              Show Controls
            </span>
          </button>
        </div>
      )}
    </>
  );
};
