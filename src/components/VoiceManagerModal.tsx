// src/components/VoiceManagerModal.tsx
import React, { useState, useRef, useEffect } from 'react';
import type { ReaderTheme } from '../utils/readerAppearance';
import {
  AVAILABLE_VOICES,
  type VoiceOption,
  type VoiceGender,
  type VoiceAccent,
} from '../utils/voiceCatalog';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface VoiceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ReaderTheme;
  installedVoiceIds: string[]; // e.g. ['kokoro-engine', 'en_US-ryan-medium']
  maleVoiceId: string | null;
  femaleVoiceId: string | null;
  onDownloadVoice: (voiceOrEngineId: string) => Promise<void>;
  onSetMaleVoice: (voiceId: string) => void;
  onSetFemaleVoice: (voiceId: string) => void;
}

export const VoiceManagerModal: React.FC<VoiceManagerModalProps> = ({
  isOpen,
  onClose,
  theme,
  installedVoiceIds,
  maleVoiceId,
  femaleVoiceId,
  onDownloadVoice,
  onSetMaleVoice,
  onSetFemaleVoice,
}) => {
  const isOnline = useOnlineStatus();
  const [engineFilter, setEngineFilter] = useState<'all' | 'kokoro' | 'piper'>('all');
  const [genderFilter, setGenderFilter] = useState<'all' | VoiceGender>('all');
  const [accentFilter, setAccentFilter] = useState<'all' | VoiceAccent>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [playingSampleId, setPlayingSampleId] = useState<string | null>(null);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  const isKokoroEngineInstalled = installedVoiceIds.includes('kokoro-base-engine');

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
    if (playingSampleId === voice.id && sampleAudioRef.current) {
      sampleAudioRef.current.pause();
      setPlayingSampleId(null);
      return;
    }

    if (sampleAudioRef.current) {
      sampleAudioRef.current.pause();
    }

    const audio = new Audio(voice.sampleRemoteUrl);
    sampleAudioRef.current = audio;
    setPlayingSampleId(voice.id);

    audio.play().catch((err) => {
      console.warn('Sample audio error:', err);
      setPlayingSampleId(null);
    });

    audio.onended = () => {
      setPlayingSampleId(null);
    };
  };

  const handleDownload = async (id: string) => {
    if (!isOnline) return;
    setDownloadingId(id);
    try {
      await onDownloadVoice(id);
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredVoices = AVAILABLE_VOICES.filter((voice) => {
    if (engineFilter !== 'all' && voice.engine !== engineFilter) return false;
    if (genderFilter !== 'all' && voice.gender !== genderFilter) return false;
    if (accentFilter !== 'all' && voice.accent !== accentFilter) return false;
    return true;
  });

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
              Voice Library & Setup
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

        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-center text-amber-500 text-[11px] font-medium flex items-center justify-center gap-1.5 shrink-0">
            <span>⚡</span>
            <span>Offline: Installed voices work offline. Downloads are disabled.</span>
          </div>
        )}

        {/* Kokoro Master Engine Installation Card */}
        {(engineFilter === 'all' || engineFilter === 'kokoro') && (
          <div className="p-3 sm:p-4 border-b border-inherit bg-purple-500/10 flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-400">✨ Kokoro-82M Core Engine</span>
                <span className="text-[10px] font-mono opacity-70">~86MB</span>
              </div>
              <p className="text-[11px] app-muted mt-0.5">
                {isKokoroEngineInstalled
                  ? 'Core engine installed. All Kokoro voices are ready to use.'
                  : 'Download once to unlock all neural Kokoro studio voices.'}
              </p>
            </div>

            {!isKokoroEngineInstalled ? (
              <button
                type="button"
                disabled={!isOnline || downloadingId === 'kokoro-base-engine'}
                onClick={() => handleDownload('kokoro-base-engine')}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded transition cursor-pointer disabled:opacity-40 shrink-0"
              >
                {downloadingId === 'kokoro-base-engine' ? 'Downloading...' : 'Install Engine (86MB)'}
              </button>
            ) : (
              <span className="text-xs text-purple-400 font-bold flex items-center gap-1 shrink-0">
                <span>✓ Installed</span>
              </span>
            )}
          </div>
        )}

        {/* Filter Controls */}
        <div className="p-3 border-b border-inherit bg-black/5 flex flex-wrap gap-2 items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] app-muted font-medium">Engine:</span>
            <div className="flex rounded-md p-0.5 bg-black/10 border border-inherit">
              {(['all', 'kokoro', 'piper'] as const).map((eng) => (
                <button
                  key={eng}
                  type="button"
                  onClick={() => setEngineFilter(eng)}
                  className={`text-[10px] px-2 py-0.5 rounded capitalize font-medium transition cursor-pointer ${
                    engineFilter === eng
                      ? 'bg-amber-400 text-black font-bold shadow-xs'
                      : 'app-muted hover:opacity-100'
                  }`}
                >
                  {eng === 'all' ? 'All' : eng === 'kokoro' ? 'Kokoro' : 'Piper'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] app-muted font-medium">Gender:</span>
            <div className="flex rounded-md p-0.5 bg-black/10 border border-inherit">
              {(['all', 'male', 'female'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenderFilter(g)}
                  className={`text-[10px] px-2 py-0.5 rounded capitalize font-medium transition cursor-pointer ${
                    genderFilter === g
                      ? 'bg-amber-400 text-black font-bold shadow-xs'
                      : 'app-muted hover:opacity-100'
                  }`}
                >
                  {g === 'all' ? 'All' : g === 'male' ? 'M' : 'F'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] app-muted font-medium">Accent:</span>
            <div className="flex rounded-md p-0.5 bg-black/10 border border-inherit">
              {(['all', 'american', 'british'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAccentFilter(a)}
                  className={`text-[10px] px-2 py-0.5 rounded capitalize font-medium transition cursor-pointer ${
                    accentFilter === a
                      ? 'bg-amber-400 text-black font-bold shadow-xs'
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
            const isKokoro = voice.engine === 'kokoro';
            // Kokoro voices are ready if base engine is downloaded; Piper voices check their own ID
            const isAvailable = isKokoro
              ? isKokoroEngineInstalled
              : installedVoiceIds.includes(voice.id);

            const isSelected =
              voice.gender === 'male'
                ? maleVoiceId === voice.id
                : femaleVoiceId === voice.id;
            const isDownloading = downloadingId === voice.id;
            const isPlayingSample = playingSampleId === voice.id;

            return (
              <div
                key={voice.id}
                className={`app-control p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition ${
                  isKokoro
                    ? 'border-purple-500/30 bg-purple-500/5'
                    : 'border-inherit'
                }`}
              >
                {/* Voice Meta */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold">{voice.name}</span>

                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isKokoro
                          ? 'bg-purple-600 text-white'
                          : 'bg-zinc-600 text-white'
                      }`}
                    >
                      {isKokoro ? 'Kokoro' : 'Piper'}
                    </span>

                    <span className="text-[10px] app-chip px-1.5 py-0.5 rounded font-mono uppercase">
                      {voice.gender === 'male' ? 'M' : 'F'} •{' '}
                      {voice.accent === 'american' ? 'US' : 'UK'}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleToggleSample(voice)}
                      className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 transition cursor-pointer ${
                        isPlayingSample
                          ? 'bg-amber-400 text-black font-bold'
                          : 'app-btn border border-inherit'
                      }`}
                    >
                      <span>{isPlayingSample ? '⏹ Stop' : '▶ Sample'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] app-muted mt-1 truncate">
                    "{voice.sampleText}"
                  </p>
                </div>

                {/* Role Actions */}
                <div className="shrink-0 flex items-center gap-2">
                  {!isAvailable ? (
                    isKokoro ? (
                      <span className="text-[10px] app-muted italic px-2">
                        Install Kokoro Engine above
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={!isOnline || isDownloading || downloadingId !== null}
                        onClick={() => handleDownload(voice.id)}
                        className="app-btn text-xs font-semibold px-3 py-1.5 rounded transition cursor-pointer disabled:opacity-40 w-full sm:w-auto"
                      >
                        {isDownloading ? 'Downloading...' : `Download (${voice.sizeMb}MB)`}
                      </button>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (voice.gender === 'male') {
                          onSetMaleVoice(voice.id);
                        } else {
                          onSetFemaleVoice(voice.id);
                        }
                      }}
                      className={`text-[11px] px-3 py-1.5 rounded font-semibold transition cursor-pointer border w-full sm:w-auto ${
                        isSelected
                          ? 'bg-amber-400 text-black border-amber-400 font-bold'
                          : 'app-btn border-inherit'
                      }`}
                    >
                      {isSelected
                        ? voice.gender === 'male'
                          ? '★ Male Active'
                          : '★ Female Active'
                        : voice.gender === 'male'
                        ? 'Set Male'
                        : 'Set Female'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};