(() => {
  if (location.protocol !== "https:" || location.hostname !== "flow.google.com" || window.top !== window) return;
  const KEY = "__gecGoogleFlowCurrent";
  if (window[KEY]) { window[KEY].refresh(); return; }
  const EDITOR = '.ProseMirror[contenteditable="true"]';
  const SEND = 'button[type="submit"]';
  let dispatching = false;
  let handoffButton = null;
  const COMPOSITION_END_GRACE_MS = 80;
  let state = null;
  let revision = 0;
  let composing = false;
  let endedAt = -Infinity;
  let lastUrl = location.href;
  let disposed = false;

  function isFlowUrl() {
    const url = new URL(location.href);
    return url.protocol === "https:" && url.hostname === "flow.google.com" &&
      /^\/project\/[^/]+\/?$/.test(url.pathname);
  }

  function visible(element) {
    const style = getComputedStyle(element);
    return element.getClientRects().length > 0 && style.display !== "none" &&
      style.visibility !== "hidden" && style.visibility !== "collapse";
  }
  function disabled(element) {
    return element.disabled || element.hasAttribute("disabled") ||
      element.getAttribute("aria-disabled") === "true";
  }
  function composer(target) {
    if (!isFlowUrl() || !(target instanceof Element)) return null;
    const editor = target.closest(EDITOR);
    if (!(editor instanceof HTMLElement) || !editor.isConnected || !visible(editor) || disabled(editor)) return null;
    const active = document.activeElement;
    if (active !== editor && !editor.contains(active)) return null;
    const wrapper = editor.closest("flow-rich-text-editor");
    const root = editor.closest("flow-base-prompt-box");
    if (!wrapper || !root || !root.contains(wrapper)) return null;
    const editors = root.querySelectorAll(EDITOR);
    const buttons = root.querySelectorAll(SEND);
    if (editors.length !== 1 || editors[0] !== editor || buttons.length !== 1) return null;
    const button = buttons[0];
    if (button.closest("flow-base-prompt-box") !== root) return null;
    return { editor, button };
  }
  function isSendKey(event) {
    return event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
  }
  function released(event) {
    if (event.isTrusted && ["Enter", "NumpadEnter"].includes(event.code)) handoffButton = null;
  }
  function live() {
    if (!chrome.runtime?.id) { dispose(); return false; }
    if (lastUrl !== location.href) {
      lastUrl = location.href;
      composing = false;
      endedAt = -Infinity;
    }
    return !disposed && state?.enabled && state.selected && state.granted && state.registered && state.mode === "shift" && isFlowUrl();
  }
  function keydown(event) {
    if (dispatching || !live() || !event.isTrusted || !["Enter", "NumpadEnter"].includes(event.code)) return;
    if (composing || event.isComposing || event.keyCode === 229 || event.which === 229 ||
        performance.now() - endedAt < COMPOSITION_END_GRACE_MS) return;
    if (event.defaultPrevented) return;
    // After handoff, repeated keydowns target the focused button, not the editor.
    if (event.repeat && handoffButton?.isConnected && event.target instanceof Element &&
        handoffButton.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!event.repeat) handoffButton = null;
    const found = composer(event.target);
    if (!found) return;
    if (event.repeat) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (isSendKey(event)) {
      const current = composer(event.target);
      if (!current || current.button !== found.button || !current.button.isConnected ||
          disabled(current.button) || !visible(current.button)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      // Preserve this real key's default action. Flow rejects programmatic clicks.
      // Do not restore editor focus here: the browser still has to activate the button.
      event.stopImmediatePropagation();
      handoffButton = current.button;
      current.button.focus({ preventScroll: true });
      if (document.activeElement !== current.button) {
        handoffButton = null;
        event.preventDefault(); // Focus failed: do not leak a send key into the editor.
      }
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    // In shift-only mode, other modified Enter combinations never initiate sending.
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    // Let ProseMirror create its own BR and transaction. No DOM/execCommand fallback.
    dispatching = true;
    try {
      found.editor.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter", code: "Enter", keyCode: 13, which: 13,
        shiftKey: true, ctrlKey: false, metaKey: false, altKey: false,
        bubbles: true, cancelable: true, composed: true
      }));
    } finally { dispatching = false; }
  }

  function start(event) { if (live() && composer(event.target)) composing = true; }
  function end(event) {
    if (live() && (composing || composer(event.target))) {
      composing = false;
      endedAt = performance.now();
    }
  }
  async function refresh() {
    if (disposed) return;
    const current = ++revision;
    state = null;
    try {
      const next = await chrome.runtime.sendMessage({ type: "gec-flow-state" });
      if (!disposed && current === revision) {
        state = next;
        if (!state?.enabled || !state.selected || !state.granted || !state.registered) {
          composing = false;
          endedAt = -Infinity;
        }
      }
    } catch { if (current === revision) dispose(); }
  }
  function changed(changes, area) {
    if (area === "local" && ["enabled", "mode", "flowEnabled", "flowCurrentEnabled"].some(key => key in changes)) void refresh();
  }
  function message(value) { if (value?.type === "gec-flow-refresh") void refresh(); }
  function dispose() {
    disposed = true;
    state = null;
    revision++;
    window.removeEventListener("keydown", keydown, true);
    window.removeEventListener("keyup", released, true);
    handoffButton = null;
    document.removeEventListener("compositionstart", start, true);
    document.removeEventListener("compositionend", end, true);
    window.removeEventListener("focus", refresh);
    try {
      chrome.storage.onChanged.removeListener(changed);
      chrome.runtime.onMessage.removeListener(message);
    } catch { /* Extension context was invalidated. */ }
    delete window[KEY];
  }
  window[KEY] = { refresh, dispose };
  window.addEventListener("keydown", keydown, true);
  window.addEventListener("keyup", released, true);
  document.addEventListener("compositionstart", start, true);
  document.addEventListener("compositionend", end, true);
  window.addEventListener("focus", refresh);
  chrome.storage.onChanged.addListener(changed);
  chrome.runtime.onMessage.addListener(message);
  void refresh();
})();
