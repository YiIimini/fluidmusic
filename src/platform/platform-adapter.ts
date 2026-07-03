// src/platform/platform-adapter.ts
// Abstracts Electron vs Browser differences

export interface FileResult {
  ok: boolean;
  dataUrl?: string;
  cancelled?: boolean;
  error?: string;
}

export interface LoginResult {
  ok: boolean;
  cookie?: string;
  cancelled?: boolean;
  error?: string;
}

export interface PlatformAdapter {
  readonly type: 'electron' | 'browser';

  // Auth
  login(platform: 'netease' | 'qq'): Promise<LoginResult>;
  logout(platform: 'netease' | 'qq'): Promise<void>;
  getLoginStatus(): Promise<Record<string, { loggedIn: boolean; cookie: string }>>;
  getCookies(): Promise<{ netease: string; qq: string }>;

  // File operations
  pickImage(): Promise<FileResult>;
  pickVideo(): Promise<FileResult>;
  importAudioFiles(): Promise<FileResult[]>;
  clearBgVideo(): Promise<void>;

  // Window
  minimize(): void;
  maximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;

  // Settings persistence
  saveSettings(data: any): Promise<void>;
  loadSettings(): Promise<any>;

  // Events
  onWindowState(cb: (state: any) => void): () => void;
  onThemeChanged(cb: (theme: string) => void): () => void;
  onMediaControl(cb: (action: string) => void): () => void;
}
