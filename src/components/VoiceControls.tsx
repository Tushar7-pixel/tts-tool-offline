// src/components/VoiceControls.tsx
import React from "react";
import { AVAILABLE_VOICES } from "../utils/voiceCatalog";

interface VoiceControlsProps {
  voiceReady: boolean;
  installedVoiceIds: string[];
  maleVoiceId: string;
  femaleVoiceId: string | null;
  activeGender: "male" | "female";
  onToggleGender: () => void;
  onSetGender: (gender: "male" | "female") => void;
  onOpenVoiceModal: () => void;
  onInstallDefaultVoice: () => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  voiceReady,
  installedVoiceIds,
  maleVoiceId,
  femaleVoiceId,
  activeGender,
  onToggleGender,
  onSetGender,
  onOpenVoiceModal,
  onInstallDefaultVoice,
}) => {
  const isMaleReady = installedVoiceIds.includes(maleVoiceId);
  const isFemaleReady = Boolean(
    femaleVoiceId && installedVoiceIds.includes(femaleVoiceId),
  );
  const canToggleVoices = isMaleReady && isFemaleReady;

  const maleVoiceInfo = AVAILABLE_VOICES.find((v) => v.id === maleVoiceId);
  const femaleVoiceInfo = AVAILABLE_VOICES.find((v) => v.id === femaleVoiceId);

  const maleLabel = maleVoiceInfo
    ? `Male: ${maleVoiceInfo.name.split(" ")[0]}`
    : "Male";
  const femaleLabel = femaleVoiceInfo
    ? isFemaleReady
      ? `Female: ${femaleVoiceInfo.name.split(" ")[0]}`
      : "Download Female"
    : "+ Add Female";

  return (
    <div className="app-control flex items-center gap-1.5 px-2 py-1 rounded-lg">
      {!voiceReady ? (
        <button
          type="button"
          onClick={onInstallDefaultVoice}
          className="app-btn text-xs font-semibold px-3 py-1.5 rounded cursor-pointer"
        >
          Load Voice (63MB)
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-md border border-[var(--control-border)] bg-black/5 dark:bg-black/20 p-0.5">
            <button
              type="button"
              disabled={!isMaleReady}
              onClick={() => onSetGender("male")}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1.5 select-none disabled:opacity-40 ${
                activeGender === "male"
                  ? "bg-[var(--app-text)] text-[var(--app-bg)] font-bold shadow-xs"
                  : "app-muted hover:opacity-100"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  activeGender === "male"
                    ? "bg-current animate-pulse"
                    : "bg-transparent"
                }`}
              />
              <span className="truncate max-w-[90px]">{maleLabel}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isFemaleReady) {
                  onOpenVoiceModal();
                } else {
                  onSetGender("female");
                }
              }}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1.5 select-none ${
                activeGender === "female"
                  ? "bg-[var(--app-text)] text-[var(--app-bg)] font-bold shadow-xs"
                  : "app-muted hover:opacity-100"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  activeGender === "female"
                    ? "bg-current animate-pulse"
                    : "bg-transparent"
                }`}
              />
              <span className="truncate max-w-[100px]">{femaleLabel}</span>
            </button>
          </div>

          <button
            type="button"
            disabled={!canToggleVoices}
            onClick={onToggleGender}
            title={
              canToggleVoices
                ? "Switch Voice"
                : "Download both male and female voices to toggle"
            }
            className="app-btn text-xs font-semibold px-2 py-1 rounded transition cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ⇄
          </button>

          <button
            type="button"
            onClick={onOpenVoiceModal}
            title="Open Voice Library"
            className="app-btn text-xs font-semibold px-2 py-1 rounded transition cursor-pointer shrink-0 flex items-center"
          >
            ⚙️
          </button>
        </div>
      )}
    </div>
  );
};
