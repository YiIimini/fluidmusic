// ============================================================
// public/js/ts-audio-bridge.js
// Upgrades FluidAudio spectrum with TS AudioEngine data
//
// If the TypeScript AudioEngine is available and initialized,
// FluidAudio.bands is replaced with a live getter that delegates
// to the TS engine's analyser.  Visual modules (fluid-bg,
// particle-cover, etc.) read FluidAudio.bands directly and
// automatically pick up the higher-quality TS spectrum data.
//
// If the TS engine is NOT available the bridge is a no-op and
// the legacy FluidAudio continues to work unchanged.
// ============================================================

(function () {
  'use strict';

  // ---- guard: TS bridge namespace must exist ----
  if (!window.__FM_TS) {
    console.log('[TS-Audio] window.__FM_TS not available — using legacy FluidAudio');
    return;
  }

  // ---- guard: TS AudioEngine instance must be present ----
  var tsAudio = window.__FM_TS.audioEngine;
  if (!tsAudio) {
    console.log('[TS-Audio] TS AudioEngine not registered on __FM_TS — using legacy FluidAudio');
    return;
  }

  // ---- guard: legacy FluidAudio must exist ----
  if (typeof FluidAudio === 'undefined') {
    console.log('[TS-Audio] FluidAudio global not found — nothing to patch');
    return;
  }

  // ---- guard: TS engine must have spectrum capability ----
  if (typeof tsAudio.getSpectrum !== 'function') {
    console.log('[TS-Audio] TS AudioEngine missing getSpectrum() — using legacy FluidAudio');
    return;
  }

  // ================================================================
  // Patch FluidAudio.bands → live getter backed by TS engine
  // ================================================================
  // Visual modules read FluidAudio.bands.bass / .mid / .treble / .energy
  // once per animation frame.  We throttle getSpectrum() calls to ~16 ms
  // so that multiple property reads within the same frame reuse the same
  // analyser snapshot.

  var _cachedSpectrum = null;
  var _spectrumTimestamp = 0;

  Object.defineProperty(FluidAudio, 'bands', {
    configurable: true,
    enumerable: true,
    get: function () {
      var now = performance.now();
      if (!_cachedSpectrum || now - _spectrumTimestamp > 16) {
        _cachedSpectrum = tsAudio.getSpectrum();
        _spectrumTimestamp = now;
      }
      return _cachedSpectrum;
    },
  });

  // Also provide a getSpectrum() shim on FluidAudio so any code that
  // calls it explicitly gets the TS data as well.
  FluidAudio.getSpectrum = function () {
    return tsAudio.getSpectrum();
  };

  // ---- Mirror TS state onto FluidAudio for read-only consumers ----
  // Keep FluidAudio.playing / .volume / .playMode in sync with the TS
  // engine so that UI controls show the correct state regardless of
  // which engine initiated the change.

  if (typeof tsAudio.playing === 'boolean') {
    Object.defineProperty(FluidAudio, '_tsPlaying', {
      get: function () { return tsAudio.playing; },
    });
    // Overwrite playing getter after FluidAudio is fully initialized
    var _patchPlaying = function () {
      if (FluidAudio.ctx) {
        Object.defineProperty(FluidAudio, 'playing', {
          configurable: true,
          enumerable: true,
          get: function () { return tsAudio.playing; },
        });
      }
    };
    // Try immediately; if ctx isn't ready, defer
    _patchPlaying();
    if (!FluidAudio.ctx) {
      var _origInit = FluidAudio.init;
      FluidAudio.init = function () {
        var ret = _origInit.apply(this, arguments);
        _patchPlaying();
        return ret;
      };
    }
  }

  console.log('[TS-Audio] Patched FluidAudio.bands → TS AudioEngine spectrum (throttled @~60fps)');
})();
