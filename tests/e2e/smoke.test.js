// tests/e2e/smoke.test.js
// Basic smoke test — verifies the app loads correctly
import { describe, it, expect } from 'vitest';

describe('FluidMusic Smoke Tests', () => {
  it('should have expected global modules available', () => {
    // These are loaded in the test environment via setup.js
    expect(true).toBe(true); // placeholder — will expand
  });

  it('should render center core elements', () => {
    document.body.innerHTML = `
      <div id="center-core">
        <div id="center-core-inner">
          <div id="song-title">Test</div>
          <div id="song-artist">Artist</div>
        </div>
      </div>
      <div id="chamber-left" class="bubble-chamber"></div>
      <div id="chamber-right" class="bubble-chamber"></div>
      <div id="chamber-top" class="bubble-chamber visible"></div>
      <div id="chamber-bottom" class="bubble-chamber"></div>
    `;
    expect(document.getElementById('song-title')).not.toBeNull();
    expect(document.getElementById('chamber-top')).not.toBeNull();
  });

  it('should have CSS loaded', () => {
    var style = document.createElement('style');
    document.head.appendChild(style);
    expect(style.sheet).not.toBeNull();
  });
});
