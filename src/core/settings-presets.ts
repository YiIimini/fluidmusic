// ============================================================
// FluidMusic — Settings Presets
// One-click preset combinations for rapid personalization
// ============================================================

import { DIYSettings } from '../types/settings';

export interface SettingsPreset {
  id: string;
  name: string;
  description: string;
  settings: Partial<DIYSettings>;
}

export const BUILTIN_PRESETS: SettingsPreset[] = [
  {
    id: 'immersive',
    name: '沉浸',
    description: '最大化视觉冲击，高粒子密度、强泡沫律动',
    settings: {
      particle: {
        resolution: 160, scatterStrength: 0.8, sensitivity: 0.9,
        rotationSpeed: 1.2, colorScheme: 'original', particleSize: 2,
      },
      foam: {
        count: 120, size: 1.8, iridescence: 0.8, floatAmplitude: 0.9, paletteId: 1,
      },
      fluidBg: {
        intensity: 0.9, speed: 1.2, colorScheme: 'dark',
      },
    } as any,
  },
  {
    id: 'minimal',
    name: '极简',
    description: '克制视觉，低GPU占用，适合工作背景',
    settings: {
      particle: {
        resolution: 80, scatterStrength: 0.3, sensitivity: 0.5,
        rotationSpeed: 0.5, colorScheme: 'original', particleSize: 1,
      },
      foam: {
        count: 40, size: 1.2, iridescence: 0.3, floatAmplitude: 0.4, paletteId: 0,
      },
      fluidBg: {
        intensity: 0.3, speed: 0.5, colorScheme: 'dark',
      },
    } as any,
  },
  {
    id: 'crystalline',
    name: '清澈',
    description: '珍珠白+冰蓝配色，高透明度玻璃质感',
    settings: {
      foam: {
        count: 80, size: 1.5, iridescence: 0.9, floatAmplitude: 0.6, paletteId: 0,
      },
      fluidBg: {
        intensity: 0.6, speed: 0.8, colorScheme: 'cool',
      },
      chambers: {
        transparency: 0.08, triggerSensitivity: 0.7, leftPinned: false, rightPinned: false, topPinned: true,
      },
    } as any,
  },
];

export class SettingsPresets {
  static getAll(): SettingsPreset[] { return BUILTIN_PRESETS; }
  static get(id: string): SettingsPreset | undefined {
    return BUILTIN_PRESETS.find(p => p.id === id);
  }
}
