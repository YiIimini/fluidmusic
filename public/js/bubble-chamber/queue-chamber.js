// ============================================================
// FluidMusic — Queue Chamber: dock magnification, queue display, carousel scroll
// ============================================================
(function () {
  'use strict';
  const QueueChamber = {
    // ── Queue rendering ──
    updateQueueDisplay(currentTrack, playlist, currentIndex) {
      const queueArea = document.getElementById('queue-area');
      if (!queueArea) return;

      const items = queueArea.querySelectorAll('.queue-item');
      const total = items.length;
      const center = Math.floor(total / 2);
      const pl = playlist || [];
      const idx = (currentIndex != null) ? currentIndex : -1;

      // Sync with play mode: random mode shuffles the display order
      var displayOrder = pl.slice();
      var mode = (typeof FluidAudio !== 'undefined') ? FluidAudio.playMode : 'sequential';
      if (mode === 'random' && pl.length > 1) {
        // Keep current track at its position, shuffle the rest
        var rest = displayOrder.slice(0, idx).concat(displayOrder.slice(idx + 1));
        for (var ri = rest.length - 1; ri > 0; ri--) {
          var rj = Math.floor(Math.random() * (ri + 1));
          var tmp = rest[ri]; rest[ri] = rest[rj]; rest[rj] = tmp;
        }
        displayOrder = rest.slice(0, idx).concat([displayOrder[idx]], rest.slice(idx));
      }

      for (let i = 0; i < total; i++) {
        const offset = i - center;
        let trackIndex = 0;
        if (displayOrder.length > 0) {
          trackIndex = ((idx + offset) % displayOrder.length + displayOrder.length) % displayOrder.length;
        }
        const track = displayOrder[trackIndex];

        items[i].className = 'queue-item';
        if (offset === 0) {
          items[i].classList.add('center');
        } else if (Math.abs(offset) >= 2) {
          items[i].classList.add('far');
        }

        items[i].dataset.index = pl.length > 0 ? trackIndex : '';
        if (track && track.coverUrl) {
          items[i].style.background = `url(${track.coverUrl}) center/cover`;
        } else {
          items[i].style.background = '';
        }
      }
    },
  };

  window.QueueChamber = QueueChamber;
  console.log('FluidMusic Queue Chamber loaded');
})();
