// src/utils/voiceCatalog.ts

export type VoiceGender = 'male' | 'female';
export type VoiceAccent = 'american' | 'british';
export type TTSEngine = 'piper' | 'kokoro';

export interface VoiceOption {
  id: string;
  name: string;
  gender: VoiceGender;
  accent: VoiceAccent;
  sizeMb: number;
  engine: TTSEngine;
  sampleText: string;
  sampleRemoteUrl: string;
}

export const AVAILABLE_VOICES: VoiceOption[] = [
// ==========================================
  // KOKORO TTS (Neural / High Fidelity - US)
  // ==========================================
  {
    id: 'kokoro-af_nicole',
    name: 'Nicole',
    gender: 'female',
    accent: 'american',
    sizeMb: 86,
    engine: 'kokoro',
    sampleText: 'Deep neural American female narration.',
    sampleRemoteUrl: '/samples/kokoro/af_nicole.wav',
  },
  {
    id: 'kokoro-af_bella',
    name: 'Bella',
    gender: 'female',
    accent: 'american',
    sizeMb: 86,
    engine: 'kokoro',
    sampleText: 'Expressive and clear neural American tone.',
    sampleRemoteUrl: '/samples/kokoro/af_bella.wav',
  },
  {
    id: 'kokoro-af_sarah',
    name: 'Sarah',
    gender: 'female',
    accent: 'american',
    sizeMb: 86,
    engine: 'kokoro',
    sampleText: 'Warm, realistic studio narrator.',
    sampleRemoteUrl: '/samples/kokoro/af_sarah.wav',
  },
  {
    id: 'kokoro-af_sky',
    name: 'Sky',
    gender: 'female',
    accent: 'american',
    sizeMb: 86,
    engine: 'kokoro',
    sampleText: 'Bright, youthful conversational cadence.',
    sampleRemoteUrl: '/samples/kokoro/af_sky.wav',
  },
  {
    id: 'kokoro-am_adam',
    name: 'Adam',
    gender: 'male',
    accent: 'american',
    sizeMb: 86,
    engine: 'kokoro',
    sampleText: 'Natural baritone American storytelling voice.',
    sampleRemoteUrl: '/samples/kokoro/am_adam.wav',
  },
  {
    id: 'kokoro-am_michael',
    name: 'Michael',
    gender: 'male',
    accent: 'american',
    sizeMb: 86,
    engine: 'kokoro',
    sampleText: 'Authoritative, calm American audiobook reader.',
    sampleRemoteUrl: '/samples/kokoro/am_michael.wav',
  },

  // ==========================================
  // KOKORO TTS (Neural / High Fidelity - UK)
  // ==========================================
  {
    id: 'kokoro-bf_emma',
    name: 'Emma',
    gender: 'female',
    accent: 'british',
    sizeMb: 86,
    engine: 'kokoro',
    sampleText: 'Contemporary, melodic British female narrator.',
    sampleRemoteUrl: '/samples/kokoro/bf_emma.wav',
  },
  {
    id: 'kokoro-bf_isabella',
    name: 'Isabella',
    gender: 'female',
    accent: 'british',
    sizeMb: 86,
    engine: 'kokoro',
    sampleText: 'Refined, articulate British reading tone.',
    sampleRemoteUrl: '/samples/kokoro/bf_isabella.wav',
  },
  {
    id: 'kokoro-bm_george',
    name: 'George',
    gender: 'male',
    accent: 'british',
    sizeMb: 86,
    engine: 'kokoro',
    sampleText: 'Warm and scholarly British male voice.',
    sampleRemoteUrl: '/samples/kokoro/bm_george.wav',
  },
  {
    id: 'kokoro-bm_lewis',
    name: 'Lewis',
    gender: 'male',
    accent: 'british',
    sizeMb: 86,
    engine: 'kokoro',
    sampleText: 'Deep, theatrical British classic tone.',
    sampleRemoteUrl: '/samples/kokoro/bm_lewis.wav',
  },
  // ==========================================
  // PIPER TTS (Lightweight & Fast - US)
  // ==========================================
  {
    id: 'en_US-amy-low',
    name: 'Amy (Low)',
    gender: 'female',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Warm, natural conversational American tone.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/low/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-amy-medium',
    name: 'Amy (Medium)',
    gender: 'female',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Clear and expressive American female narration.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-bryce-medium',
    name: 'Bryce',
    gender: 'male',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Casual and steady American male reader.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/bryce/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-danny-low',
    name: 'Danny',
    gender: 'male',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Deep and calm American male voice.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/danny/low/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-hfc_female-medium',
    name: 'HFC Female',
    gender: 'female',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Articulate and crisp American female narration.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_female/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-hfc_male-medium',
    name: 'HFC Male',
    gender: 'male',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Clear, balanced American male voice.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/hfc_male/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-joe-medium',
    name: 'Joe',
    gender: 'male',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Smooth, natural baritone narration.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/joe/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-john-medium',
    name: 'John',
    gender: 'male',
    accent: 'american',
    sizeMb: 64,
    engine: 'piper',
    sampleText: 'Formal, focused American reading cadence.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/john/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-kathleen-low',
    name: 'Kathleen',
    gender: 'female',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Gentle, soft-spoken storytelling voice.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kathleen/low/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-kristin-medium',
    name: 'Kristin',
    gender: 'female',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Modern, upbeat American female reader.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kristin/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-kusal-medium',
    name: 'Kusal',
    gender: 'male',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Controlled and precise American articulation.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/kusal/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-lessac-low',
    name: 'Lessac (Low)',
    gender: 'female',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Classic audiobook voice in lightweight profile.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/low/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-lessac-medium',
    name: 'Lessac (Medium)',
    gender: 'female',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Standard long-form narrator standard.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-lessac-high',
    name: 'Lessac (High)',
    gender: 'female',
    accent: 'american',
    sizeMb: 114,
    engine: 'piper',
    sampleText: 'Highest quality, studio-grade female narration.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-libritts_r-medium',
    name: 'LibriTTS-R',
    gender: 'female',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Paragraph-aware prosody designed for novels.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/libritts_r/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-ljspeech-medium',
    name: 'LJSpeech (Medium)',
    gender: 'female',
    accent: 'american',
    sizeMb: 64,
    engine: 'piper',
    sampleText: 'Well-known benchmark audiobook speaker.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ljspeech/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-ljspeech-high',
    name: 'LJSpeech (High)',
    gender: 'female',
    accent: 'american',
    sizeMb: 114,
    engine: 'piper',
    sampleText: 'Rich, high-fidelity classic reading.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ljspeech/high/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-norman-medium',
    name: 'Norman',
    gender: 'male',
    accent: 'american',
    sizeMb: 64,
    engine: 'piper',
    sampleText: 'Direct and confident male narration.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/norman/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-reza_ibrahim-medium',
    name: 'Reza Ibrahim',
    gender: 'male',
    accent: 'american',
    sizeMb: 64,
    engine: 'piper',
    sampleText: 'Clear, steady American speaking profile.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/reza_ibrahim/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-ryan-low',
    name: 'Ryan (Low)',
    gender: 'male',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Lightweight American male speaker.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/low/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-ryan-medium',
    name: 'Ryan (Medium)',
    gender: 'male',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Versatile and engaging American male reader.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-ryan-high',
    name: 'Ryan (High)',
    gender: 'male',
    accent: 'american',
    sizeMb: 114,
    engine: 'piper',
    sampleText: 'Pristine high-fidelity American male narration.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/ryan/high/samples/speaker_0.mp3',
  },
  {
    id: 'en_US-sam-medium',
    name: 'Sam',
    gender: 'male',
    accent: 'american',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Energetic, clean narrative pacing.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/sam/medium/samples/speaker_0.mp3',
  },

  // ==========================================
  // PIPER TTS (Lightweight & Fast - UK)
  // ==========================================
  {
    id: 'en_GB-alan-low',
    name: 'Alan (Low)',
    gender: 'male',
    accent: 'british',
    sizeMb: 61,
    engine: 'piper',
    sampleText: 'Lightweight British male narration.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/low/samples/speaker_0.mp3',
  },
  {
    id: 'en_GB-alan-medium',
    name: 'Alan (Medium)',
    gender: 'male',
    accent: 'british',
    sizeMb: 61,
    engine: 'piper',
    sampleText: 'Distinguished British male reader.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_GB-alba-medium',
    name: 'Alba',
    gender: 'female',
    accent: 'british',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Melodic Scottish/British female tone.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alba/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_GB-aru-medium',
    name: 'Aru',
    gender: 'female',
    accent: 'british',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Warm, soft British female voice.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/aru/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_GB-cori-medium',
    name: 'Cori (Medium)',
    gender: 'female',
    accent: 'british',
    sizeMb: 58,
    engine: 'piper',
    sampleText: 'Crisp and expressive British narration.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/cori/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_GB-cori-high',
    name: 'Cori (High)',
    gender: 'female',
    accent: 'british',
    sizeMb: 114,
    engine: 'piper',
    sampleText: 'Rich, studio-grade British female voice.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/cori/high/samples/speaker_0.mp3',
  },
  {
    id: 'en_GB-jenny_dioco-medium',
    name: 'Jenny Dioco',
    gender: 'female',
    accent: 'british',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Pleasant, natural British reading tone.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/jenny_dioco/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_GB-northern_english_male-medium',
    name: 'Northern English Male',
    gender: 'male',
    accent: 'british',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Authentic regional northern English cadence.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/northern_english_male/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_GB-semaine-medium',
    name: 'Semaine',
    gender: 'female',
    accent: 'british',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Expressive conversational British style.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/semaine/medium/samples/speaker_0.mp3',
  },
  {
    id: 'en_GB-southern_english_female-low',
    name: 'Southern English Female',
    gender: 'female',
    accent: 'british',
    sizeMb: 63,
    engine: 'piper',
    sampleText: 'Gentle southern English accent.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/southern_english_female/low/samples/speaker_0.mp3',
  },
  {
    id: 'en_GB-vctk-medium',
    name: 'VCTK (RP)',
    gender: 'male',
    accent: 'british',
    sizeMb: 77,
    engine: 'piper',
    sampleText: 'Classic Received Pronunciation British tone.',
    sampleRemoteUrl:
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/vctk/medium/samples/speaker_0.mp3',
  },
];