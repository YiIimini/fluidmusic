// ============================================================
// FluidMusic — i18n Multi-Language System (TypeScript)
// zh-CN / en-US language packs covering all UI text
// Dot-notation key lookup with fallback
// Migrated from public/js/i18n.js
// ============================================================

declare const __FM: {
  register: (name: string, deps: string[], factory: () => any, opts?: { priority?: number }) => void;
} | undefined;

// ---- Types ----

export type LocaleCode = 'zh-CN' | 'en-US';

interface LocalePack {
  [section: string]: { [key: string]: string };
}

// ---- I18N ----

export class I18N {
  locale: LocaleCode = 'zh-CN';
  fallbackLocale: LocaleCode = 'zh-CN';

  packs: Record<LocaleCode, LocalePack> = {
    'zh-CN': {
      app: { title: 'FluidMusic', subtitle: '流体动态音乐播放器' },
      playlist: { title: '歌单', loading: '加载中...', empty: '暂无歌单', back: '← 返回歌单列表', songs: '首', loadFail: '加载失败', emptyPlaylist: '歌单为空', loadingSongs: '加载歌单中...', refresh: '刷新歌单' },
      lyrics: { title: '歌词', empty: '暂无歌词', loading: '加载歌词中...' },
      settings: { title: 'DIY 设置', particle: '粒子封面', foam: '泡沫特效', lyrics: '歌词设置', playlist: '歌单设置', spectrum: '频谱设置', controller: '控制器', background: '背景流体', chambers: '气泡仓', account: '账号', language: '语言设置', equalizer: '均衡器' },
      player: { play: '播放', pause: '暂停', prev: '上一曲', next: '下一曲', shuffle: '随机播放', loop: '循环模式', loopOff: '关闭循环', loopList: '列表循环', loopSingle: '单曲循环', like: '收藏', unlike: '取消收藏', lyrics: '歌词', fx: '特效', volume: '音量' },
      login: { netease: '网易云音乐', qq: 'QQ音乐', logging: '登录中...', logged: '已登录', logout: '退出', vip: 'VIP', blackVip: '黑胶VIP', luxVip: '豪华VIP' },
      account: { followers: '粉丝', following: '关注', playlists: '歌单' },
      language: { name: '语言 / Language', zhCN: '中文', enUS: 'English' },
      common: { on: '已开启', off: '已关闭', close: '关闭', save: '保存', cancel: '取消', yes: '是', no: '否' },
    },
    'en-US': {
      app: { title: 'FluidMusic', subtitle: 'Fluid Dynamic Music Player' },
      playlist: { title: 'Playlists', loading: 'Loading...', empty: 'No playlists', back: '← Back to playlists', songs: 'songs', loadFail: 'Failed to load', emptyPlaylist: 'Empty playlist', loadingSongs: 'Loading songs...', refresh: 'Refresh' },
      lyrics: { title: 'Lyrics', empty: 'No lyrics', loading: 'Loading lyrics...' },
      settings: { title: 'DIY Settings', particle: 'Particle Cover', foam: 'Foam FX', lyrics: 'Lyrics', playlist: 'Playlist', spectrum: 'Spectrum', controller: 'Controller', background: 'Background Fluid', chambers: 'Bubble Chambers', account: 'Account', language: 'Language', equalizer: 'Equalizer' },
      player: { play: 'Play', pause: 'Pause', prev: 'Previous', next: 'Next', shuffle: 'Shuffle', loop: 'Loop Mode', loopOff: 'Loop Off', loopList: 'Loop List', loopSingle: 'Loop Single', like: 'Like', unlike: 'Unlike', lyrics: 'Lyrics', fx: 'Effects', volume: 'Volume' },
      login: { netease: 'NetEase Music', qq: 'QQ Music', logging: 'Logging in...', logged: 'Logged in', logout: 'Logout', vip: 'VIP', blackVip: 'Black VIP', luxVip: 'Lux VIP' },
      account: { followers: 'Followers', following: 'Following', playlists: 'Playlists' },
      language: { name: 'Language', zhCN: '中文', enUS: 'English' },
      common: { on: 'On', off: 'Off', close: 'Close', save: 'Save', cancel: 'Cancel', yes: 'Yes', no: 'No' },
    },
  };

  /**
   * Get a translated string by dot-notation path.
   * Falls back to fallbackLocale if the key is missing in the current locale.
   * Supports `{key}` replacement patterns.
   */
  t(path: string, replacements?: Record<string, string | number>): string {
    const keys = path.split('.');
    let value: any = this.packs[this.locale] || this.packs[this.fallbackLocale];
    for (const key of keys) {
      if (value == null) break;
      value = value[key];
    }
    if (value == null) {
      let fb: any = this.packs[this.fallbackLocale];
      for (const key of keys) {
        if (fb == null) break;
        fb = fb[key];
      }
      value = fb;
    }
    if (typeof value !== 'string') return path;
    if (replacements) {
      return value.replace(/\{(\w+)\}/g, (_, k: string) =>
        replacements[k] != null ? String(replacements[k]) : `{${k}}`
      );
    }
    return value;
  }

