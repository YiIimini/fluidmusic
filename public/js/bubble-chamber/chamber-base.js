// ============================================================
// FluidMusic — Chamber Base: edge triggers, hover/pin, dock magnification
// ============================================================
(function () {
  'use strict';
  const ChamberBase = {
    chambers: {},
    pinned: { top: true, bottom: true, left: false, right: false },
    hovered: { left: false, right: false, top: false, bottom: false },
    edgeZones: {},

    init() {
      console.log('[BubbleChamber] init START');
      try {
      ['left', 'right', 'top', 'bottom'].forEach((side) => {
        const el = document.getElementById('chamber-' + side);
        if (el) {
          ChamberBase.chambers[side] = el;
    // bottom is edge-triggered like others
        }
      });

      // Edge trigger zones
      const edgeLeft = document.getElementById('edge-left');
      const edgeRight = document.getElementById('edge-right');
      const edgeTop = document.getElementById('edge-top');

      if (edgeLeft) {
        edgeLeft.addEventListener('mouseenter', () => ChamberBase.handleEdgeEnter('left'));
        edgeLeft.addEventListener('mouseleave', () => ChamberBase.handleEdgeLeave('left'));
        edgeLeft.addEventListener('click', () => ChamberBase.handleEdgeClick('left'));
      }
      if (edgeRight) {
        edgeRight.addEventListener('mouseenter', () => ChamberBase.handleEdgeEnter('right'));
        edgeRight.addEventListener('mouseleave', () => ChamberBase.handleEdgeLeave('right'));
        edgeRight.addEventListener('click', () => ChamberBase.handleEdgeClick('right'));
      }
      if (edgeTop) {
        edgeTop.addEventListener('mouseenter', () => ChamberBase.handleEdgeEnter('top'));
        edgeTop.addEventListener('mouseleave', () => ChamberBase.handleEdgeLeave('top'));
        edgeTop.addEventListener('click', () => ChamberBase.handleEdgeClick('top'));
      }

      const edgeBottom = document.getElementById('edge-bottom');
      if (edgeBottom) {
        edgeBottom.addEventListener('mouseenter', () => ChamberBase.handleEdgeEnter('bottom'));
        edgeBottom.addEventListener('mouseleave', () => ChamberBase.handleEdgeLeave('bottom'));
        edgeBottom.addEventListener('click', () => ChamberBase.handleEdgeClick('bottom'));
      }

      // Auto-show pinned chambers on startup
      Object.keys(ChamberBase.pinned).forEach((side) => {
        if (ChamberBase.pinned[side]) ChamberBase.showChamber(side);
      });

      ['left', 'right', 'bottom'].forEach((side) => {
        const el = document.getElementById('chamber-' + side);
        if (el) {
          el.addEventListener('mouseenter', () => {
            ChamberBase.hovered[side] = true;
            ChamberBase.showChamber(side);
          });
          el.addEventListener('mouseleave', () => {
            ChamberBase.hovered[side] = false;
            if (!ChamberBase.pinned[side]) {
              ChamberBase.hideChamber(side);
            }
          });
        }
      });
      // Top chamber: always visible, but hide on mouseleave if not pinned
      const topEl = document.getElementById('chamber-top');
      if (topEl) {
        topEl.addEventListener('mouseenter', () => {
          ChamberBase.hovered.top = true;
          ChamberBase.showChamber('top');
        });
        topEl.addEventListener('mouseleave', () => {
          ChamberBase.hovered.top = false;
          if (!ChamberBase.pinned.top) {
            // Keep visible by default (it's the queue display)
            // Only hide if explicitly unpinned via click
          }
        });
      }

      // ── Dock-style magnification for queue covers ──
      const queueArea = document.getElementById('queue-area');
      if (queueArea) {
        let dockMagEnabled = true;
        let dockRafId = null;
        let dockMouseX = 0, dockMouseY = 0;
        let dockActive = false;

        // Cache item rects once per frame to avoid layout thrashing
        const updateDockMagnification = () => {
          dockRafId = null;
          if (!dockMagEnabled || !dockActive) return;

          const items = queueArea.querySelectorAll('.queue-item');
          if (items.length === 0) return;

          // Read phase: cache all rects at once (single layout pass)
          const itemData = [];
          items.forEach((item) => {
            const r = item.getBoundingClientRect();
            itemData.push({
              el: item,
              cx: r.left + r.width / 2,
              cy: r.top + r.height / 2,
            });
          });

          // Write phase: apply transforms (no layout reads below this line)
          const maxDist = 220;
          for (let i = 0; i < itemData.length; i++) {
            const { el, cx, cy } = itemData[i];
            const dx = dockMouseX - cx;
            const dy = dockMouseY - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < maxDist) {
              const factor = 1 - (dist / maxDist);
              const scale = 0.85 + factor * 0.75;
              const rotY = (dx / maxDist) * 35;
              const rotX = -(dy / maxDist) * 25;
              const lift = -factor * 8;
              el.style.transform = 'perspective(500px) rotateY(' + rotY.toFixed(1) + 'deg) rotateX(' + rotX.toFixed(1) + 'deg) scale(' + scale.toFixed(2) + ') translateY(' + lift.toFixed(1) + 'px)';
              el.style.opacity = (0.35 + factor * 0.65).toFixed(2);
              el.style.zIndex = Math.round(8 + factor * 5);
              // Use box-shadow instead of filter for performance
              const shadowAlpha = factor * 0.5;
              el.style.boxShadow = '0 ' + (factor * 12).toFixed(0) + 'px ' + (factor * 16).toFixed(0) + 'px rgba(0,0,0,' + shadowAlpha.toFixed(2) + ')';
              el.classList.add('dock-active');
            } else {
              el.style.transform = '';
              el.style.opacity = '';
              el.style.zIndex = '';
              el.style.boxShadow = '';
              el.classList.remove('dock-active');
            }
          }
        };

        const scheduleDockUpdate = (e) => {
          dockMouseX = e.clientX;
          dockMouseY = e.clientY;
          if (!dockRafId) {
            dockRafId = requestAnimationFrame(updateDockMagnification);
          }
        };

        queueArea.addEventListener('mousemove', (e) => {
          scheduleDockUpdate(e);
          // Pause carousel when hovering a queue item
          if (e.target.closest('.queue-item')) return;
          // Edge-triggered carousel scroll
          var rect = queueArea.getBoundingClientRect();
          var edgePct = 0.15; // 15% from edges triggers scroll
          var leftEdge = rect.left + rect.width * edgePct;
          var rightEdge = rect.right - rect.width * edgePct;
          var scrollSpeed = 0;
          if (e.clientX < leftEdge) {
            scrollSpeed = -3 * (1 - (e.clientX - rect.left) / (rect.width * edgePct));
          } else if (e.clientX > rightEdge) {
            scrollSpeed = 3 * ((e.clientX - rightEdge) / (rect.width * edgePct));
          }
          queueArea.scrollLeft += scrollSpeed;
        }, { passive: true });
        queueArea.addEventListener('mouseenter', () => { dockActive = true; });
        queueArea.addEventListener('mouseleave', () => {
          dockActive = false;
          if (dockRafId) { cancelAnimationFrame(dockRafId); dockRafId = null; }
          queueArea.querySelectorAll('.queue-item').forEach((item) => {
            item.style.transform = '';
            item.style.opacity = '';
            item.style.zIndex = '';
            item.style.boxShadow = '';
            item.classList.remove('dock-active');
          });
        });

        window._dockMagEnabled = function(v) { dockMagEnabled = v; };
      }

      // Wire user management and settings buttons
      const btnUser = document.getElementById('btn-user');
      if (btnUser) {
        btnUser.addEventListener('click', (e) => {
          e.stopPropagation();
          try {
            if (typeof UserPanel !== 'undefined' && UserPanel.toggle) {
              UserPanel.toggle();
              if (typeof showToast !== 'undefined') showToast('👤 用户管理');
            }
          } catch(err) { console.error('[BTN] User toggle error:', err); }
        });
      }
      const btnSettings = document.getElementById('btn-settings');
      if (btnSettings) {
        btnSettings.addEventListener('click', (e) => {
          e.stopPropagation();
          try {
            if (typeof DIYSettings !== 'undefined' && DIYSettings.toggle) {
              DIYSettings.toggle();
              if (typeof showToast !== 'undefined') showToast('⚙️ 设置');
            }
          } catch(err) { console.error('[BTN] Settings toggle error:', err); }
        });
      }

      } catch(e) { console.error('[BubbleChamber] init ERROR:', e); }
      console.log('Bubble Chamber Manager initialized');
    },

    handleEdgeEnter(side) {
      ChamberBase.hovered[side] = true;
      ChamberBase.showChamber(side);
    },

    handleEdgeLeave(side) {
      ChamberBase.hovered[side] = false;
      setTimeout(() => {
        if (!ChamberBase.hovered[side] && !ChamberBase.pinned[side]) {
          ChamberBase.hideChamber(side);
        }
      }, 150);
    },

    handleEdgeClick(side) {
      ChamberBase.pinned[side] = !ChamberBase.pinned[side];
      const el = ChamberBase.chambers[side];
      if (!el) return;

      if (ChamberBase.pinned[side]) {
        el.classList.add('pinned');
      } else {
        el.classList.remove('pinned');
        if (!ChamberBase.hovered[side]) {
          ChamberBase.hideChamber(side);
        }
      }
    },

    showChamber(side) {
      const el = ChamberBase.chambers[side];
      if (!el) return;
      el.classList.add('visible');
      // Sync inline lyric visibility (right chamber → center single-line lyric)
      if (side === 'right' && typeof window._updateInlineLyricVisibility === 'function') {
        setTimeout(window._updateInlineLyricVisibility, 50);
      }
      el.classList.remove('hiding');
    },

    hideChamber(side) {
      const el = ChamberBase.chambers[side];
      if (!el) return;
      if (ChamberBase.pinned[side]) return;
      el.classList.add('hiding');
      el.classList.remove('visible');
      // Sync inline lyric visibility
      if (side === 'right' && typeof window._updateInlineLyricVisibility === 'function') {
        setTimeout(window._updateInlineLyricVisibility, 50);
      }
    },

    // ── Utility ──
    escapeHtml(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },
  };

  window.ChamberBase = ChamberBase;
  // Wire playlist-back button (moved from inline onclick for CSP compliance)
  var btnBack = document.getElementById('btn-playlist-back');
  if (btnBack) {
    btnBack.addEventListener('click', function() {
      if (typeof DataCache !== 'undefined') {
        var c = DataCache.getCachedPlaylists();
        if (c) {
          if (typeof BubbleChamber !== 'undefined') BubbleChamber.setUserPlaylists(c);
          btnBack.style.display = 'none';
          return;
        }
      }
      if (typeof FluidMusicApp !== 'undefined') FluidMusicApp.syncPlaylists();
    });
  }

  console.log('FluidMusic Chamber Base loaded');
})();
