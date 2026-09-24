// src/components/reader/HighlightToolbar.tsx
import React from "react";
import type { SelectionData } from "../../hooks/useTextSelection";

export const HIGHLIGHT_COLORS = [
  { label: "Yellow", value: "rgba(253, 224, 71, 0.4)", bg: "bg-yellow-300" },
  { label: "Green", value: "rgba(134, 239, 172, 0.4)", bg: "bg-green-300" },
  { label: "Blue", value: "rgba(147, 197, 253, 0.4)", bg: "bg-blue-300" },
  { label: "Purple", value: "rgba(216, 180, 254, 0.4)", bg: "bg-purple-300" },
  { label: "Pink", value: "rgba(249, 168, 212, 0.4)", bg: "bg-pink-300" },
  { label: "Orange", value: "rgba(253, 186, 116, 0.4)", bg: "bg-orange-300" },
];

interface HighlightToolbarProps {
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  selectionParams: SelectionData;
  compactChrome: boolean;
  showColorPicker: boolean;
  onShowColorPicker: (show: boolean) => void;
  onDefine: (text: string) => void;
  onApplyColor: (color: string) => void;
}

export const HighlightToolbar: React.FC<HighlightToolbarProps> = ({
  toolbarRef,
  selectionParams,
  compactChrome,
  showColorPicker,
  onShowColorPicker,
  onDefine,
  onApplyColor,
}) => {
  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-1 app-panel border border-[var(--panel-border)] shadow-2xl rounded-2xl p-2 animate-in fade-in zoom-in-95 duration-150"
      style={
        compactChrome
          ? {
              bottom: "24px",
              left: "50%",
              transform: "translateX(-50%)",
              maxWidth: "90vw",
            }
          : {
              top: Math.min(
                window.innerHeight - 60,
                selectionParams.rect.bottom + 8,
              ),
              left: Math.max(
                10,
                Math.min(
                  window.innerWidth - 250,
                  selectionParams.rect.left +
                    selectionParams.rect.width / 2 -
                    100,
                ),
              ),
            }
      }
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {!showColorPicker ? (
        <>
          {selectionParams.text.split(/\s+/).length <= 3 && (
            <button
              type="button"
              onClick={() => onDefine(selectionParams.text)}
              className="px-3 py-1.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition cursor-pointer"
            >
              📖 Define
            </button>
          )}
          <button
            type="button"
            onClick={() => onShowColorPicker(true)}
            className="px-3 py-1.5 text-xs font-bold hover:bg-black/5 dark:hover:bg-white/10 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <span className="w-3.5 h-3.5 rounded-full bg-yellow-300"></span>{" "}
            Highlight
          </button>
        </>
      ) : (
        <div className="flex items-center gap-2 px-1 py-0.5">
          {HIGHLIGHT_COLORS.map((col) => (
            <button
              key={col.label}
              type="button"
              onClick={() => onApplyColor(col.value)}
              title={col.label}
              className={`w-7 h-7 rounded-full ${col.bg} border border-black/10 hover:scale-110 active:scale-95 transition cursor-pointer shadow-sm`}
            />
          ))}
          <button
            type="button"
            onClick={() => onShowColorPicker(false)}
            className="ml-1 p-1 text-xs opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
