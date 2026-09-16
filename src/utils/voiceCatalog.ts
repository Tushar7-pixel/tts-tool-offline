// src/utils/voiceCatalog.ts

export type VoiceGender = 'male' | 'female';
export type VoiceAccent = 'american' | 'british';

export interface VoiceOption {
  id: string;
  name: string;
  gender: VoiceGender;
  accent: VoiceAccent;
  sizeMb: number;
  sampleText: string;
  sampleRemoteUrl: string; // Remote lightweight sample stream
}

export const AVAILABLE_VOICES: VoiceOption[] = [
  {
    id: 'en_US-hfc_male-medium',
    name: 'HFC Male (US)',
    gender: 'male',
    accent: 'american',
    sizeMb: 63,
    sampleText: 'Clear and natural American male voice.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_male/medium/samples/speaker_0.wav',
  },
  {
    id: 'en_US-hfc_female-medium',
    name: 'HFC Female (US)',
    gender: 'female',
    accent: 'american',
    sizeMb: 63,
    sampleText: 'Warm and articulate American female voice.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/samples/speaker_0.wav',
  },
  {
    id: 'en_GB-alan-medium',
    name: 'Alan (UK)',
    gender: 'male',
    accent: 'british',
    sizeMb: 61,
    sampleText: 'Distinguished British male narration.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/samples/speaker_0.wav',
  },
  {
    id: 'en_GB-cori-medium',
    name: 'Cori (UK)',
    gender: 'female',
    accent: 'british',
    sizeMb: 58,
    sampleText: 'Crisp and expressive British female narration.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/cori/medium/samples/speaker_0.wav',
  },
];