// src/hooks/useTextSelection.ts
import { useState, useEffect, useCallback, useRef } from "react";

export type SelectionData = {
    rect: DOMRect;
    text: string;
    lineEntries: { lineIdx: number; text: string }[];
};

export function useTextSelection() {
    const [selectionParams, setSelectionParams] = useState<SelectionData | null>(null);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const toolbarRef = useRef<HTMLDivElement | null>(null);
    const isSelectingRef = useRef(false);
    const touchStartPos = useRef<{ x: number; y: number } | null>(null);

    const clearSelection = useCallback(() => {
        try {
            window.getSelection()?.removeAllRanges();
        } catch { }
        setSelectionParams(null);
        setShowColorPicker(false);
    }, []);

    const evaluateSelection = useCallback(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
            setSelectionParams(null);
            setShowColorPicker(false);
            return;
        }

        const fullSelectedText = sel.toString().trim();
        // Ignore single stray tap selections or empty whitespace
        if (!fullSelectedText || fullSelectedText.length === 0) {
            setSelectionParams(null);
            setShowColorPicker(false);
            return;
        }

        const range = sel.getRangeAt(0);
        const startLineEl = (
            range.startContainer.nodeType === Node.ELEMENT_NODE
                ? (range.startContainer as Element)
                : range.startContainer.parentElement
        )?.closest(".reader-line");
        const endLineEl = (
            range.endContainer.nodeType === Node.ELEMENT_NODE
                ? (range.endContainer as Element)
                : range.endContainer.parentElement
        )?.closest(".reader-line");

        if (!startLineEl || !endLineEl) {
            setSelectionParams(null);
            setShowColorPicker(false);
            return;
        }

        const startIdx = parseInt(startLineEl.id.replace("reader-line-", ""), 10);
        const endIdx = parseInt(endLineEl.id.replace("reader-line-", ""), 10);
        const minIdx = Math.min(startIdx, endIdx);
        const maxIdx = Math.max(startIdx, endIdx);

        const lineEntries: { lineIdx: number; text: string }[] = [];

        for (let i = minIdx; i <= maxIdx; i++) {
            const lineEl = document.getElementById(`reader-line-${i}`);
            if (!lineEl) continue;

            const lineText = lineEl.textContent || "";
            if (!lineText) continue;

            const lineRange = document.createRange();
            lineRange.selectNodeContents(lineEl);

            const testRange = range.cloneRange();
            if (
                testRange.compareBoundaryPoints(Range.START_TO_END, lineRange) > 0 &&
                testRange.compareBoundaryPoints(Range.END_TO_START, lineRange) < 0
            ) {
                const subRange = document.createRange();
                if (testRange.compareBoundaryPoints(Range.START_TO_START, lineRange) <= 0) {
                    subRange.setStart(lineRange.startContainer, lineRange.startOffset);
                } else {
                    subRange.setStart(testRange.startContainer, testRange.startOffset);
                }

                if (testRange.compareBoundaryPoints(Range.END_TO_END, lineRange) >= 0) {
                    subRange.setEnd(lineRange.endContainer, lineRange.endOffset);
                } else {
                    subRange.setEnd(testRange.endContainer, testRange.endOffset);
                }

                const partialText = subRange.toString().trim();
                if (partialText) {
                    lineEntries.push({ lineIdx: i, text: partialText });
                }
            }
        }

        if (lineEntries.length === 0) {
            setSelectionParams(null);
            setShowColorPicker(false);
            return;
        }

        const clientRects = range.getClientRects();
        const rect = clientRects.length > 0 ? clientRects[clientRects.length - 1] : range.getBoundingClientRect();

        setSelectionParams({ rect, text: fullSelectedText, lineEntries });
    }, []);

    useEffect(() => {
        let timeoutId: number;

        // Mouse handlers
        const onMouseDown = (e: MouseEvent) => {
            if (toolbarRef.current && toolbarRef.current.contains(e.target as Node)) {
                return;
            }
            const target = e.target as HTMLElement;
            if (!target.closest(".reader-line")) {
                clearSelection();
            } else {
                isSelectingRef.current = true;
            }
        };

        const onMouseUp = () => {
            if (isSelectingRef.current) {
                isSelectingRef.current = false;
                setTimeout(evaluateSelection, 30);
            }
        };

        // Touch handlers (Mobile)
        const onTouchStart = (e: TouchEvent) => {
            if (toolbarRef.current && toolbarRef.current.contains(e.target as Node)) {
                return;
            }
            if (e.touches.length === 1) {
                touchStartPos.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                };
            }
        };

        const onTouchEnd = (e: TouchEvent) => {
            if (!touchStartPos.current) return;
            const touch = e.changedTouches[0];
            const dx = Math.abs(touch.clientX - touchStartPos.current.x);
            const dy = Math.abs(touch.clientY - touchStartPos.current.y);

            // If finger barely moved (< 8px), it's a tap, NOT a text selection drag.
            // Clear selection so the line tap-to-speak executes cleanly.
            if (dx < 8 && dy < 8) {
                clearTimeout(timeoutId);
                const sel = window.getSelection();
                if (sel && sel.toString().trim().length === 0) {
                    clearSelection();
                }
            } else {
                // Drag gesture - evaluate potential highlight selection
                setTimeout(evaluateSelection, 100);
            }
            touchStartPos.current = null;
        };

        const onSelectionChange = () => {
            clearTimeout(timeoutId);
            timeoutId = window.setTimeout(() => {
                if (!isSelectingRef.current) {
                    evaluateSelection();
                }
            }, 120);
        };

        document.addEventListener("mousedown", onMouseDown);
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("touchstart", onTouchStart, { passive: true });
        document.addEventListener("touchend", onTouchEnd, { passive: true });
        document.addEventListener("selectionchange", onSelectionChange);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener("mousedown", onMouseDown);
            document.removeEventListener("mouseup", onMouseUp);
            document.removeEventListener("touchstart", onTouchStart);
            document.removeEventListener("touchend", onTouchEnd);
            document.removeEventListener("selectionchange", onSelectionChange);
        };
    }, [evaluateSelection, clearSelection]);

    return {
        selectionParams,
        showColorPicker,
        setShowColorPicker,
        clearSelection,
        toolbarRef,
    };
}