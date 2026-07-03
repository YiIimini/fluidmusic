// ============================================================
// FluidMusic — Bubble Chamber Orchestrator
// Reassembles sub-modules into window.BubbleChamber for backward compatibility
// ============================================================
(function () {
  'use strict';
  window.BubbleChamber = Object.assign({},
    ChamberBase,
    PlaylistChamber,
    LyricChamber,
    QueueChamber,
    {
      // Override init to call ChamberBase.init (the primary init)
      init: function () {
        ChamberBase.init();
      },
    }
  );

  // Legacy aliases — keep all existing BubbleChamber.xxx() calls working in app.js
  // All methods are already in the merged object via Object.assign.
  // Explicit exports for documentation / discoverability:
  window.BubbleChamber.init = ChamberBase.init;
  window.BubbleChamber.setLyrics = LyricChamber.setLyrics;
  window.BubbleChamber.highlightLyric = LyricChamber.highlightLyric;
  window.BubbleChamber.findLyricIndex = LyricChamber.findLyricIndex;
  window.BubbleChamber.setPlaylist = PlaylistChamber.setPlaylist;
  window.BubbleChamber.setUserPlaylists = PlaylistChamber.setUserPlaylists;
  window.BubbleChamber.loadPlaylistSongs = PlaylistChamber.loadPlaylistSongs;
  window.BubbleChamber.setActivePlaylistItem = PlaylistChamber.setActivePlaylistItem;
  window.BubbleChamber.updateQueueDisplay = QueueChamber.updateQueueDisplay;
  window.BubbleChamber.showPlaylistLoading = PlaylistChamber.showPlaylistLoading;
  window.BubbleChamber.showPlaylistEmpty = PlaylistChamber.showPlaylistEmpty;
  window.BubbleChamber.refreshPlaylistLabels = PlaylistChamber.refreshPlaylistLabels;
  window.BubbleChamber.refreshPlaylistList = PlaylistChamber.refreshPlaylistList;
  window.BubbleChamber.refreshPlaylistListFromCache = PlaylistChamber.refreshPlaylistListFromCache;
  window.BubbleChamber.fetchAndCachePlaylistSongs = PlaylistChamber.fetchAndCachePlaylistSongs;
  window.BubbleChamber.renderFavoritesList = PlaylistChamber.renderFavoritesList;
  window.BubbleChamber.getSyncedPlaylistIds = PlaylistChamber.getSyncedPlaylistIds;
  window.BubbleChamber.filterSyncedPlaylists = PlaylistChamber.filterSyncedPlaylists;
  window.BubbleChamber.renderQueueList = PlaylistChamber.renderQueueList;
  window.BubbleChamber.animateLyrics = LyricChamber.animateLyrics;

  // Legacy fetchTrackUrl alias (used externally as window._fetchTrackUrl)
  window._fetchTrackUrl = PlaylistChamber.fetchTrackUrl;

  // Centralized URL resolution: ensures a track has a playable URL.
  // Replaces the guard pattern duplicated across 7+ call sites.
  window._ensureTrackUrl = async function(track) {
    if (!track || track.url && track.platform !== 'qq') return;
    if (!track.id || !window._fetchTrackUrl) return;
    try { track.url = await window._fetchTrackUrl(track); } catch(_) {}
  };

  // Register with module registry if available
  if (typeof __FM !== 'undefined') __FM.register('bubbleChamber', [], function () { return window.BubbleChamber; }, { priority: 5 });

  console.log('FluidMusic Bubble Chamber Orchestrator loaded');
})();
