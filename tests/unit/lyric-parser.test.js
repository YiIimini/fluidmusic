// ============================================================
// Tests for Lyric Parser (from bubble-chamber.js)
// Tests the LRC parsing and binary search logic
// ============================================================
import { describe, it, expect } from 'vitest';

// Extracted from bubble-chamber.js — the pure functions
function parseLyricTimes(lyricText) {
  const result = [];
  if (!lyricText) return result;
  const lines = lyricText.split('\n');
  const timeRe = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  lines.forEach((line) => {
    const matches = [];
    let m;
    while ((m = timeRe.exec(line)) !== null) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      const ms = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0;
      matches.push(min * 60 + sec + ms / 1000);
    }
    const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
    if (text && matches.length > 0) {
      matches.forEach((time) => result.push({ time, text }));
    }
  });
  result.sort((a, b) => a.time - b.time);
  return result;
}

function findLyricIndex(times, currentTimeSec) {
  if (!times || times.length === 0) return -1;
  let lo = 0, hi = times.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (times[mid].time <= currentTimeSec) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return hi >= 0 ? hi : 0;
}

describe('Lyric Parser', () => {
  describe('parseLyricTimes', () => {
    it('should parse standard LRC format', () => {
      const lrc = '[00:12.34]First line\n[00:45.67]Second line\n[01:20.00]Third line';
      const result = parseLyricTimes(lrc);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ time: 12.34, text: 'First line' });
      expect(result[1]).toEqual({ time: 45.67, text: 'Second line' });
      expect(result[2]).toEqual({ time: 80.0, text: 'Third line' });
    });

    it('should handle empty input', () => {
      expect(parseLyricTimes('')).toEqual([]);
      expect(parseLyricTimes(null)).toEqual([]);
    });

    it('should handle multi-timestamp lines', () => {
      const lrc = '[00:10.00][00:20.00]Repeated line';
      const result = parseLyricTimes(lrc);
      expect(result).toHaveLength(2);
      expect(result[0].time).toBe(10);
      expect(result[1].time).toBe(20);
    });

    it('should skip lines without timestamps', () => {
      const lrc = '[00:10.00]Valid\n[ti:Title]\n[00:20.00]Also valid';
      const result = parseLyricTimes(lrc);
      expect(result).toHaveLength(2);
    });

    it('should sort by time ascending', () => {
      const lrc = '[00:30.00]Later\n[00:10.00]Earlier';
      const result = parseLyricTimes(lrc);
      expect(result[0].time).toBe(10);
      expect(result[1].time).toBe(30);
    });

    it('should handle milliseconds with 2 or 3 digits', () => {
      const lrc = '[01:00.50]Two digit ms\n[01:00.500]Three digit ms';
      const result = parseLyricTimes(lrc);
      expect(result[0].time).toBeCloseTo(60.5, 2);
      expect(result[1].time).toBeCloseTo(60.5, 2);
    });
  });

  describe('findLyricIndex (binary search)', () => {
    const times = [
      { time: 0, text: 'Start' },
      { time: 10, text: 'Ten' },
      { time: 20, text: 'Twenty' },
      { time: 30, text: 'Thirty' },
      { time: 40, text: 'Forty' },
    ];

    it('should return 0 for time before first lyric', () => {
      expect(findLyricIndex(times, -1)).toBe(0);
      expect(findLyricIndex(times, 5)).toBe(0);
    });

    it('should return exact match index', () => {
      expect(findLyricIndex(times, 10)).toBe(1);
      expect(findLyricIndex(times, 30)).toBe(3);
    });

    it('should return last matching for time between lyrics', () => {
      expect(findLyricIndex(times, 15)).toBe(1); // between 10 and 20
      expect(findLyricIndex(times, 25)).toBe(2); // between 20 and 30
    });

    it('should return last index for time after all lyrics', () => {
      expect(findLyricIndex(times, 100)).toBe(4);
    });

    it('should handle empty array', () => {
      expect(findLyricIndex([], 10)).toBe(-1);
    });

    it('should handle single lyric', () => {
      expect(findLyricIndex([{ time: 5, text: 'Only' }], 10)).toBe(0);
      expect(findLyricIndex([{ time: 5, text: 'Only' }], 0)).toBe(0);
    });

    it('should be O(log n) — fast for large datasets', () => {
      // Generate 10000 lyrics
      const large = Array.from({ length: 10000 }, (_, i) => ({
        time: i * 5,
        text: 'Line ' + i,
      }));
      const start = performance.now();
      const result = findLyricIndex(large, 25000); // middle
      const duration = performance.now() - start;
      expect(result).toBe(5000);
      expect(duration).toBeLessThan(5); // should be sub-millisecond
    });
  });
});