  /**
   * Switch the active locale and persist to localStorage.
   * Updates document language and CSS font variables, then refreshes all UI text.
   */
  setLocale(locale: LocaleCode): void {
    if (!this.packs[locale]) return;
    this.locale = locale;
    document.documentElement.lang = locale === 'zh-CN' ? 'zh-CN' : 'en-US';

    // Apply language-specific CSS adjustments
    if (locale === 'zh-CN') {
      document.documentElement.style.setProperty('--font-weight-body', '400');
      document.documentElement.style.setProperty('--font-weight-heading', '700');
      document.documentElement.style.setProperty('--letter-spacing-body', '0.02em');
      document.documentElement.style.setProperty('--letter-spacing-heading', '0.04em');
    } else {
      document.documentElement.style.setProperty('--font-weight-body', '350');
      document.documentElement.style.setProperty('--font-weight-heading', '600');
      document.documentElement.style.setProperty('--letter-spacing-body', '-0.01em');
      document.documentElement.style.setProperty('--letter-spacing-heading', '-0.005em');
    }

    localStorage.setItem('fluidmusic-locale', locale);
    this.refreshUI();
  }

  /**
   * Walk the DOM and update all elements with data-i18n attributes.
   * Also patches chamber titles, login buttons, and settings button.
   * Dispatches a `fluidmusic:locale-change` custom event.
   */
  refreshUI(): void {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const text = this.t(key);
      if (el.children.length === 0 || (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3)) {
        el.textContent = text;
      }
      const titleKey = el.getAttribute('data-i18n-title');
      if (titleKey) (el as HTMLElement).title = this.t(titleKey);
      const placeholderKey = el.getAttribute('data-i18n-placeholder');
      if (placeholderKey && 'placeholder' in el) {
        (el as HTMLInputElement).placeholder = this.t(placeholderKey);
      }
    });

    // Update chamber titles
    const leftTitle = document.querySelector('#chamber-left .chamber-title');
    if (leftTitle) leftTitle.textContent = '\u{1F3B5} ' + this.t('playlist.title');
    const rightTitle = document.querySelector('#chamber-right .chamber-title');
    if (rightTitle) rightTitle.textContent = '\u{1F4DD} ' + this.t('lyrics.title');

    // Update login buttons if not logged in
    (['netease', 'qq'] as const).forEach((platform) => {
      const btn = document.getElementById('btn-' + platform + '-login');
      if (btn && !btn.classList.contains('logged-in')) {
        const iconMap = { netease: '\u{1F3A7}', qq: '\u{1F3B5}' };
        btn.innerHTML = iconMap[platform] + ' ' + this.t('login.' + platform);
      }
    });

    // Update settings button title
    const btnSettings = document.getElementById('btn-settings');
    if (btnSettings) btnSettings.title = this.t('settings.title');

    // Trigger custom event for other modules
    window.dispatchEvent(new CustomEvent('fluidmusic:locale-change', { detail: { locale: this.locale } }));
  }

  /**
   * Initialise: load saved locale from localStorage, apply font settings, refresh UI.
   */
  init(): void {
    const saved = localStorage.getItem('fluidmusic-locale');
    if (saved && this.packs[saved as LocaleCode]) {
      this.locale = saved as LocaleCode;
    }
    document.documentElement.lang = this.locale === 'zh-CN' ? 'zh-CN' : 'en-US';

    // Apply font settings
    if (this.locale === 'zh-CN') {
      document.documentElement.style.setProperty('--font-weight-body', '400');
      document.documentElement.style.setProperty('--font-weight-heading', '700');
      document.documentElement.style.setProperty('--letter-spacing-body', '0.02em');
      document.documentElement.style.setProperty('--letter-spacing-heading', '0.04em');
    } else {
      document.documentElement.style.setProperty('--font-weight-body', '350');
      document.documentElement.style.setProperty('--font-weight-heading', '600');
      document.documentElement.style.setProperty('--letter-spacing-body', '-0.01em');
      document.documentElement.style.setProperty('--letter-spacing-heading', '-0.005em');
    }

    this.refreshUI();
    console.log('i18n initialized with locale:', this.locale);
  }
}

// ── Singleton + backward-compat ──
const instance = new I18N();

if (typeof __FM !== 'undefined') {
  __FM.register('i18n', [], () => instance, { priority: 10 });
}

(window as any).I18N = instance;
console.log('FluidMusic i18n System loaded (TS)');
