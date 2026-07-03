// ============================================================
// FluidMusic — Search Module
// Unified search across NetEase + QQ Music
// Results displayed in a dropdown overlay, click to play/add
// ============================================================
(function () {
  'use strict';

  const Search = {
    open: false,
    loading: false,
    results: [],
    searchTimeout: null,
  };

  const DEBOUNCE_MS = 400;

  function init() {
    const input = document.getElementById('search-input');
    const closeBtn = document.getElementById('btn-search-close');
    const container = document.getElementById('search-bar-container');
    const overlay = document.getElementById('search-results-overlay');

    if (!input || !container) {
      console.warn('[Search] UI elements missing');
      return;
    }

    // Show search bar on Cmd+K or Ctrl+K
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggleSearch();
      }
      if (e.key === 'Escape' && Search.open) {
        closeSearch();
        e.stopPropagation();
      }
    });

    // Input handler with debounce
    input.addEventListener('input', () => {
      clearTimeout(Search.searchTimeout);
      const query = input.value.trim();
      if (query.length < 1) {
        hideResults();
        return;
      }
      Search.searchTimeout = setTimeout(() => performSearch(query), DEBOUNCE_MS);
    });

    // Enter key triggers first result
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && Search.results.length > 0) {
        playTrack(Search.results[0]);
        closeSearch();
      }
    });

    // Close button
    if (closeBtn) {
      closeBtn.addEventListener('click', closeSearch);
    }

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (Search.open && !container.contains(e.target) && !overlay.contains(e.target)) {
        closeSearch();
      }
    });
  }

  function toggleSearch() {
    if (Search.open) {
      closeSearch();
    } else {
      openSearch();
    }
  }

  function openSearch() {
    const container = document.getElementById('search-bar-container');
    const input = document.getElementById('search-input');
    if (!container || !input) return;

    Search.open = true;
    container.style.opacity = '1';
    container.style.pointerEvents = 'auto';
    input.value = '';
    input.focus();
    hideResults();
  }

  function closeSearch() {
    const container = document.getElementById('search-bar-container');
    const input = document.getElementById('search-input');
    if (container) {
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
    }
    if (input) input.value = '';
    hideResults();
    Search.open = false;
    Search.results = [];
  }

  function hideResults() {
    const overlay = document.getElementById('search-results-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  function showResults() {
    const overlay = document.getElementById('search-results-overlay');
    if (overlay) overlay.style.display = '';
  }

  async function performSearch(query) {
    if (Search.loading) return;
    Search.loading = true;

    const list = document.getElementById('search-results-list');
    if (list) {
      list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-dim);font-size:12px;">搜索中...</div>';
      showResults();
    }

    try {
      // Search both platforms in parallel
      const promises = [];
      if (typeof ApiBridge !== 'undefined') {
        if (ApiBridge.neteaseLoggedIn) {
          promises.push(
            ApiBridge.searchNetease(query, 10).then(d => parseNeteaseResults(d)).catch(() => [])
          );
        }
        if (ApiBridge.qqLoggedIn) {
          promises.push(
            ApiBridge.searchQQ(query, 10).then(d => parseQQResults(d)).catch(() => [])
          );
        }
      }

      // Fallback: search without login (may have limited results)
      if (promises.length === 0 && typeof ApiBridge !== 'undefined') {
        promises.push(
          ApiBridge.fetchApi('/api/netease/search', { keywords: query, limit: 10 }, 'netease')
            .then(d => parseNeteaseResults(d)).catch(() => [])
        );
      }

      const results = (await Promise.allSettled(promises))
        .filter(r => r.status === 'fulfilled')
        .flatMap(r => r.value);

      Search.results = results;
      renderResults(results);
    } catch (e) {
      console.error('[Search] Failed:', e);
      if (list) {
        list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-dim);font-size:12px;">搜索失败</div>';
      }
    } finally {
      Search.loading = false;
    }
  }

  function parseNeteaseResults(data) {
    if (!data || !data.result || !data.result.songs) return [];
    return data.result.songs.map(song => ({
      id: song.id,
      title: song.name,
      artist: (song.artists || []).map(a => a.name).join('/') || (song.ar || []).map(a => a.name).join('/'),
      coverUrl: (song.album && song.album.picUrl) ? song.album.picUrl.replace(/^http:/, 'https:') : '',
      platform: 'netease',
      album: song.album ? song.album.name : '',
    }));
  }

  function parseQQResults(data) {
    if (!data || !data.data || !data.data.song || !data.data.song.list) return [];
    return data.data.song.list.map(song => ({
      id: song.songmid || song.id,
      title: song.songname || song.name,
      artist: (song.singer || []).map(s => s.name).join('/'),
      coverUrl: song.albummid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + song.albummid + '.jpg' : '',
      platform: 'qq',
      album: song.albumname || '',
    }));
  }

  function renderResults(tracks) {
    const list = document.getElementById('search-results-list');
    if (!list) return;

    if (tracks.length === 0) {
      list.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-dim);font-size:12px;">无搜索结果</div>';
      showResults();
      return;
    }

    const platformLabel = { netease: '网易', qq: 'QQ' };
    const platformClass = { netease: 'net', qq: 'qq' };

    list.innerHTML = tracks.map((t, i) => `
      <div class="search-result-row" data-idx="${i}"
        style="display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;
        transition:background 0.15s;border-bottom:1px solid rgba(255,255,255,0.03);"
        onmouseenter="this.style.background='rgba(255,255,255,0.04)'"
        onmouseleave="this.style.background='transparent'">
        <div style="width:36px;height:36px;border-radius:6px;flex-shrink:0;
          background:${t.coverUrl ? 'url(' + escapeHtml(t.coverUrl) + ') center/cover' : 'rgba(255,255,255,0.05)'};">
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(t.title)}</div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:2px;">
            ${escapeHtml(t.artist)}
            <span class="platform-dot ${platformClass[t.platform] || 'net'}" style="margin-left:6px;"></span>
            ${platformLabel[t.platform] || ''}
          </div>
        </div>
        <button class="pli-btn pli-play" style="flex-shrink:0;font-size:14px;" title="播放">▶</button>
        <button class="pli-btn pli-add" style="flex-shrink:0;font-size:14px;" title="加到队列">+</button>
      </div>
    `).join('');

    // Wire click handlers
    list.querySelectorAll('.search-result-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const idx = parseInt(row.dataset.idx, 10);
        if (!isNaN(idx) && Search.results[idx]) {
          // Click row = play
          if (!e.target.closest('button')) {
            playTrack(Search.results[idx]);
            closeSearch();
          }
        }
      });
    });

    list.querySelectorAll('.pli-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = btn.closest('.search-result-row');
        const idx = parseInt(row.dataset.idx, 10);
        if (!isNaN(idx) && Search.results[idx]) {
          playTrack(Search.results[idx]);
          closeSearch();
        }
      });
    });

    list.querySelectorAll('.pli-add').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = btn.closest('.search-result-row');
        const idx = parseInt(row.dataset.idx, 10);
        if (!isNaN(idx) && Search.results[idx]) {
          addToQueue(Search.results[idx]);
        }
      });
    });

    showResults();
  }

  async function playTrack(track) {
    if (typeof FluidAudio === 'undefined') return;

    // Fetch URL if needed
    await window._ensureTrackUrl(track);

    if (track.url) {
      // Replace playlist with this single track (user can add more)
      FluidAudio.setPlaylist([track], 0);
      FluidAudio.load(track.url, track);
      FluidAudio.play();
      if (typeof BubbleChamber !== 'undefined') {
        BubbleChamber.updateQueueDisplay(track, [track], 0);
      }
      if (typeof showToast !== 'undefined') {
        showToast('▶ ' + (track.title || '播放'));
      }
    } else {
      if (typeof showToast !== 'undefined') {
        showToast('⚠ 无法获取播放地址 — ' + getFailReason(track));
      }
    }
  }

  function addToQueue(track) {
    if (typeof FluidAudio === 'undefined') return;
    const exists = FluidAudio.playlist.find(p => p.id === track.id && p.platform === track.platform);
    if (!exists) {
      FluidAudio.playlist.push(track);
      if (typeof showToast !== 'undefined') showToast('+ 已添加到队列');
      if (typeof BubbleChamber !== 'undefined') {
        BubbleChamber.updateQueueDisplay(FluidAudio.currentTrack, FluidAudio.playlist, FluidAudio.playlistIndex);
      }
    } else {
      if (typeof showToast !== 'undefined') showToast('已在队列中');
    }
  }

  function getFailReason(track) {
    if (!track.url && !track.id) return '无播放ID';
    if (track.platform === 'qq') return 'QQ音乐链接可能已过期，请重试';
    return '请检查网络或登录状态';
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Exports ──
  Search.init = init;
  Search.openSearch = openSearch;
  Search.closeSearch = closeSearch;
  Search.toggleSearch = toggleSearch;
  Search.isOpen = () => Search.open;

  window.FluidSearch = Search;
  if (typeof __FM !== 'undefined') __FM.register('search', [], function () { return Search; }, { priority: 5 });
  console.log('FluidMusic Search module loaded');
})();
