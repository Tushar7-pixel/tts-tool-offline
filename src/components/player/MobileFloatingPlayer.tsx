// src/components/player/MobileFloatingPlayer.tsx
import React, { useState } from "react";
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
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <>
      <div
        className={`fixed bottom-3 left-1/2 -translate-x-1/2 w-[92%] max-w-[400px] z-40 transition-all duration-300 ${
          navbarHidden
            ? "translate-y-28 opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100"
        }`}
      >
        {isMinimized ? (
          /* Minimized Compact Floating Pill */
          <div className="app-panel shadow-2xl rounded-full px-4 py-2 flex items-center justify-between border border-[var(--panel-border)] bg-[var(--panel-bg)]">
            <div className="flex items-center gap-2 truncate max-w-[190px]">
              <span className="w-2 h-2 rounded-full bg-[var(--app-text)] shrink-0 animate-pulse" />
              <div className="flex flex-col truncate">
                <span className="text-[11px] font-bold text-[var(--app-text)] truncate">
                  {title}
                </span>
                <span className="text-[9px] app-muted font-mono truncate">
                  {chapterTitle || `P.${currentPage + 1}`} • L.{currentLine + 1}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Play/Pause Button */}
              <button
                type="button"
                onClick={onTogglePlay}
                disabled={!voiceReady}
                className={`w-9 h-9 flex items-center justify-center rounded-full shadow-sm cursor-pointer transition ${
                  isPlaying ? "app-pause" : "app-play"
                } disabled:opacity-25 border border-[var(--panel-border)]`}
                title="Play / Pause"
              >
                {engineStatus !== "idle" ? (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg
                    className="w-3.5 h-3.5 fill-current ml-0.5"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Expand Button */}
              <button
                type="button"
                onClick={() => setIsMinimized(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full border border-[var(--control-border)] text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition font-bold"
                title="Expand playback controls"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
                </svg>
              </button>
            </div>
          </div>
        ) : (
          /* Full Mobile Player Card */
          <div className="app-panel shadow-2xl rounded-2xl p-3.5 flex flex-col gap-2.5 border border-[var(--panel-border)] bg-[var(--panel-bg)] relative">
            {/* Header + Minimize / Hide Button */}
            <div className="flex items-start justify-between gap-2 px-1">
              <div className="flex flex-col text-left truncate flex-1 pr-1">
                <h4 className="text-xs font-bold text-[var(--app-text)] truncate">
                  {title}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[10px] text-[var(--app-text)] opacity-80 font-mono truncate">
                    {chapterTitle || `Page ${currentPage + 1}`}
                  </p>
                  {timeLeftStr && (
                    <span className="px-1.5 py-0.2 rounded bg-black/5 dark:bg-white/10 text-[9px] uppercase font-bold tracking-wider opacity-80 font-mono">
                      {timeLeftStr}
                    </span>
                  )}
                </div>
              </div>

              {/* Hide / Minimize Button */}
              <button
                type="button"
                onClick={() => setIsMinimized(true)}
                className="p-1.5 rounded-md border border-[var(--control-border)] text-[var(--app-text)] hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer transition flex items-center justify-center shrink-0"
                title="Minimize player controls"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
                </svg>
              </button>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center justify-center gap-4 text-[var(--app-text)]">
              <button
                type="button"
                onClick={onPrevPage}
                disabled={currentPage === 0}
                className="opacity-75 hover:opacity-100 disabled:opacity-25 p-2 cursor-pointer transition flex items-center justify-center"
                title="Previous Page"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={onPrevLine}
                disabled={currentPage === 0 && currentLine === 0}
                className="opacity-75 hover:opacity-100 disabled:opacity-25 p-2 cursor-pointer transition flex items-center justify-center"
                title="Previous Line"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
                </svg>
              </button>

              {/* Center Play Button */}
              <button
                type="button"
                onClick={onTogglePlay}
                disabled={!voiceReady}
                className={`w-12 h-12 flex items-center justify-center rounded-full shadow-sm cursor-pointer transition shrink-0 ${
                  isPlaying ? "app-pause" : "app-play"
                } disabled:opacity-25 border border-[var(--panel-border)]`}
                title="Play / Pause"
              >
                {engineStatus !== "idle" ? (
                  <span className="inline-block w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 fill-current ml-0.5"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                onClick={onNextLine}
                disabled={
                  currentPage >= totalPages - 1 && currentLine >= totalLines - 1
                }
                className="opacity-75 hover:opacity-100 disabled:opacity-25 p-2 cursor-pointer transition flex items-center justify-center"
                title="Next Line"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
                </svg>
              </button>

              <button
                type="button"
                onClick={onNextPage}
                disabled={currentPage >= totalPages - 1}
                className="opacity-75 hover:opacity-100 disabled:opacity-25 p-2 cursor-pointer transition flex items-center justify-center"
                title="Next Page"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>
            </div>

            {/* Speed Control */}
            <div className="flex items-center justify-between gap-3 px-2 pt-1 border-t border-[var(--panel-border)]">
              <span className="text-[10px] app-muted uppercase tracking-wider font-bold font-mono">
                Speed
              </span>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speed}
                onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                className="flex-1 accent-[var(--app-text)] cursor-pointer h-1 rounded"
              />
              <span className="text-xs font-mono font-bold text-[var(--app-text)] w-8 text-right tabular-nums">
                {speed.toFixed(1)}×
              </span>
            </div>
          </div>
        )}
      </div>

      {navbarHidden && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button
            type="button"
            onClick={onShowControls}
            className="app-panel shadow-xl border border-[var(--panel-border)] px-4 py-2 rounded-full text-xs font-bold text-[var(--app-text)] flex items-center gap-1.5 cursor-pointer transition active:scale-95 hover:bg-[var(--btn-hover)] font-mono"
          >
            <span>👁</span>
            <span className="tracking-wide uppercase text-[10px]">
              Show Nav
            </span>
          </button>
        </div>
      )}
    </>
  );
};
