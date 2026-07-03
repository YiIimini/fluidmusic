// ============================================================
// FluidMusic — Theme Manager
// Theme engine with CSS custom property application
// and import/export support
// ============================================================

export interface Theme {
  name: string;
  version: 1;
  colors: {
    bgBase: string;
    bgFluid: string;
    bgFluidAccent: string;
    textPrimary: string;
    textSecondary: string;
    accent: string;
    glassBg: string;
    glassBorder: string;
  };
  glass: {
    blur: number;
    opacity: number;
    borderRadius: number;
  };
  animation: {
    springExpand: string;
    springCollapse: string;
    duration: number;
  };
  foam: {
    paletteId: number;
    iridescence: number;
  };
}

const BUILTIN_THEMES: Theme[] = [
  {
    name: '默认深色',
    version: 1,
    colors: {
      bgBase: '#0a0a14', bgFluid: '#1144aa', bgFluidAccent: '#2266cc',
      textPrimary: '#ffffff', textSecondary: 'rgba(255,255,255,0.6)',
      accent: '#4488ff', glassBg: 'rgba(255,255,255,0.06)',
      glassBorder: 'rgba(255,255,255,0.08)',
    },
    glass: { blur: 20, opacity: 0.12, borderRadius: 16 },
    animation: {
      springExpand: 'cubic-bezier(0.1,1.1,0.1,1.1)',
      springCollapse: 'cubic-bezier(0.3,-0.3,0,1)',
      duration: 500,
    },
    foam: { paletteId: 0, iridescence: 0.6 },
  },
  {
    name: '清澈浅色',
    version: 1,
    colors: {
      bgBase: '#f0f0f5', bgFluid: '#88bbff', bgFluidAccent: '#aaddff',
      textPrimary: '#1a1a2e', textSecondary: 'rgba(0,0,0,0.5)',
      accent: '#3366cc', glassBg: 'rgba(255,255,255,0.3)',
      glassBorder: 'rgba(0,0,0,0.08)',
    },
    glass: { blur: 15, opacity: 0.2, borderRadius: 16 },
    animation: {
      springExpand: 'cubic-bezier(0.1,1.1,0.1,1.1)',
      springCollapse: 'cubic-bezier(0.3,-0.3,0,1)',
      duration: 400,
    },
    foam: { paletteId: 2, iridescence: 0.4 },
  },
  {
    name: '霓虹暗夜',
    version: 1,
    colors: {
      bgBase: '#050510', bgFluid: '#cc1166', bgFluidAccent: '#ff2288',
      textPrimary: '#ffffff', textSecondary: 'rgba(255,255,255,0.7)',
      accent: '#ff4488', glassBg: 'rgba(255,0,100,0.08)',
      glassBorder: 'rgba(255,0,100,0.15)',
    },
    glass: { blur: 25, opacity: 0.15, borderRadius: 20 },
    animation: {
      springExpand: 'cubic-bezier(0.1,1.3,0.1,1.1)',
      springCollapse: 'cubic-bezier(0.3,-0.5,0,1)',
      duration: 600,
    },
    foam: { paletteId: 1, iridescence: 0.9 },
  },
];

export class ThemeManager {
  private static current: Theme = BUILTIN_THEMES[0];

  static getCurrent(): Theme { return this.current; }

  static getBuiltIn(): Theme[] { return [...BUILTIN_THEMES]; }

  static apply(theme: Theme): void {
    this.current = theme;
    const root = document.documentElement.style;
    root.setProperty('--bg-base', theme.colors.bgBase);
    root.setProperty('--bg-fluid', theme.colors.bgFluid);
    root.setProperty('--bg-fluid-accent', theme.colors.bgFluidAccent);
    root.setProperty('--text-primary', theme.colors.textPrimary);
    root.setProperty('--text-secondary', theme.colors.textSecondary);
    root.setProperty('--color-accent', theme.colors.accent);
    root.setProperty('--glass-bg', theme.colors.glassBg);
    root.setProperty('--glass-border', theme.colors.glassBorder);
    root.setProperty('--glass-blur', `${theme.glass.blur}px`);
    root.setProperty('--glass-opacity', String(theme.glass.opacity));
    root.setProperty('--glass-radius', `${theme.glass.borderRadius}px`);
    root.setProperty('--spring-expand', theme.animation.springExpand);
    root.setProperty('--spring-collapse', theme.animation.springCollapse);
    root.setProperty('--anim-duration', `${theme.animation.duration}ms`);
  }

  static export(theme: Theme): string {
    return JSON.stringify(theme, null, 2);
  }

  static import(json: string): Theme {
    const data = JSON.parse(json);
    if (data.version !== 1) throw new Error('Unsupported theme version');
    return data as Theme;
  }
}
