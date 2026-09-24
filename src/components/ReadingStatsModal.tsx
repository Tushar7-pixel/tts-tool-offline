// src/components/ReadingStatsModal.tsx
import React, { useEffect, useState } from "react";
import { getReadingStats, type ReadingStats, type BookDoc } from "../utils/db";

interface ReadingStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: BookDoc[];
}

export const ReadingStatsModal: React.FC<ReadingStatsModalProps> = ({
  isOpen,
  onClose,
  books,
}) => {
  const [stats, setStats] = useState<ReadingStats | null>(null);

  useEffect(() => {
    if (isOpen) {
      getReadingStats().then(setStats);
    }
  }, [isOpen]);

  if (!isOpen || !stats) return null;

  const totalMins = Math.round(stats.totalReadingSeconds / 60);
  const totalHours = (totalMins / 60).toFixed(1);

  // Today's reading time
  const todayStr = new Date().toISOString().split("T")[0];
  const todaySeconds = stats.dailySeconds?.[todayStr] || 0;
  const todayMins = Math.round(todaySeconds / 60);

  // Books stats
  const completedBooks = books.filter(
    (b) => b.totalPages > 0 && b.currentPage >= b.totalPages - 1,
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans"
      onClick={onClose}
    >
      <div
        className="app-panel w-full max-w-md rounded-2xl p-5 shadow-2xl border border-[var(--panel-border)] relative animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--panel-border)]">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h3 className="text-sm uppercase font-bold tracking-wider">
              Reading Stats & Streaks
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-xs font-bold transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Streak Highlight Card */}
        <div className="mt-4 p-4 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-400 text-black flex items-center justify-center text-2xl font-bold shadow-md">
              🔥
            </div>
            <div>
              <div className="text-2xl font-black text-amber-400 leading-none">
                {stats.currentStreak}{" "}
                {stats.currentStreak === 1 ? "Day" : "Days"}
              </div>
              <p className="text-[11px] font-bold opacity-80 mt-1 uppercase tracking-wide">
                Current Reading Streak
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold opacity-60 uppercase block">
              Best
            </span>
            <span className="text-sm font-bold text-[var(--accent)]">
              {stats.longestStreak} days
            </span>
          </div>
        </div>

        {/* Core Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div className="app-panel p-3 rounded-xl border border-[var(--panel-border)]">
            <span className="text-[10px] font-bold opacity-60 uppercase block">
              Today
            </span>
            <span className="text-xl font-black text-[var(--accent)]">
              {todayMins}m
            </span>
            <p className="text-[10px] opacity-70 mt-0.5">
              Listening time today
            </p>
          </div>

          <div className="app-panel p-3 rounded-xl border border-[var(--panel-border)]">
            <span className="text-[10px] font-bold opacity-60 uppercase block">
              Total Time
            </span>
            <span className="text-xl font-black text-[var(--accent)]">
              {totalHours}h
            </span>
            <p className="text-[10px] opacity-70 mt-0.5">
              {totalMins} total minutes
            </p>
          </div>

          <div className="app-panel p-3 rounded-xl border border-[var(--panel-border)]">
            <span className="text-[10px] font-bold opacity-60 uppercase block">
              Sentences
            </span>
            <span className="text-xl font-black text-[var(--accent)]">
              {stats.totalLinesRead}
            </span>
            <p className="text-[10px] opacity-70 mt-0.5">
              Lines narrated by Piper
            </p>
          </div>

          <div className="app-panel p-3 rounded-xl border border-[var(--panel-border)]">
            <span className="text-[10px] font-bold opacity-60 uppercase block">
              Finished
            </span>
            <span className="text-xl font-black text-[var(--accent)]">
              {completedBooks}
            </span>
            <p className="text-[10px] opacity-70 mt-0.5">
              Of {books.length} shelf books
            </p>
          </div>
        </div>

        {/* Motivational Footer */}
        <p className="text-[11px] text-center opacity-70 mt-4 border-t border-[var(--panel-border)] pt-3">
          {stats.currentStreak > 0
            ? "Keep the momentum going! Listen to a few lines daily to maintain your streak."
            : "Start listening today to begin your streak!"}
        </p>
      </div>
    </div>
  );
};
