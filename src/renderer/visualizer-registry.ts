// ============================================================
// FluidMusic — Visualizer Preset Registry
// Extension point: plug in new visualizer presets at runtime
// ============================================================

import { AudioBands } from '../types/audio';

export interface VisualizerPreset {
  id: string;
  name: string;
  description: string;
  type: 'webgl' | 'canvas2d';
  init(canvas: HTMLCanvasElement): void;
  tick(dt: number, bands: AudioBands): void;
  render(): void;
  dispose(): void;
  settings?: PresetSetting[];
}

export interface PresetSetting {
  key: string;
  label: string;
  type: 'slider' | 'color' | 'select' | 'toggle';
  default: any;
  min?: number;
  max?: number;
  options?: { label: string; value: any }[];
}

export class VisualizerRegistry {
  private static presets = new Map<string, VisualizerPreset>();
  private static activeId: string | null = null;

  static register(preset: VisualizerPreset): void {
    this.presets.set(preset.id, preset);
  }

  static list(): VisualizerPreset[] {
    return Array.from(this.presets.values());
  }

  static get(id: string): VisualizerPreset | undefined {
    return this.presets.get(id);
  }

  static activate(id: string): void {
    if (this.activeId) this.presets.get(this.activeId)?.dispose();
    const preset = this.presets.get(id);
    if (preset) {
      this.activeId = id;
      // Caller handles canvas setup
    }
  }

  static getActive(): string | null {
    return this.activeId;
  }
}
