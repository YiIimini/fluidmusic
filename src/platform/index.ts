// src/platform/index.ts
// Auto-detect platform and provide the right adapter

import type { PlatformAdapter } from './platform-adapter';
import { createElectronAdapter } from './electron-adapter';
import { createBrowserAdapter } from './browser-adapter';

let _adapter: PlatformAdapter | null = null;

export function getPlatformAdapter(): PlatformAdapter {
  if (_adapter) return _adapter;

  const isElectron = !!(window as any).fluidmusic?.log;
  if (isElectron) {
    _adapter = createElectronAdapter();
  } else {
    _adapter = createBrowserAdapter();
  }

  console.log('[PlatformAdapter] Using:', _adapter.type);
  return _adapter;
}

export type { PlatformAdapter } from './platform-adapter';
