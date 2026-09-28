(() => {
  if (location.protocol !== "https:" || location.hostname !== "www.google.com" || window.top !== window) return;
  const KEY = "__gecGoogleAiMode";
  if (window[KEY]) { window[KEY].refresh(); return; }
  const SEND = 'button[data-xid="input-plate-send-button"]';
  const MAX_DEPTH = 6;
  const COMPOSITION_END_GRACE_MS = 80;
  let state = null;
  let revision = 0;
  let composing = false;
  let endedAt = -Infinity;
  let lastUrl = location.href;
  let disposed = false;

  function isAiUrl() {
    const url = new URL(location.href);
    return url.protocol === "https:" && url.hostname === "www.google.com" &&
      url.pathname === "/search" && url.searchParams.getAll("udm").length === 1 &&
      url.searchParams.get("udm") === "50";
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
    if (!isAiUrl() || !(target instanceof HTMLTextAreaElement) ||
        document.activeElement !== target || !target.isConnected || target.readOnly ||
        disabled(target) || !visible(target) || target.getAttribute("maxlength") !== "8192" ||
        target.getAttribute("role") === "combobox" || target.closest('[role="dialog"], dialog')) return null;
    let root = target.parentElement;
    for (let depth = 1; root && depth <= MAX_DEPTH; depth++, root = root.parentElement) {
      if (root === document.body || root === document.documentElement) return null;
      const textareas = root.querySelectorAll("textarea");
      if (textareas.length !== 1 || textareas[0] !== target) return null;
      const buttons = root.querySelectorAll(SEND);
      if (buttons.length > 1) return null;
      if (buttons.length === 1) return { textarea: target, button: buttons[0] };
    }
    return null;
  }
  function shouldSend(event) {
    let mode = ["shift", "ctrl", "both", "combo", "cmd", "shiftCmd"].includes(state.mode) ? state.mode : "shift";
    if (!state.isMac && (mode === "cmd" || mode === "shiftCmd")) mode = "shift";
    const { shiftKey: s, ctrlKey: c, metaKey: m, altKey: a } = event;
    if (a) return false;
    if (mode === "shift") return s && !c && !m;
    if (mode === "ctrl") return c && !s && !m;
    if (mode === "cmd") return m && !s && !c;
    if (mode === "both") return [s, c, m].filter(Boolean).length === 1;
    if (mode === "combo") return s && c && !m;
    return s && m && !c;
  }
  function live() {
    if (!chrome.runtime?.id) { dispose(); return false; }
    if (lastUrl !== location.href) {
      lastUrl = location.href;
      composing = false;
      endedAt = -Infinity;
    }
    return !disposed && state?.enabled && state.selected && state.granted && state.registered && isAiUrl();
  }
  function keydown(event) {
    if (!live() || !event.isTrusted || !["Enter", "NumpadEnter"].includes(event.code)) return;
    if (composing || event.isComposing || event.keyCode === 229 || event.which === 229 ||
        performance.now() - endedAt < COMPOSITION_END_GRACE_MS) return;
    const found = composer(event.target);
    if (!found) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (shouldSend(event)) {
      const current = composer(event.target);
      if (!current || current.button !== found.button || !current.button.isConnected ||
          disabled(current.button) || !visible(current.button)) return;
      current.button.click();
      return;
    }
    const textarea = found.textarea;
    textarea.setRangeText("\n", textarea.selectionStart, textarea.selectionEnd, "end");
    textarea.dispatchEvent(new InputEvent("input", {
      bubbles: true, composed: true, inputType: "insertLineBreak", data: null
    }));
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
      const next = await chrome.runtime.sendMessage({ type: "gec-ai-state" });
      if (!disposed && current === revision) {
        state = next;
        if (!state?.enabled || !state.selected || !state.granted) {
          composing = false;
          endedAt = -Infinity;
        }
      }
    } catch { if (current === revision) dispose(); }
  }
  function changed(changes, area) {
    if (area === "local" && ["enabled", "mode", "googleAiModeEnabled"].some(key => key in changes)) void refresh();
  }
  function message(value) { if (value?.type === "gec-ai-refresh") void refresh(); }
  function dispose() {
    disposed = true;
    state = null;
    revision++;
    document.removeEventListener("keydown", keydown, true);
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
  document.addEventListener("keydown", keydown, true);
  document.addEventListener("compositionstart", start, true);
  document.addEventListener("compositionend", end, true);
  window.addEventListener("focus", refresh);
  chrome.storage.onChanged.addListener(changed);
  chrome.runtime.onMessage.addListener(message);
  void refresh();
})();
