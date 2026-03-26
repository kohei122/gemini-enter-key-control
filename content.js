function sanitizeMode(mode) {
  return mode === "ctrl" || mode === "both" || mode === "combo" ? mode : "shift";
}

function sanitizeEnabled(enabled) {
  if (enabled === true || enabled === false) return enabled;
  if (enabled === "true") return true;
  if (enabled === "false") return false;
  return true;
}

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "shift"
};

let settings = { ...DEFAULT_SETTINGS };
let settingsLoaded = false;
let isComposingActive = false;
let lastCompositionEndAt = 0;
const COMPOSITION_END_GRACE_MS = 80;
const DEBUG_IME_EVENTS = false;
let suppressSendUntil = 0;
let pendingNewlineTextbox = null;

chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
  const next = {
    enabled: sanitizeEnabled(stored.enabled),
    mode: sanitizeMode(stored.mode)
  };

  settings = next;
  settingsLoaded = true;
  chrome.storage.local.set(next);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes.enabled) {
    settings.enabled = sanitizeEnabled(changes.enabled.newValue);
  }

  if (changes.mode) {
    settings.mode = sanitizeMode(changes.mode.newValue);
  }
});

function getTargetTextbox(target) {
  if (!target) return null;

  const element = target instanceof Element ? target : target.parentElement;
  if (!element) return null;

  return element.closest('div[contenteditable="true"][role="textbox"]');
}

function findSendButton() {
  const selectors = [
    'button[aria-label*="送信"]',
    'button[aria-label*="Send"]'
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector);
    if (button && !button.disabled) {
      return button;
    }
  }

  return null;
}

function isSendButtonElement(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('button[aria-label*="送信"], button[aria-label*="Send"]'));
}

function armSuppressSend(textbox) {
  suppressSendUntil = performance.now() + 150;
  pendingNewlineTextbox = textbox;
}

function clearSuppressSend() {
  suppressSendUntil = 0;
  pendingNewlineTextbox = null;
}

function shouldSuppressSend() {
  return Boolean(pendingNewlineTextbox) && performance.now() < suppressSendUntil;
}

function insertLineBreak(textbox) {
  textbox.focus();

  if (document.execCommand("insertLineBreak")) {
    return true;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  const commonNode = range.commonAncestorContainer;
  const root = commonNode && commonNode.getRootNode ? commonNode.getRootNode() : null;
  if (!textbox.contains(commonNode) && root !== textbox.getRootNode()) return false;

  range.deleteContents();
  const br = document.createElement("br");
  range.insertNode(br);

  const nextRange = document.createRange();
  nextRange.setStartAfter(br);
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);

  return true;
}

function logImeEvent(event, textbox) {
  if (!DEBUG_IME_EVENTS) return;
  console.log("[gemini-enter-debug]", {
    type: event.type,
    key: event.key,
    code: event.code,
    keyCode: event.keyCode,
    inputType: event.inputType,
    data: event.data,
    isComposing: event.isComposing,
    composingActive: isComposingActive,
    sinceCompositionEnd: Math.round(performance.now() - lastCompositionEndAt),
    inTextbox: Boolean(textbox)
  });
}

function handleKey(event) {
  const isEnter = event.code === "Enter" || event.code === "NumpadEnter";
  const textbox = getTargetTextbox(event.target);
  const inCompositionGraceWindow =
    lastCompositionEndAt > 0 &&
    performance.now() - lastCompositionEndAt < COMPOSITION_END_GRACE_MS;

  logImeEvent(event, textbox);
  if (!event.isTrusted) return;
  if (isComposingActive || event.isComposing || event.keyCode === 229 || inCompositionGraceWindow) return;
  if (!settingsLoaded) return;
  if (!settings.enabled) return;
  if (!textbox || !isEnter) return;

  const mode = sanitizeMode(settings.mode);
  const isOnlyEnter = !event.ctrlKey && !event.metaKey && !event.shiftKey;
  let isSend = false;

  if (mode === "shift") {
    isSend = event.shiftKey && !event.ctrlKey && !event.metaKey;
  } else if (mode === "ctrl") {
    isSend = event.ctrlKey && !event.shiftKey && !event.metaKey;
  } else if (mode === "both") {
    isSend =
      (event.shiftKey && !event.ctrlKey && !event.metaKey) ||
      (event.ctrlKey && !event.shiftKey && !event.metaKey);
  } else if (mode === "combo") {
    isSend = event.shiftKey && event.ctrlKey && !event.metaKey;
  }

  // Enter only -> newline
  if (isOnlyEnter) {
    armSuppressSend(textbox);
    return;
  }

  // Configured shortcut -> send
  if (isSend) {
    clearSuppressSend();
    event.preventDefault();

    const sendButton = findSendButton();
    if (sendButton) {
      sendButton.click();
    }
    return;
  }
}

document.addEventListener("keydown", handleKey, { capture: true });

document.addEventListener("click", (event) => {
  if (!settingsLoaded || !settings.enabled) return;
  if (!shouldSuppressSend()) return;
  if (!isSendButtonElement(event.target)) return;

  event.preventDefault();
  event.stopPropagation();

  if (pendingNewlineTextbox) {
    insertLineBreak(pendingNewlineTextbox);
  }
  clearSuppressSend();
}, { capture: true });

document.addEventListener("submit", (event) => {
  if (!settingsLoaded || !settings.enabled) return;
  if (!shouldSuppressSend()) return;

  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (!pendingNewlineTextbox || !form.contains(pendingNewlineTextbox)) return;

  event.preventDefault();
  event.stopPropagation();

  insertLineBreak(pendingNewlineTextbox);
  clearSuppressSend();
}, { capture: true });

document.addEventListener("compositionstart", (event) => {
  const textbox = getTargetTextbox(event.target);
  if (!textbox) return;
  isComposingActive = true;
  logImeEvent(event, textbox);
}, { capture: true });

document.addEventListener("compositionupdate", (event) => {
  const textbox = getTargetTextbox(event.target);
  if (!textbox) return;
  logImeEvent(event, textbox);
}, { capture: true });

document.addEventListener("compositionend", (event) => {
  const textbox = getTargetTextbox(event.target);
  if (!textbox) return;
  isComposingActive = false;
  lastCompositionEndAt = performance.now();
  logImeEvent(event, textbox);
}, { capture: true });

document.addEventListener("keyup", (event) => {
  const textbox = getTargetTextbox(event.target);
  if (!textbox) return;
  logImeEvent(event, textbox);
}, { capture: true });

document.addEventListener("beforeinput", (event) => {
  const textbox = getTargetTextbox(event.target);
  if (!textbox) return;
  logImeEvent(event, textbox);
}, { capture: true });

document.addEventListener("input", (event) => {
  const textbox = getTargetTextbox(event.target);
  if (!textbox) return;
  logImeEvent(event, textbox);
}, { capture: true });
