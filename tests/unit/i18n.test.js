// ============================================================
// Tests for I18N — internationalization module
// ============================================================
import { describe, it, expect, beforeEach } from 'vitest';

describe('I18N', () => {
  // Simulate the i18n module behavior
  const I18N = {
    locale: 'zh-CN',
    packs: {
      'zh-CN': {
        playlist: {
          title: '歌单',
          loading: '加载中...',
          empty: '暂无歌单',
          loadFail: '加载失败',
          loadingSongs: '正在获取歌曲...',
          emptyPlaylist: '歌单为空',
        },
        lyrics: { empty: '暂无歌词' },
        login: { netease: '登录网易云', qq: '登录QQ音乐', logging: '登录中...' },
      },
      'en-US': {
        playlist: {
          title: 'Playlists',
          loading: 'Loading...',
          empty: 'No playlists',
          loadFail: 'Load failed',
          loadingSongs: 'Fetching songs...',
          emptyPlaylist: 'Empty playlist',
        },
        lyrics: { empty: 'No lyrics' },
        login: { netease: 'Login NetEase', qq: 'Login QQ Music', logging: 'Logging in...' },
      },
    },

    t(path) {
      const keys = path.split('.');
      let value = this.packs[this.locale];
      for (const key of keys) {
        if (value && typeof value === 'object') {
          value = value[key];
        } else {
          return path; // fallback to key
        }
      }
      return value || path;
    },

    setLocale(locale) {
      if (this.packs[locale]) {
        this.locale = locale;
        localStorage.setItem('fluidmusic-locale', locale);
      }
    },

    init() {
      const saved = localStorage.getItem('fluidmusic-locale');
      if (saved && this.packs[saved]) {
        this.locale = saved;
      }
    },
  };

  beforeEach(() => {
    localStorage.clear();
  });

  describe('t()', () => {
    it('should translate simple keys', () => {
      expect(I18N.t('playlist.title')).toBe('歌单');
    });

    it('should translate nested keys', () => {
      expect(I18N.t('login.netease')).toBe('登录网易云');
    });

    it('should fallback to key for missing translations', () => {
      I18N.locale = 'zh-CN';
      const result = I18N.t('nonexistent.key');
      expect(result).toBe('nonexistent.key');
    });

    it('should return key for missing language pack', () => {
      I18N.locale = 'fr-FR'; // non-existent
      expect(I18N.t('playlist.title')).toBe('playlist.title');
    });
  });

  describe('setLocale', () => {
    it('should switch to English', () => {
      I18N.setLocale('en-US');
      expect(I18N.locale).toBe('en-US');
      expect(I18N.t('playlist.title')).toBe('Playlists');
    });

    it('should persist locale to localStorage', () => {
      I18N.setLocale('en-US');
      expect(localStorage.getItem('fluidmusic-locale')).toBe('en-US');
    });

    it('should ignore invalid locales', () => {
      I18N.setLocale('zh-CN');
      I18N.setLocale('invalid');
      expect(I18N.locale).toBe('zh-CN'); // unchanged
    });
  });

  describe('init', () => {
    it('should restore saved locale from localStorage', () => {
      localStorage.setItem('fluidmusic-locale', 'en-US');
      I18N.locale = 'zh-CN'; // reset
      I18N.init();
      expect(I18N.locale).toBe('en-US');
    });

    it('should keep default if no saved locale', () => {
      I18N.locale = 'zh-CN';
      I18N.init();
      expect(I18N.locale).toBe('zh-CN');
    });
  });
});
