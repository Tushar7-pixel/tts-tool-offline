// src/components/VoiceManagerModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import type { ReaderTheme } from '../utils/readerAppearance';
import {
  AVAILABLE_VOICES,
  type VoiceOption,
  type VoiceGender,
  type VoiceAccent,
} from '../utils/voiceCatalog';

interface VoiceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ReaderTheme;
  installedVoiceIds: string[];
  primaryVoiceId: string;
  secondaryVoiceId: string | null;
  onDownloadVoice: (voiceId: string) => Promise<void>;
  onSetPrimary: (voiceId: string) => void;
  onSetSecondary: (voiceId: string) => void;
}

export const VoiceManagerModal: React.FC<VoiceManagerModalProps> = ({
  isOpen,
  onClose,
  theme,
  installedVoiceIds,
  primaryVoiceId,
  secondaryVoiceId,
  onDownloadVoice,
  onSetPrimary,
  onSetSecondary,
}) => {
  const [genderFilter, setGenderFilter] = useState<'all' | VoiceGender>('all');
  const [accentFilter, setAccentFilter] = useState<'all' | VoiceAccent>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  // Track active sample audio preview
  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  // Stop sample playback when modal unmounts or closes
  useEffect(() => {
    return () => {
      if (sampleAudioRef.current) {
        sampleAudioRef.current.pause();
        sampleAudioRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleSample = (voice: VoiceOption) => {
    // If clicking current playing sample, pause it
    if (playingSampleId === voice.id && sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      setPlayingSampleId(null);
      return;
    }

    // Stop any existing playing sample
    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
    }

    const audio = new Audio(voice.sampleRemoteUrl);
    sampleAudioRef.current = audio;
    setPlayingSampleId(voice.id);

    audio.play().catch((err) => {
      console.warn('Sample audio play error:', err);
      setPlayingSampleId(null);
    });

    audio.onended = () => {
      setPlayingSampleId(null);
    };
  };

  const filteredVoices = AVAILABLE_VOICES.filter((voice) => {
    if (genderFilter !== 'all' && voice.gender !== genderFilter) return false;
    if (accentFilter !== 'all' && voice.accent !== accentFilter) return false;
    return true;
  });

  const handleDownload = async (id: string) => {
    setDownloadingId(id);
    try {
      await onDownloadVoice(id);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div
      data-theme={theme}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 font-sans"
    >
      <div className="app-panel w-full max-w-xl max-h-[85vh] rounded-xl flex flex-col shadow-2xl overflow-hidden border">
        {/* Header */}
        <div className="app-panel-header px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-inherit">
          <div className="flex items-center gap-2">
            <span>🎙️</span>
            <h2 className="text-xs uppercase font-bold tracking-wider">
              Voice Library & Slots
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="app-muted hover:opacity-100 text-sm px-2 py-0.5 rounded transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Filters */}
        <div className="p-3 sm:p-4 border-b border-inherit bg-black/5 flex flex-wrap gap-2 items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] app-muted font-medium">Gender:</span>
            <div className="flex rounded-md p-0.5 bg-black/10 border border-inherit">
              {(['all', 'male', 'female'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenderFilter(g)}
                  className={`text-[10px] sm:text-xs px-2 py-1 rounded capitalize font-medium transition cursor-pointer ${
                    genderFilter === g
                      ? 'bg-amber-400 text-black font-bold shadow-sm'
                      : 'app-muted hover:opacity-100'
                  }`}
                >
                  {g === 'all' ? 'All' : g === 'male' ? 'Male (M)' : 'Female (F)'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] app-muted font-medium">Accent:</span>
            <div className="flex rounded-md p-0.5 bg-black/10 border border-inherit">
              {(['all', 'american', 'british'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAccentFilter(a)}
                  className={`text-[10px] sm:text-xs px-2 py-1 rounded capitalize font-medium transition cursor-pointer ${
                    accentFilter === a
                      ? 'bg-amber-400 text-black font-bold shadow-sm'
                      : 'app-muted hover:opacity-100'
                  }`}
                >
                  {a === 'all' ? 'All' : a === 'american' ? 'US' : 'UK'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Voice List */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1">
          {filteredVoices.map((voice) => {
            const isInstalled = installedVoiceIds.includes(voice.id);
            const isPrimary = primaryVoiceId === voice.id;
            const isSecondary = secondaryVoiceId === voice.id;
            const isDownloading = downloadingId === voice.id;
            const isPlayingSample = playingSampleId === voice.id;

            return (
              <div
                key={voice.id}
                className="app-control p-3 rounded-lg border border-inherit flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
              >
                {/* Voice info & sample preview trigger */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold">{voice.name}</span>
                    <span className="text-[10px] app-chip px-1.5 py-0.5 rounded font-mono uppercase">
                      {voice.gender === 'male' ? 'M' : 'F'} • {voice.accent === 'american' ? 'US' : 'UK'}
                    </span>

                    {/* Quick Preview Audio Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleSample(voice)}
                      className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 transition cursor-pointer ${
                        isPlayingSample
                          ? 'bg-amber-400 text-black font-bold'
                          : 'app-btn border border-inherit'
                      }`}
                      title="Listen to short voice sample"
                    >
                      <span>{isPlayingSample ? '⏹ Stop' : '▶ Sample'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] app-muted mt-1 truncate">
                    "{voice.sampleText}" • <span className="font-mono">{voice.sizeMb}MB</span>
                  </p>
                </div>

                {/* Download / Slot Configuration */}
                <div className="flex items-center gap-2 shrink-0">
                  {!isInstalled ? (
                    <button
                      type="button"
                      disabled={isDownloading || downloadingId !== null}
                      onClick={() => handleDownload(voice.id)}
                      className="app-btn text-xs font-semibold px-3 py-1.5 rounded transition cursor-pointer disabled:opacity-40 w-full sm:w-auto"
                    >
                      {isDownloading ? 'Downloading...' : `Download (${voice.sizeMb}MB)`}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => onSetPrimary(voice.id)}
                        className={`text-[11px] px-2.5 py-1 rounded font-semibold transition cursor-pointer border flex-1 sm:flex-initial ${
                          isPrimary
                            ? 'bg-amber-400 text-black border-amber-400 font-bold'
                            : 'app-btn border-inherit'
                        }`}
                      >
                        {isPrimary ? '★ Primary' : 'Set Primary'}
                      </button>

                      <button
                        type="button"
                        onClick={() => onSetSecondary(voice.id)}
                        className={`text-[11px] px-2.5 py-1 rounded font-semibold transition cursor-pointer border flex-1 sm:flex-initial ${
                          isSecondary
                            ? 'bg-amber-400 text-black border-amber-400 font-bold'
                            : 'app-btn border-inherit'
                        }`}
                      >
                        {isSecondary ? '★ Secondary' : 'Set Secondary'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-inherit/40 text-center app-muted text-[11px]">
          Sample previews load instantly without requiring model installation.
        </div>
      </div>
    </div>
  );
};