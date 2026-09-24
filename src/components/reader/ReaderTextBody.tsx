// src/components/reader/ReaderTextBody.tsx
import React, { useMemo } from "react";
import type { HighlightItem } from "../../utils/db";

const MemoizedReaderLine = React.memo(
  ({
    idx,
    lineText,
    lineState,
    highlights,
    onLineClick,
    onHighlightClick,
  }: {
    idx: number;
    lineText: string;
    lineState: string;
    highlights?: HighlightItem[];
    onLineClick: (idx: number) => void;
    onHighlightClick: (
      item: HighlightItem,
      lineIdx: number,
      rect: DOMRect,
    ) => void;
  }) => {
    const renderedContent = useMemo(() => {
      if (!lineText) return <span className="block h-[1em]">&nbsp;</span>;
      if (!highlights || highlights.length === 0) return lineText;

      type Segment = { text: string; highlight?: HighlightItem };
      let segments: Segment[] = [{ text: lineText }];

      for (const hl of highlights) {
        if (!hl.text) continue;
        const nextSegments: Segment[] = [];

        for (const seg of segments) {
          if (seg.highlight || !seg.text.includes(hl.text)) {
            nextSegments.push(seg);
          } else {
            const parts = seg.text.split(hl.text);
            for (let i = 0; i < parts.length; i++) {
              if (parts[i].length > 0) nextSegments.push({ text: parts[i] });
              if (i < parts.length - 1)
                nextSegments.push({ text: hl.text, highlight: hl });
            }
          }
        }
        segments = nextSegments;
      }

      return (
        <>
          {segments.map((s, sIdx) =>
            s.highlight ? (
              <mark
                key={sIdx}
                onClick={(e) => {
                  e.stopPropagation();
                  const target = e.currentTarget as HTMLElement;
                  onHighlightClick(
                    s.highlight!,
                    idx,
                    target.getBoundingClientRect(),
                  );
                }}
                className="cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  backgroundColor: s.highlight.color,
                  color: "inherit",
                  padding: "0 2px",
                  borderRadius: "3px",
                  borderBottom: s.highlight.note
                    ? "2px dotted currentColor"
                    : undefined,
                }}
                title={
                  s.highlight.note
                    ? `Note: ${s.highlight.note}`
                    : "Click to edit or remove highlight"
                }
              >
                {s.text}
              </mark>
            ) : (
              <React.Fragment key={sIdx}>{s.text}</React.Fragment>
            ),
          )}
        </>
      );
    }, [lineText, highlights, idx, onHighlightClick]);

    return (
      <div
        id={`reader-line-${idx}`}
        onClick={() => onLineClick(idx)}
        className={`reader-line px-1 sm:px-2 py-0.5 cursor-pointer ${lineState}`}
      >
        {renderedContent}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.lineState === nextProps.lineState &&
      prevProps.lineText === nextProps.lineText &&
      prevProps.highlights === nextProps.highlights
    );
  },
);

interface ReaderTextBodyProps {
  displayedLines: string[];
  displayToSentence: number[][];
  currentLine: number;
  currentPage: number;
  highlights?: Record<string, HighlightItem[]>;
  fontSize: number;
  fontFamily: string;
  onLineClick: (displayIdx: number) => void;
  onHighlightClick: (
    item: HighlightItem,
    lineIdx: number,
    rect: DOMRect,
  ) => void;
}

export const ReaderTextBody: React.FC<ReaderTextBodyProps> = ({
  displayedLines,
  displayToSentence,
  currentLine,
  currentPage,
  highlights,
  fontSize,
  fontFamily,
  onLineClick,
  onHighlightClick,
}) => {
  return (
    <div
      className="text-left max-w-3xl mx-auto space-y-2 pb-6"
      style={{
        fontFamily,
        fontSize: `${fontSize}px`,
        lineHeight: 1.7,
      }}
    >
      {displayedLines.map((line, idx) => {
        const sentenceIndices = displayToSentence[idx] || [];
        const isCurrent = sentenceIndices.includes(currentLine);
        const lineState = isCurrent ? "is-current" : "is-pending";
        const hlItems = highlights?.[`${currentPage}-${idx}`];

        return (
          <MemoizedReaderLine
            key={idx}
            idx={idx}
            lineText={line}
            lineState={lineState}
            highlights={hlItems}
            onLineClick={onLineClick}
            onHighlightClick={onHighlightClick}
          />
        );
      })}
    </div>
  );
};
