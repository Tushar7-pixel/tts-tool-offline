// src/hooks/useReader.ts
import { useState, useRef, useEffect } from 'react';
import { synthesize } from '../utils/tts';
import { updateBookProgress } from '../utils/db';

export function useReader(
    bookId: string | null,
    pages: string[][],
    initialPage: number,
    initialLine: number
) {
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [currentLine, setCurrentLine] = useState(initialLine);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState<number>(1.0);

    const audioRef = useRef<HTMLAudioElement | null>(new Audio());
    const speedRef = useRef<number>(1.0);
    const wakeLockRef = useRef<WakeLockSentinel | null>(null);

    // Keep ref synchronized so async playback always reads the active speed
    useEffect(() => {
        speedRef.current = speed;
        if (audioRef.current) {
            audioRef.current.playbackRate = speed;
        }
    }, [speed]);

    useEffect(() => {
        setCurrentPage(initialPage);
        setCurrentLine(initialLine);
    }, [bookId, initialPage, initialLine]);

    const requestWakeLock = async () => {
        if ('wakeLock' in navigator && !wakeLockRef.current) {
            try {
                wakeLockRef.current = await navigator.wakeLock.request('screen');
            } catch (e) {
                console.warn('Wake Lock request failed:', e);
            }
        }
    };

    const releaseWakeLock = async () => {
        if (wakeLockRef.current) {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
        }
    };

    const playLineAt = async (pageIdx: number, lineIdx: number) => {
        if (pageIdx >= pages.length) {
            setIsPlaying(false);
            await releaseWakeLock();
            return;
        }

        const pageLines = pages[pageIdx];
        if (lineIdx >= pageLines.length) {
            const nextPage = pageIdx + 1;
            if (nextPage < pages.length) {
                setCurrentPage(nextPage);
                setCurrentLine(0);
                if (bookId) updateBookProgress(bookId, nextPage, 0);
                playLineAt(nextPage, 0);
            } else {
                setIsPlaying(false);
                await releaseWakeLock();
            }
            return;
        }

        try {
            const lineText = pageLines[lineIdx];
            const blob = await synthesize(lineText);
            const url = URL.createObjectURL(blob);

            if (!audioRef.current) return;

            audioRef.current.src = url;
            // Re-apply current speed setting to new audio instance
            audioRef.current.playbackRate = speedRef.current;

            audioRef.current.onended = () => {
                URL.revokeObjectURL(url);
                const nextLine = lineIdx + 1;
                setCurrentLine(nextLine);
                if (bookId) updateBookProgress(bookId, pageIdx, nextLine);
                playLineAt(pageIdx, nextLine);
            };

            await audioRef.current.play();
        } catch (err) {
            console.error('Audio playback error:', err);
            setIsPlaying(false);
            await releaseWakeLock();
        }
    };

    const togglePlay = async () => {
        if (isPlaying) {
            audioRef.current?.pause();
            setIsPlaying(false);
            await releaseWakeLock();
        } else {
            setIsPlaying(true);
            await requestWakeLock();
            playLineAt(currentPage, currentLine);
        }
    };

    const jumpTo = (pageIdx: number, lineIdx: number = 0) => {
        if (audioRef.current) audioRef.current.pause();
        setCurrentPage(pageIdx);
        setCurrentLine(lineIdx);
        if (bookId) updateBookProgress(bookId, pageIdx, lineIdx);
        if (isPlaying) {
            playLineAt(pageIdx, lineIdx);
        }
    };

    return {
        currentPage,
        currentLine,
        isPlaying,
        speed,
        setSpeed,
        togglePlay,
        jumpTo,
    };
}