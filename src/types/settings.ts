// ============================================================
// FluidMusic — DIY Settings type definitions
// ============================================================

import type { PlayMode } from './audio';

// --- Visual / Particle Cover ---

export interface ParticleSettings {
  resolution: number;        // 60-200, default 118
  scatterStrength: number;   // 0-1
  sensitivity: number;       // 0-1
  rotationSpeed: number;     // 0-2
  colorScheme: 'warm' | 'cool' | 'original' | 'custom';
  particleSize: number;      // 1-4, default 2
}

// --- Center Foam Equalizer ---

export interface FoamSettings {
  count: number;             // 20-150
  size: number;              // 0.5-3
  iridescence: number;       // 0-1
  floatAmplitude: number;    // 0-1
  paletteId: number;         // 0-5
}

// --- Lyrics ---

export interface LyricsSettings {
  visibleLines: number;      // 0-40, default 0 = all
  fontSize: number;          // 12-24
  textColor: string;
  highlightColor: string;
  fadeIntensity: number;     // 0-1
}

// --- Playlist Panel ---

export interface PlaylistSettings {
  style: 'default' | 'compact' | 'card';
  fontSize: number;
  transparency: number;      // 0-1
}

// --- 3D Spectrum Visualization ---

export interface SpectrumSettings {
  layerCount: number;
  particlesPerLayer: number;
  sensitivity: number;       // 0-1
  colorScheme: 'warm' | 'cool' | 'rainbow';
}

// --- Bottom Controller ---

export interface ControllerSettings {
  particleDensity: number;   // 0-1
  sandStrength: number;      // 0-1
  style: 'default' | 'minimal' | 'detailed';
}

// --- Fluid Background ---

export interface FluidBgSettings {
  intensity: number;         // 0-1
  speed: number;             // 0.1-3
  colorScheme: 'dark' | 'light' | 'warm' | 'cool';
}

// --- Bubble Chambers ---

export interface ChamberSettings {
  transparency: number;          // 0-1
  triggerSensitivity: number;    // 0-1
  leftPinned: boolean;
  rightPinned: boolean;
  topPinned: boolean;
  bottomPinned: boolean;
  queueDockMag: boolean;
}

// --- System ---

export interface SystemSettings {
  language: 'zh-CN' | 'en-US';
  accountMultiLogin: boolean;
  wallpaperOpacity: number;       // 0-1
  wallpaperRippleSpeed: number;   // 0.2-2
  defaultPlayMode: PlayMode;
  defaultVolume: number;          // 0-1
}

// --- Aggregate ---

export interface DIYSettings {
  particle: ParticleSettings;
  foam: FoamSettings;
  lyrics: LyricsSettings;
  playlist: PlaylistSettings;
  spectrum: SpectrumSettings;
  controller: ControllerSettings;
  fluidBg: FluidBgSettings;
  chambers: ChamberSettings;
  system: SystemSettings;
}
