// ============================================================
// Tests for EventBus — pub/sub event system (interface contract)
// Phase 1: contract tests — Phase 2 will implement the real module
// ============================================================
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('EventBus (interface contract)', () => {
  // Minimal EventBus implementation serving as the interface contract.
  // Phase 2 will replace this with the real window.EventBus module.
  const EventBus = {
    _listeners: {},

    on(event, callback) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(callback);
      return () => this.off(event, callback);
    },

    once(event, callback) {
      const wrapper = (...args) => {
        this.off(event, wrapper);
        callback(...args);
      };
      return this.on(event, wrapper);
    },

    off(event, callback) {
      if (!this._listeners[event]) return;
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    },

    emit(event, ...args) {
      if (!this._listeners[event]) return;
      // Iterate over a copy so once() removals during emit are safe
      [...this._listeners[event]].forEach(cb => cb(...args));
    },

    clear() {
      this._listeners = {};
    },
  };

  beforeEach(() => {
    EventBus.clear();
  });

  it('should register listener and receive events', () => {
    const handler = vi.fn();
    EventBus.on('test', handler);
    EventBus.emit('test', 'hello', 42);
    expect(handler).toHaveBeenCalledWith('hello', 42);
  });

  it('should return unsubscribe function from on()', () => {
    const handler = vi.fn();
    const unsubscribe = EventBus.on('test', handler);
    EventBus.emit('test');
    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
    EventBus.emit('test');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should support once() that fires only one time', () => {
    const handler = vi.fn();
    EventBus.once('test', handler);
    EventBus.emit('test');
    EventBus.emit('test');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should not deliver to unsubscribed listeners', () => {
    const handler = vi.fn();
    EventBus.on('test', handler);
    EventBus.off('test', handler);
    EventBus.emit('test');
    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle events with no listeners gracefully', () => {
    expect(() => EventBus.emit('nonexistent')).not.toThrow();
  });

  it('should support multiple listeners for the same event', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    EventBus.on('test', h1);
    EventBus.on('test', h2);
    EventBus.emit('test', 'data');
    expect(h1).toHaveBeenCalledWith('data');
    expect(h2).toHaveBeenCalledWith('data');
  });

  it('should not leak listeners between different event names', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    EventBus.on('eventA', h1);
    EventBus.on('eventB', h2);
    EventBus.emit('eventA');
    expect(h1).toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });
});
