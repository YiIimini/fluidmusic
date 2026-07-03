// ============================================================
// FluidMusic — DIY Settings Renderer
// Extracted from diy-settings.js: renders tab configs as DOM.
// Reads settings/config/defaults from window.DIYSettings.
// ============================================================
(function () {
  if (typeof window.DIYSettings === 'undefined') {
    console.warn('DIYSettings not loaded before diy-renderer.js');
    return;
  }

  /**
   * Render a DIY settings tab into #diy-content.
   * @param {string} tabId - Tab key (e.g. 'particle', 'background', 'system')
   * @param {object} D - DIYSettings object (passed for minifier-friendliness)
   */
  DIYSettings._renderTab = function(tabId, D) {
    console.log("[renderTab] tabId:", tabId, "config:", D.tabConfigs[tabId] ? D.tabConfigs[tabId].title : "NOT FOUND");
    const container = document.getElementById('diy-content');
    const config = D.tabConfigs[tabId];
    if (!container || !config) return;

    D.activeTab = tabId;
    const defaults = D._defaults;

    let html = '';
    config.fields.forEach((field) => {
      // Section header
      if (field.type === 'section') {
        html += '<div class="diy-section-header">' + field.label + '</div>';
        return;
      }
      const value = D.settings[field.key] != null ? D.settings[field.key] : defaults[field.key];
      // 3-column row: name | control | actions(↺+?)
      html += '<div class="diy-setting-row">';
      html += '<span class="diy-label" title="' + (field.help || '') + '">' + field.label + '</span>';

      // Center: parameter control
      html += '<div class="diy-control">';
      if (field.type === 'range') {
        html += '<input type="range" class="diy-slider" data-key="' + field.key + '" min="' + field.min + '" max="' + field.max + '" step="' + field.step + '" value="' + value + '">';
        html += '<span class="diy-val">' + value + '</span>';
      } else if (field.type === 'select') {
        html += '<select class="diy-select" data-key="' + field.key + '">';
        for (const [optVal, optLabel] of Object.entries(field.options)) {
          html += '<option value="' + optVal + '"' + (value === optVal ? ' selected' : '') + '>' + optLabel + '</option>';
        }
        html += '</select>';
      } else if (field.type === 'color') {
        html += '<label class="diy-color-wrap">';
        html += '<input type="color" class="diy-color-input" data-key="' + field.key + '" value="' + (value || '#f0c060') + '">';
        html += '<span class="diy-color-val">' + (value || '#f0c060') + '</span>';
        html += '</label>';
      } else if (field.type === 'toggle') {
        html += '<label class="diy-toggle-wrap">';
        html += '<input type="checkbox" data-key="' + field.key + '" ' + (value ? 'checked' : '') + '>';
        html += '<span class="diy-toggle-state">' + (value ? '开' : '关') + '</span>';
        html += '</label>';
      } else {
        html += '<input type="text" class="diy-input" data-key="' + field.key + '" value="' + value + '">';
      }
      html += '</div>';

      // Right: action buttons (reset + help)
      html += '<div class="diy-actions">';
      html += '<button class="diy-reset-btn" data-key="' + field.key + '" title="重置">↺</button>';
      html += '<button class="diy-help-btn" data-help="' + (field.help || '').replace(/"/g, '&quot;') + '" title="点击查看说明">?</button>';
      html += '</div>';

      html += '</div>';
    });

    container.innerHTML = html;

    // Background tab: Image/video picker + Restore Defaults + Clear Cache
// Background tab: Image/video picker + Restore Defaults + Clear Cache (also in system tab)
    if (tabId === 'background') {
      var wpRow = document.createElement('div');
      wpRow.className = 'diy-setting-row';
      wpRow.style.flexDirection = 'column';
      wpRow.style.alignItems = 'flex-start';
      wpRow.style.gap = '8px';
      wpRow.innerHTML = '<span class="diy-label">🖼 背景</span>'
        + '<div style="display:flex;gap:8px;align-items:center;">'
        + '<button class="user-panel-btn" id="btn-pick-wallpaper" style="font-size:11px;" onclick="window._pickWallpaper()">选择图片</button>'
        + '<button class="user-panel-btn" id="btn-pick-bg-video" style="font-size:11px;" onclick="window._pickBgVideo()">选择视频</button>'
        + '<button class="diy-reset-btn" id="btn-clear-wallpaper" title="清除背景" style="width:22px;height:22px;">✕</button>'
        + '</div>'
        + '<div id="wallpaper-thumb-preview"></div>'
        + '<video id="bg-video-preview" style="display:none;width:120px;height:68px;border-radius:6px;border:1px solid var(--glass-border);object-fit:cover;margin-top:4px;" muted loop></video>';
      container.appendChild(wpRow);

      // Show thumbnail preview
      var updateThumb = function() {
        var thumb = document.getElementById('wallpaper-thumb-preview');
        var vid = document.getElementById('bg-video-preview');
        if (!thumb) return;
        var savedImg = localStorage.getItem('fluidmusic-wallpaper');
        var savedVid = localStorage.getItem('fluidmusic-has-bg-video');
        if (savedVid) {
          var videoUrl = window.location.origin + '/bg-video?t=' + Date.now();
          if (vid) { vid.src = videoUrl; vid.style.display = 'block'; vid.play().catch(function(){}); }
          thumb.innerHTML = '<span style="font-size:10px;color:var(--text-dim);">已设置视频背景</span>';
          // Apply video to wallpaper layer, but don't overwrite an already-playing video
          var wpLayer = document.getElementById('wallpaper-layer');
          if (wpLayer && !wpLayer.querySelector('video')) {
            wpLayer.innerHTML = '<video src="' + videoUrl + '" autoplay muted loop playsinline style="width:100%;height:100%;object-fit:cover;background:#0a0a14;" onerror="this.parentElement.classList.remove(\'loaded\');this.parentElement.innerHTML=\'\';localStorage.removeItem(\'fluidmusic-has-bg-video\');"></video>';
            wpLayer.classList.add('loaded');
          }
        } else if (savedImg) {
          if (vid) vid.style.display = 'none';
          thumb.innerHTML = '<div style="display:flex;align-items:center;gap:10px;margin-top:6px;">'
            + '<img src="' + savedImg + '" style="width:80px;height:80px;border-radius:8px;border:1px solid var(--glass-border);object-fit:cover;flex-shrink:0;">'
            + '<span style="font-size:10px;color:var(--text-dim);">已设置</span>'
            + '</div>';
        } else {
          if (vid) vid.style.display = 'none';
          thumb.innerHTML = '<span style="font-size:11px;color:var(--text-dim);">未设置</span>';
        }
      };
      updateThumb();

      // Image picker — exposed globally
      window._pickWallpaper = async function() {
        if (typeof fluidmusic !== 'undefined' && fluidmusic.pickWallpaper) {
          var result = await fluidmusic.pickWallpaper();
          if (result && result.ok && result.dataUrl) {
            localStorage.removeItem('fluidmusic-has-bg-video');
            localStorage.setItem('fluidmusic-wallpaper', result.dataUrl);
            if (typeof applyWallpaper === 'function') applyWallpaper(result.dataUrl);
            if (typeof showToast !== 'undefined') showToast('🖼 背景已更新');
            updateThumb();
          }
        } else {
          if (typeof showToast !== 'undefined') showToast('⚠ 需要Electron环境');
        }
      };

      // Video picker — exposed globally so inline onclick works after re-render
      window._pickBgVideo = async function() {
        console.log('[BgVideo] _pickBgVideo called');
        if (typeof fluidmusic !== 'undefined' && typeof fluidmusic.pickBgVideo === 'function') {
          console.log('[BgVideo] IPC available, invoking...');
          try {
            var result = await fluidmusic.pickBgVideo();
            console.log('[BgVideo] pick result:', JSON.stringify(result));
            if (result && result.ok && result.dataUrl) {
              localStorage.removeItem('fluidmusic-wallpaper');
              localStorage.setItem('fluidmusic-has-bg-video', 'true');
              var wpLayer = document.getElementById('wallpaper-layer');
              var videoUrl = window.location.origin + '/bg-video?t=' + Date.now();
              console.log('[BgVideo] Creating video, URL:', videoUrl, 'wpLayer:', !!wpLayer);
              if (wpLayer) {
                wpLayer.innerHTML = '';
                var vid = document.createElement('video');
                vid.src = videoUrl;
                vid.autoplay = true;
                vid.muted = true;
                vid.loop = true;
                vid.playsInline = true;
                vid.style.cssText = 'width:100%;height:100%;object-fit:cover;background:#0a0a14;';
                vid.preload = 'auto';
                vid.onloadeddata = function() {
                  console.log('[BgVideo] loadeddata fired');
                  wpLayer.style.opacity = '0.5';
                  wpLayer.classList.add('loaded');
                };
                vid.oncanplay = function() {
                  console.log('[BgVideo] canplay fired');
                  vid.play().catch(function(e) { console.error('[BgVideo] play failed:', e); });
                };
                vid.onerror = function(_e) {
                  var msg = vid.error ? (vid.error.message || '未知错误') : '解码失败';
                  console.error('[BgVideo] video load error:', msg);
                  if (typeof showToast !== 'undefined') showToast('⚠ 视频格式不兼容，请使用H.264编码的MP4文件');
                  wpLayer.innerHTML = '';
                  wpLayer.classList.remove('loaded');
                  localStorage.removeItem('fluidmusic-has-bg-video');
                };
                wpLayer.appendChild(vid);
                console.log('[BgVideo] video element appended');
              } else {
                console.error('[BgVideo] wallpaper-layer not found!');
              }
              if (typeof showToast !== 'undefined') showToast('🎬 视频背景已设置');
              updateThumb();
            } else {
              if (typeof showToast !== 'undefined') showToast('⚠ 未选择视频');
            }
          } catch(e) {
            console.error('[BgVideo] error:', e);
            if (typeof showToast !== 'undefined') showToast('⚠ 视频选择失败: ' + e.message);
          }
        } else {
          console.log('[BgVideo] fluidmusic.pickBgVideo not available. fluidmusic:', typeof fluidmusic, 'pickBgVideo:', typeof fluidmusic?.pickBgVideo);
          if (typeof showToast !== 'undefined') showToast('⚠ 需要Electron环境');
        }
      };

      document.getElementById('btn-clear-wallpaper').addEventListener('click', function() {
        localStorage.removeItem('fluidmusic-wallpaper');
        localStorage.removeItem('fluidmusic-has-bg-video');
        if (typeof fluidmusic !== 'undefined' && typeof fluidmusic.clearBgVideo === 'function') {
          fluidmusic.clearBgVideo();
        }
        // Reset wallpaper layer to pristine first-launch state
        if (typeof applyWallpaper === 'function') applyWallpaper(null);
        var wpLayer = document.getElementById('wallpaper-layer');
        if (wpLayer) {
          wpLayer.innerHTML = '';
          wpLayer.classList.remove('loaded');
          wpLayer.style.opacity = '0';
          wpLayer.style.backgroundImage = '';
          wpLayer.style.backgroundColor = '';
        }
        // Reset wallpaper settings to defaults
        D.settings.wallpaperOpacity = 0.3;
        D.settings.wallpaperBlur = 20;
        D.settings.wallpaperRippleSpeed = 1.0;
        document.documentElement.style.setProperty('--wallpaper-opacity', '0.3');
        document.documentElement.style.setProperty('--wallpaper-blur', '20px');
        D.saveSettings();
        D.applySettings();
        if (typeof showToast !== 'undefined') showToast('🗑 背景已清除，恢复默认');
        updateThumb();
      });

    }

    // System tab: restore defaults button at bottom
    if (tabId === 'system') {
      var sysRow = document.createElement('div');
      sysRow.className = 'diy-setting-row';
      sysRow.style.borderBottom = 'none';
      sysRow.style.justifyContent = 'flex-end';
      sysRow.style.padding = '16px 0 4px 0';

      var restoreBtn = document.createElement('button');
      restoreBtn.className = 'user-panel-btn';
      restoreBtn.textContent = '↺ 恢复默认';
      restoreBtn.title = '将所有设置恢复为默认值';
      restoreBtn.addEventListener('click', function() {
        if (confirm('确定将所有设置恢复为默认值？')) {
          Object.assign(D.settings, JSON.parse(JSON.stringify(defaults)));
          D.saveSettings();
          D.applySettings();
          D._renderTab('system', D);
          if (typeof showToast !== 'undefined') showToast('✅ 已恢复默认设置');
        }
      });
      sysRow.appendChild(restoreBtn);
      container.appendChild(sysRow);
    }

    // Attach listeners
    container.querySelectorAll('input, select').forEach((input) => {
      input.addEventListener('input', function () {
        const key = this.dataset.key;
        let val;
        if (this.type === 'checkbox') {
          val = this.checked;
          const wrap = this.closest('.diy-toggle-wrap');
          if (wrap) {
            const state = wrap.querySelector('.diy-toggle-state');
            if (state) state.textContent = val ? '开' : '关';
          }
        } else if (this.type === 'range') {
          val = parseFloat(this.value);
          var rowEl2 = this.closest('.diy-setting-row');
          if (rowEl2) { var valEl = rowEl2.querySelector('.diy-val'); if (valEl) valEl.textContent = val; }
        } else if (this.type === 'color') {
          val = this.value;
          var colorRow = this.closest('.diy-setting-row');
          if (colorRow) { var colorEl = colorRow.querySelector('.diy-color-val'); if (colorEl) colorEl.textContent = val; }
        } else if (this.tagName === 'SELECT') {
          val = this.value;
        } else {
          val = this.value;
        }
        D.settings[key] = val;
        D.saveSettings();
        D.applySettings();
      });
      if (input.tagName === 'SELECT') {
        input.addEventListener('change', function () {
          D.settings[this.dataset.key] = this.value;
          D.saveSettings();
          D.applySettings();
        });
      }
    });

    // Wire reset buttons
    container.querySelectorAll('.diy-reset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        const defVal = defaults[key];
        if (defVal === undefined) return;
        D.settings[key] = defVal;
        D.saveSettings();
        D.applySettings();
        D._renderTab(tabId, D); // re-render to reflect changes
      });
    });

    // Wire help buttons
    container.querySelectorAll('.diy-help-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const helpText = btn.dataset.help || '暂无详细说明';
        // Remove any existing tooltip
        const existing = document.querySelector('.diy-help-tooltip');
        if (existing) existing.remove();
        // Create tooltip
        const tip = document.createElement('div');
        tip.className = 'diy-help-tooltip';
        tip.textContent = helpText;
        btn.appendChild(tip);
        // Auto-remove after 3s
        setTimeout(() => { if (tip.parentNode) tip.remove(); }, 3000);
        tip.addEventListener('click', (ev) => { ev.stopPropagation(); if (tip.parentNode) tip.remove(); });
      });
    });

    // Click outside closes any help tooltip
    container.addEventListener('click', () => {
      const tip = document.querySelector('.diy-help-tooltip');
      if (tip) tip.remove();
    });

    // Update tab active state
    document.querySelectorAll('.diy-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === tabId);
    });
  };

  console.log('FluidMusic DIY Renderer loaded');
})();
