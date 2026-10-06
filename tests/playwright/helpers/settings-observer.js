// Test-only readiness observer, loaded before the unchanged shipping script.
// Keep real Chrome storage and callback semantics; do not supply mock settings.
(() => {
  const storage = chrome.storage.local;
  const original = storage.get;
  storage.get = function (...args) {
    if (args[0] === null && typeof args[1] === 'function') {
      const callback = args[1];
      args[1] = function (...values) {
        const result = callback.apply(this, values);
        document.documentElement.setAttribute('data-gec-test-settings-ready', 'true');
        return result;
      };
      storage.get = original;
    }
    return original.apply(this, args);
  };
})();
