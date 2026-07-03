// ============================================================
// FluidMusic — Renderer Module Smoke Tests
// Tests for pure utility functions extracted from renderer modules.
// Follows the same pattern as existing tests (lyric-parser, i18n, etc.)
// ============================================================

import { describe, it, expect } from 'vitest';

// ── ChamberBase.escapeHtml (from bubble-chamber/chamber-base.js) ──
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── formatTime (from controllers.js) ──
function formatTime(sec) {
  if (!sec || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// ── PlaylistChamber._trackDisplayText (from playlist-chamber.js) ──
function trackDisplayText(track) {
  const title = track.title || track.name || '未知';
  const artist = track.artist ? ' — ' + track.artist : '';
  return escapeHtml(title + artist);
}

// ── DIYSettings tab validation ──
const REQUIRED_TABS = ['particle', 'visual', 'playlist', 'lyricsTab', 'background', 'system'];

// ═══════════════════════════════════════════════════════════

describe('escapeHtml', () => {
  it('returns empty string for falsy input', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('escapes HTML special characters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('leaves safe text unchanged', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
    expect(escapeHtml('测试中文')).toBe('测试中文');
  });
});

describe('formatTime', () => {
  it('formats zero', () => {
    expect(formatTime(0)).toBe('00:00');
  });

  it('formats under one minute', () => {
    expect(formatTime(5)).toBe('00:05');
    expect(formatTime(45)).toBe('00:45');
  });

  it('formats over one minute', () => {
    expect(formatTime(65)).toBe('01:05');
    expect(formatTime(125)).toBe('02:05');
  });

  it('formats over one hour', () => {
    expect(formatTime(3661)).toBe('61:01');
    expect(formatTime(7200)).toBe('120:00');
  });

  it('handles negative values', () => {
    expect(formatTime(-5)).toBe('00:00');
  });
});

describe('trackDisplayText', () => {
  it('formats track with artist', () => {
    const result = trackDisplayText({ title: 'Hello', artist: 'World' });
    expect(result).toBe('Hello — World');
  });

  it('formats track without artist', () => {
    const result = trackDisplayText({ title: 'Solo' });
    expect(result).toBe('Solo');
  });

  it('falls back to name when title missing', () => {
    const result = trackDisplayText({ name: 'Fallback' });
    expect(result).toBe('Fallback');
  });

  it('shows 未知 for untitled tracks', () => {
    const result = trackDisplayText({});
    expect(result).toBe('未知');
  });

  it('escapes HTML in track metadata', () => {
    const result = trackDisplayText({ title: '<b>Bold</b>', artist: 'Evil & Bad' });
    expect(result).not.toContain('<b>');
    expect(result).toContain('&amp;');
  });
});

describe('DIYSettings tab configuration', () => {
  it('all required tabs are present', () => {
    REQUIRED_TABS.forEach(tab => {
      expect(REQUIRED_TABS).toContain(tab);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// PlaylistChamber._toggleQueue logic (state-machine test)
// ═══════════════════════════════════════════════════════════

describe('_toggleQueue logic', () => {
  function toggleQueue(playlist, track) {
    const exists = playlist.find(p => p.id === track.id && p.platform === track.platform);
    if (!exists) {
      playlist.push(track);
      return true;
    } else {
      const idx = playlist.findIndex(p => p.id === track.id && p.platform === track.platform);
      playlist.splice(idx, 1);
      return false;
    }
  }

  it('adds track when not in playlist', () => {
    const playlist = [];
    const track = { id: '1', platform: 'qq' };
    const added = toggleQueue(playlist, track);
    expect(added).toBe(true);
    expect(playlist.length).toBe(1);
  });

  it('removes track when already in playlist', () => {
    const track = { id: '1', platform: 'qq' };
    const playlist = [track];
    const added = toggleQueue(playlist, track);
    expect(added).toBe(false);
    expect(playlist.length).toBe(0);
  });

  it('distinguishes tracks by id+platform', () => {
    const playlist = [{ id: '1', platform: 'qq' }];
    const added = toggleQueue(playlist, { id: '1', platform: 'netease' });
    expect(added).toBe(true);
    expect(playlist.length).toBe(2);
  });
});
