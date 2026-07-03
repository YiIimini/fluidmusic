// ============================================================
// FluidMusic — Module Registry
// Dependency injection system replacing window.X global namespace
// Modules declare dependencies; registry resolves and initializes in order
// ============================================================
(function () {
  'use strict';

  const registry = {
    _modules: {},       // name → { deps, factory, instance, initialized }
    _ready: false,
    _initOrder: [],     // tracks initialization order for debugging
  };

  /**
   * Register a module factory.
   * @param {string} name - Module name (camelCase, e.g. 'audioEngine')
   * @param {string[]} deps - Names of dependencies (empty array if none)
   * @param {Function} factory - (deps...) => module instance
   * @param {Object} [opts] - Options: { lazy: false, priority: 0 }
   */
  function register(name, deps, factory, opts) {
    opts = opts || {};
    if (registry._modules[name]) {
      console.warn('[Registry] Module "' + name + '" already registered, overwriting');
    }
    registry._modules[name] = {
      deps: deps || [],
      factory: factory,
      instance: null,
      initialized: false,
      lazy: opts.lazy || false,
      priority: opts.priority || 0,
    };
  }

  /**
   * Get a module instance (resolves lazily if not yet initialized).
   * Circular dependencies will throw.
   */
  function get(name, _resolving) {
    _resolving = _resolving || new Set();
    if (_resolving.has(name)) {
      throw new Error('[Registry] Circular dependency detected: ' + [..._resolving, name].join(' → '));
    }

    const mod = registry._modules[name];
    if (!mod) {
      throw new Error('[Registry] Module "' + name + '" not registered');
    }

    if (mod.instance !== null) return mod.instance;

    _resolving.add(name);
    const resolvedDeps = mod.deps.map(d => get(d, _resolving));
    mod.instance = mod.factory.apply(null, resolvedDeps);
    mod.initialized = true;
    registry._initOrder.push(name);
    _resolving.delete(name);

    return mod.instance;
  }

  /**
   * Initialize all non-lazy modules in dependency order.
   * Returns a promise that resolves when all are ready.
   */
  async function initAll() {
    if (registry._ready) return;
    console.log('[Registry] Initializing all modules...');

    // Topological sort by dependency graph
    const sorted = topologicalSort();
    console.log('[Registry] Init order:', sorted.join(' → '));

    for (const name of sorted) {
      const mod = registry._modules[name];
      if (mod.lazy) continue;
      try {
        get(name);
        console.log('[Registry] ✓', name);
      } catch (e) {
        console.error('[Registry] ✗ Failed to init', name + ':', e.message);
        throw e;
      }
    }

    registry._ready = true;
    console.log('[Registry] All modules initialized (' + registry._initOrder.length + ' total)');
  }

  /**
   * Topological sort of registered modules by dependencies
   */
  function topologicalSort() {
    const visited = new Set();
    const temp = new Set();
    const order = [];

    function visit(name) {
      if (visited.has(name)) return;
      if (temp.has(name)) {
        console.warn('[Registry] Cycle detected involving:', name);
        return; // break cycle gracefully
      }
      temp.add(name);
      const mod = registry._modules[name];
      if (mod) {
        for (const dep of mod.deps) {
          if (registry._modules[dep]) visit(dep);
        }
      }
      temp.delete(name);
      visited.add(name);
      order.push(name);
    }

    // Sort by priority (higher priority = initialized earlier)
    const names = Object.keys(registry._modules).sort((a, b) => {
      const pa = registry._modules[a].priority || 0;
      const pb = registry._modules[b].priority || 0;
      return pb - pa; // descending priority
    });

    for (const name of names) visit(name);
    return order;
  }

  /**
   * Check if a module is registered and initialized
   */
  function has(name) {
    const mod = registry._modules[name];
    return mod ? mod.initialized : false;
  }

  /**
   * Reset a module (for hot-reload / testing)
   */
  function reset(name) {
    const mod = registry._modules[name];
    if (mod) {
      mod.instance = null;
      mod.initialized = false;
    }
  }

  // Expose on window for gradual migration from window.X
  window.__FM = {
    register: register,
    get: get,
    initAll: initAll,
    has: has,
    reset: reset,
    _registry: registry, // debug access
  };

  console.log('FluidMusic Module Registry loaded');
})();
