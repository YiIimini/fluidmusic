// ============================================================
// FluidMusic — Audio type definitions
// ============================================================

export interface AudioBands {
  bass: number;    // 20-250Hz, 0-1
  mid: number;     // 250-4kHz, 0-1
  treble: number;  // 4k-20kHz, 0-1
  energy: number;  // overall 0-1
}

export type EQPresetName = 'flat' | 'pop' | 'rock' | 'jazz' | 'classical' | 'bass' | 'vocal';

export type PlayMode = 'sequential' | 'random' | 'single';
