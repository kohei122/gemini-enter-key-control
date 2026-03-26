function sanitizeEnabled(enabled) {
  if (enabled === true || enabled === false) return enabled;
  if (enabled === "true") return true;
  if (enabled === "false") return false;
  return true;
}

function sanitizeMode(mode) {
  return mode === "ctrl" || mode === "both" || mode === "combo" ? mode : "shift";
}

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "shift"
};

const DEBUG = false;
const TEXTBOX_SELECTOR = 'div[contenteditable="true"][role="textbox"]';
const SEND_BUTTON_SELECTORS = [
  'button[aria-label*="送信"]',
  'button[aria-label*="Send"]',
  'button[type="submit"]',
  'form button',
  '[role="button"][aria-label*="送信"]',
  '[role="button"][aria-label*="Send"]'
];

let settings = { ...DEFAULT_SETTINGS };
let settingsLoaded = false;
let isDispatchingSyntheticEnter = false;

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

function debugLog(message, data) {
  if (!DEBUG) return;
  console.log("[Gemini Enter Key Control]", message, data || "");
}

function getTargetTextbox(target) {
  if (!target) return null;

  const element = target instanceof Element ? target : target.parentElement;
  if (!element) return null;

  return element.closest(TEXTBOX_SELECTOR);
}

function isElementDisabled(element) {
  if (!(element instanceof HTMLElement)) return true;
  if (element.hasAttribute("disabled")) return true;
  if (element.getAttribute("aria-disabled") === "true") return true;
  if ("disabled" in element && element.disabled === true) return true;
  return false;
}

function isElementVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  return element.getClientRects().length > 0;
}

function collectCandidates(root, selector, list, seen) {
  const nodes = root.querySelectorAll(selector);
  for (const node of nodes) {
    if (seen.has(node)) continue;
    seen.add(node);
    list.push(node);
  }
}

function findSendButton(textbox) {
  const candidates = [];
  const seen = new Set();
  const form = textbox.closest("form");

  if (form) {
    for (const selector of SEND_BUTTON_SELECTORS) {
      collectCandidates(form, selector, candidates, seen);
    }
  }

  for (const selector of SEND_BUTTON_SELECTORS) {
    collectCandidates(document, selector, candidates, seen);
  }

  for (const candidate of candidates) {
    if (!isElementVisible(candidate)) continue;
    if (isElementDisabled(candidate)) continue;
    return candidate;
  }

  return null;
}

function dispatchSyntheticShiftEnter(textbox) {
  setTimeout(() => {
    textbox.focus();
    isDispatchingSyntheticEnter = true;
    try {
      const synthetic = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        shiftKey: true,
        bubbles: true,
        cancelable: true
      });
      textbox.dispatchEvent(synthetic);
    } finally {
      // Prevent accidental self-recursion if future browser behavior changes.
      setTimeout(() => {
        isDispatchingSyntheticEnter = false;
      }, 0);
    }
  }, 0);
}

function sendMessageByButton(textbox) {
  const button = findSendButton(textbox);
  if (!button) {
    debugLog("send button not found", { mode: settings.mode });
    return;
  }
  debugLog("send button clicked", { mode: settings.mode });
  button.click();
}

function shouldSendByMode(mode, isShift, isCtrl, isAlt, isMeta) {
  if (mode === "shift") {
    return isShift && !isCtrl && !isAlt && !isMeta;
  }
  if (mode === "ctrl") {
    return isCtrl && !isShift && !isAlt && !isMeta;
  }
  if (mode === "both") {
    return (isShift !== isCtrl) && !isAlt && !isMeta;
  }
  return isShift && isCtrl && !isAlt && !isMeta;
}

function handleKey(event) {
  if (isDispatchingSyntheticEnter) return;
  if (!event.isTrusted) return;

  // IME composing/confirming should be untouched to avoid input corruption.
  if (event.isComposing || event.keyCode === 229) return;

  const isEnter = event.code === "Enter" || event.code === "NumpadEnter";
  if (!isEnter) return;

  const textbox = getTargetTextbox(event.target);
  if (!textbox) return;
  if (!settingsLoaded) return;
  if (!settings.enabled) return;

  const isShift = event.shiftKey;
  const isCtrl = event.ctrlKey;
  const isAlt = event.altKey;
  const isMeta = event.metaKey;
  const mode = sanitizeMode(settings.mode);
  // Exclusive modifier logic avoids accidental cross-mode sends.
  const isSend = shouldSendByMode(mode, isShift, isCtrl, isAlt, isMeta);
  const intent = isSend ? "send" : "newline";

  debugLog("keydown intent", {
    mode,
    intent,
    isSend,
    isComposing: event.isComposing,
    isShift,
    isCtrl,
    isAlt,
    isMeta
  });

  if (isSend) {
    event.preventDefault();
    event.stopImmediatePropagation();
    debugLog("route", { route: "send" });
    sendMessageByButton(textbox);
    return;
  }

  // Capture phase is used so Gemini default submit does not win the race.
  event.preventDefault();
  event.stopImmediatePropagation();
  // Convert plain Enter into synthetic Shift+Enter to use Gemini's native newline path.
  debugLog("route", { route: "newline" });
  dispatchSyntheticShiftEnter(textbox);
}

document.addEventListener("keydown", handleKey, true);
