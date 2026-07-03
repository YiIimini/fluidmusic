// ============================================================
// FluidMusic — Lyric Chamber: LRC parsing, binary search, highlight, animation
// ============================================================
(function () {
  'use strict';
  const LyricChamber = {
    lyricTimes: [],
    transTimes: null,
    lyricsLines: [],
    _lastLyricIdx: -1,

    // Parse LRC text into {time_sec, text} array
    parseLyricTimes(lyricText) {
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
    },

    setLyrics(lyricText, currentIndex, transText) {
      const container = document.getElementById('lyrics-container');
      if (!container) return;

      LyricChamber.lyricTimes = LyricChamber.parseLyricTimes(lyricText);
      // Parse translation lyrics too (for bilingual display)
      LyricChamber.transTimes = transText ? LyricChamber.parseLyricTimes(transText) : null;

      container.innerHTML = '';
      if (LyricChamber.lyricTimes.length === 0) {
        const ul = document.createElement('ul');
        ul.style.cssText = 'list-style:none;margin:0;padding:0;';
        const li = document.createElement('li');
        li.className = 'lyric-line placeholder';
        li.textContent = typeof I18N !== 'undefined' ? I18N.t('lyrics.empty') : '暂无歌词';
        ul.appendChild(li);
        container.appendChild(ul);
        LyricChamber.lyricsLines = [(typeof I18N !== 'undefined' ? I18N.t('lyrics.empty') : '暂无歌词')];
        return;
      }

      LyricChamber.lyricsLines = LyricChamber.lyricTimes.map(l => l.text);
      const ul = document.createElement('ul');
      ul.style.cssText = 'list-style:none;margin:0;padding:0;';
      LyricChamber.lyricTimes.forEach((lt, _i) => {
        const li = document.createElement('li');
        li.className = 'lyric-line';
        li.innerHTML = '<span class="lyric-orig">' + ChamberBase.escapeHtml(lt.text) + '</span>';

        if (LyricChamber.transTimes && LyricChamber.transTimes.length > 0) {
          let bestTrans = '';
          let bestDiff = Infinity;
          for (const tt of LyricChamber.transTimes) {
            const diff = Math.abs(tt.time - lt.time);
            if (diff < bestDiff && diff < 3) {
              bestDiff = diff;
              bestTrans = tt.text;
            }
          }
          if (bestTrans && bestTrans !== lt.text) {
            li.innerHTML += '<span class="lyric-trans">' + ChamberBase.escapeHtml(bestTrans) + '</span>';
          }
        }

        ul.appendChild(li);
      });
      container.appendChild(ul);
      LyricChamber.highlightLyric(0);
    },

    // Find lyric index for current playback time using binary search
    findLyricIndex(currentTimeSec) {
      const times = LyricChamber.lyricTimes;
      if (!times || times.length === 0) return -1;
      // Binary search: find the last lyric whose time <= currentTimeSec
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
    },

    highlightLyric(index) {
      const container = document.getElementById('lyrics-container');
      if (!container) return;
      const changed = LyricChamber._lastLyricIdx !== index;
      LyricChamber._lastLyricIdx = index;
      const lines = container.querySelectorAll('.lyric-line');
      lines.forEach((line, i) => {
        const isActive = (i === index);
        if (line.classList.contains('active') !== isActive) {
          line.classList.toggle('active', isActive);
          if (isActive) {
            // Reset transform on newly active line
            line.style.transform = '';
            line.style.textShadow = '';
          }
        }
      });
      if (index >= 0 && lines[index]) {
        // Update inline lyric in center core
        const inlineLyric = document.getElementById('inline-lyric');
        if (inlineLyric && LyricChamber.lyricTimes && index >= 0 && index < LyricChamber.lyricTimes.length) {
          inlineLyric.textContent = LyricChamber.lyricTimes[index].text;
        }
        if (changed) {
          lines[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    },

    // Audio-reactive lyric animation — called from render loop
    animateLyrics() {
      if (!LyricChamber._lastLyricIdx || LyricChamber._lastLyricIdx < 0) return;
      const container = document.getElementById('lyrics-container');
      if (!container) return;
      const lines = container.querySelectorAll('.lyric-line');
      const idx = LyricChamber._lastLyricIdx;
      if (!lines[idx]) return;

      let energy = 0, bass = 0;
      if (typeof FluidAudio !== 'undefined' && FluidAudio.bands) {
        energy = FluidAudio.bands.energy || 0;
        bass = FluidAudio.bands.bass || 0;
        FluidAudio.bands.mid || 0; // mid (unused directly, but drives float calculation)
      }

      const activeLine = lines[idx];

      // Gentle breathing scale — feels alive
      const scale = 1 + energy * 0.08 + bass * 0.06;
      // Subtle vertical float — like the lyric is floating on sound waves
      const floatY = Math.sin(Date.now() * 0.003) * 2 * energy + bass * 3;
      // Color warmth shifts with energy
      const glowIntensity = energy * 0.6 + bass * 0.4;

      activeLine.style.transform = 'scale(' + scale.toFixed(3) + ') translateY(' + floatY.toFixed(1) + 'px)';
      activeLine.style.textShadow = '0 0 ' + (8 + glowIntensity * 20).toFixed(0) + 'px rgba(180,200,255,' + (0.2 + glowIntensity * 0.5).toFixed(2) + '), 0 ' + (bass * 8).toFixed(0) + 'px ' + (bass * 12).toFixed(0) + 'px rgba(130,160,255,' + (bass * 0.3).toFixed(2) + ')';

      // Neighboring lines get subtle movement too
      for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        const ni = idx + i;
        if (ni >= 0 && ni < lines.length && !lines[ni].classList.contains('active')) {
          const dist = Math.abs(i);
          const nFloat = Math.sin(Date.now() * 0.002 + i) * energy * (3 - dist);
          lines[ni].style.transform = 'translateY(' + nFloat.toFixed(1) + 'px)';
          lines[ni].style.opacity = (0.4 - dist * 0.08 + energy * 0.15).toFixed(2);
        }
      }
    },
  };

  window.LyricChamber = LyricChamber;
  console.log('FluidMusic Lyric Chamber loaded');
})();
