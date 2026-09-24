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

    const clearSelection = useCallback(() => {
        window.getSelection()?.removeAllRanges();
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
        if (!fullSelectedText) {
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

    // Listen for mouse/touch interactions across the document
    useEffect(() => {
        let timeoutId: number;

        const onMouseDown = (e: MouseEvent) => {
            // If clicking inside the toolbar itself, do nothing
            if (toolbarRef.current && toolbarRef.current.contains(e.target as Node)) {
                return;
            }

            // If user clicks anywhere else, check if they clicked outside text
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
                // Evaluate immediately when user releases mouse button
                setTimeout(evaluateSelection, 30);
            }
        };

        const onSelectionChange = () => {
            // Keep mobile touch support working via selectionchange
            clearTimeout(timeoutId);
            timeoutId = window.setTimeout(() => {
                if (!isSelectingRef.current) {
                    evaluateSelection();
                }
            }, 80);
        };

        document.addEventListener("mousedown", onMouseDown);
        document.addEventListener("mouseup", onMouseUp);
        document.addEventListener("selectionchange", onSelectionChange);

        return () => {
            clearTimeout(timeoutId);
            document.removeEventListener("mousedown", onMouseDown);
            document.removeEventListener("mouseup", onMouseUp);
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