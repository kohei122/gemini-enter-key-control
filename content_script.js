(() => {
const INIT_KEY = "__geminiEnterKeyControlInitialized";
const INIT_MARKER_ATTRIBUTE = "data-gemini-enter-key-control-initialized";
if (window[INIT_KEY] || document.documentElement?.hasAttribute(INIT_MARKER_ATTRIBUTE)) return;
window[INIT_KEY] = true;
document.documentElement?.setAttribute(INIT_MARKER_ATTRIBUTE, "true");

// Local verification only. Always keep this false before publishing.
const DEBUG_USE_EXEC_COMMAND_NEWLINE = false;
// Local verification only. Always keep this false before publishing.
const DEBUG_SKIP_GEMINI_SEND_CLICK = false;
// Local verification only. Always keep this false before publishing.
const DEBUG_RESTORE_FOCUS_AFTER_GEMINI_SEND = false;
// Local verification only. Always keep this false before publishing.
const DEBUG_LOG_GEMINI_SEND_BUTTON_CANDIDATES = false;

function sanitizeEnabled(enabled) {
  if (enabled === true || enabled === false) return enabled;
  if (enabled === "true") return true;
  if (enabled === "false") return false;
  return true;
}

function sanitizeMode(mode) {
  return mode === "ctrl" ||
    mode === "cmd" ||
    mode === "both" ||
    mode === "combo" ||
    mode === "shiftCmd"
    ? mode
    : "shift";
}

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "shift"
};
const DEV_FORCE_MAC_PLATFORM_KEY = "devForceMacPlatform";

const TEXTBOX_SELECTOR = 'div[contenteditable="true"][role="textbox"]';
const NOTEBOOKLM_CHAT_TEXTAREA_SELECTOR = "textarea.query-box-input";
const NOTEBOOKLM_EXCLUDED_TEXTAREA_SELECTOR =
  'textarea.query-box-textarea, textarea[formcontrolname="discoverSourcesQuery"]';
const NOTEBOOKLM_SEND_BUTTON_SELECTOR = 'button.submit-button[type="submit"]';
const SEND_BUTTON_SELECTORS = [
  'button[aria-label]',
  '[role="button"][aria-label]'
];
const GEMINI_SEND_ARIA_LABEL_PATTERNS = [
  "プロンプトを送信",
  "Send prompt",
  "Send message",
  "Send"
];
const GEMINI_EXCLUDED_BUTTON_ARIA_LABEL_PATTERNS = [
  "その他のオプション",
  "More options"
];
const GEMINI_EXCLUDED_BUTTON_CLASS_PATTERNS = [
  "gem-conversation-actions-menu-button",
  "mat-menu-trigger"
];

let settings = { ...DEFAULT_SETTINGS };
let settingsLoaded = false;
let isMacPlatform = false;
let isDispatchingSyntheticEnter = false;
let isComposingActive = false;
let lastCompositionEndAt = 0;
const COMPOSITION_END_GRACE_MS = 80;

function sanitizeModeForPlatform(mode, isMac) {
  const sanitized = sanitizeMode(mode);
  if (!isMac && (sanitized === "cmd" || sanitized === "shiftCmd")) {
    return "shift";
  }
  return sanitized;
}

function getIsMacPlatform() {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.getPlatformInfo) {
      resolve(false);
      return;
    }

    chrome.runtime.getPlatformInfo((info) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      resolve(info?.os === "mac");
    });
  });
}

function getDevForceMacPlatform() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [DEV_FORCE_MAC_PLATFORM_KEY]: false }, (stored) => {
      resolve(stored[DEV_FORCE_MAC_PLATFORM_KEY] === true);
    });
  });
}

async function resolveIsMacPlatform() {
  const devForceMacPlatform = await getDevForceMacPlatform();
  if (devForceMacPlatform) return true;
  return getIsMacPlatform();
}

async function loadSettings() {
  isMacPlatform = await resolveIsMacPlatform();

  chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
    const next = {
      enabled: sanitizeEnabled(stored.enabled),
      mode: sanitizeModeForPlatform(stored.mode, isMacPlatform)
    };
    settings = next;
    settingsLoaded = true;
    chrome.storage.local.set(next);
  });
}

loadSettings();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes.enabled) {
    settings.enabled = sanitizeEnabled(changes.enabled.newValue);
  }

  if (changes.mode) {
    settings.mode = sanitizeModeForPlatform(changes.mode.newValue, isMacPlatform);
  }

  if (changes[DEV_FORCE_MAC_PLATFORM_KEY]) {
    resolveIsMacPlatform().then((nextIsMacPlatform) => {
      isMacPlatform = nextIsMacPlatform;
      settings.mode = sanitizeModeForPlatform(settings.mode, isMacPlatform);
    });
  }
});

function getTargetTextbox(target) {
  if (!target) return null;

  const element = target instanceof Element ? target : target.parentElement;
  if (!element) return null;

  return element.closest(TEXTBOX_SELECTOR);
}

function getNotebookLmChatTextarea(target) {
  if (location.hostname !== "notebooklm.google.com") return null;
  if (!target) return null;

  const element = target instanceof Element ? target : target.parentElement;
  if (!element) return null;

  const textarea = element.matches("textarea") ? element : element.closest("textarea");
  if (!(textarea instanceof HTMLTextAreaElement)) return null;
  if (textarea.matches(NOTEBOOKLM_EXCLUDED_TEXTAREA_SELECTOR)) return null;
  if (!textarea.matches(NOTEBOOKLM_CHAT_TEXTAREA_SELECTOR)) return null;

  return textarea;
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
  const candidates = collectSendButtonCandidates(textbox);

  for (const candidate of candidates) {
    if (!isValidGeminiSendButton(candidate)) continue;
    return candidate;
  }

  return null;
}

function collectSendButtonCandidates(textbox) {
  const candidates = [];
  const seen = new Set();
  const form = textbox.closest("form");
  const inputContainer = textbox.closest("form, main, article, message-input, chat-window, bard-sidenav-content");

  if (form) {
    for (const selector of SEND_BUTTON_SELECTORS) {
      collectCandidates(form, selector, candidates, seen);
    }
  }

  if (inputContainer && inputContainer !== form) {
    for (const selector of SEND_BUTTON_SELECTORS) {
      collectCandidates(inputContainer, selector, candidates, seen);
    }
  }

  for (const selector of SEND_BUTTON_SELECTORS) {
    collectCandidates(document, selector, candidates, seen);
  }

  return candidates;
}

function includesAny(value, patterns) {
  return patterns.some((pattern) => value.includes(pattern));
}

function isExcludedGeminiButton(candidate) {
  const ariaLabel = candidate.getAttribute("aria-label") || "";
  const className = String(candidate.className || "");

  if (includesAny(ariaLabel, GEMINI_EXCLUDED_BUTTON_ARIA_LABEL_PATTERNS)) return true;
  if (includesAny(className, GEMINI_EXCLUDED_BUTTON_CLASS_PATTERNS)) return true;
  if (candidate.hasAttribute("mat-menu-trigger")) return true;
  if (candidate.getAttribute("aria-haspopup") === "menu") return true;

  return false;
}

function isValidGeminiSendButton(candidate) {
  if (!(candidate instanceof HTMLElement)) return false;
  if (!isElementVisible(candidate)) return false;
  if (isElementDisabled(candidate)) return false;
  if (isExcludedGeminiButton(candidate)) return false;

  const ariaLabel = candidate.getAttribute("aria-label") || "";
  return includesAny(ariaLabel, GEMINI_SEND_ARIA_LABEL_PATTERNS);
}

function describeElement(element) {
  if (!(element instanceof HTMLElement)) return null;

  return {
    tagName: element.tagName,
    ariaLabel: element.getAttribute("aria-label"),
    title: element.getAttribute("title"),
    type: element.getAttribute("type"),
    className: String(element.className || ""),
    disabled: isElementDisabled(element),
    innerText: (element.innerText || "").slice(0, 120),
    outerHTML: (element.outerHTML || "").slice(0, 300)
  };
}

function logSendButtonCandidates(textbox, candidates, selectedButton) {
  if (!DEBUG_LOG_GEMINI_SEND_BUTTON_CANDIDATES) return;
  if (location.hostname !== "gemini.google.com") return;

  console.group("[Gemini Enter Key Control] send button candidates");
  console.log("textbox", describeElement(textbox));
  console.log("activeElement", describeElement(document.activeElement));
  console.log("candidateCount", candidates.length);
  candidates.forEach((candidate, index) => {
    console.log(`candidate ${index}`, describeElement(candidate), {
      visible: isElementVisible(candidate),
      validGeminiSendButton: isValidGeminiSendButton(candidate)
    });
  });
  console.log("selectedButton", describeElement(selectedButton));
  console.groupEnd();
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
  const shouldLog = DEBUG_LOG_GEMINI_SEND_BUTTON_CANDIDATES &&
    location.hostname === "gemini.google.com";
  const candidates = shouldLog ? collectSendButtonCandidates(textbox) : null;
  const button = candidates
    ? candidates.find((candidate) => isValidGeminiSendButton(candidate)) ?? null
    : findSendButton(textbox);

  if (candidates) {
    logSendButtonCandidates(textbox, candidates, button);
  }

  if (!button) return;
  button.click();
}

function findNotebookLmSendButton(textarea) {
  const form = textarea.closest("form");
  if (!form) return null;

  const buttons = form.querySelectorAll(NOTEBOOKLM_SEND_BUTTON_SELECTOR);
  if (buttons.length !== 1) return null;

  const button = buttons[0];
  if (button.matches(".actions-enter-button")) return null;
  if (!isElementVisible(button)) return null;
  if (isElementDisabled(button)) return null;

  return button;
}

function sendNotebookLmMessage(textarea) {
  const button = findNotebookLmSendButton(textarea);
  if (!button) return;
  button.click();
}

function insertTextareaNewline(textarea) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;

  textarea.focus();
  textarea.setRangeText("\n", start, end, "end");

  const inputEvent =
    typeof InputEvent === "function"
      ? new InputEvent("input", {
          bubbles: true,
          inputType: "insertLineBreak",
          data: null
        })
      : new Event("input", { bubbles: true });

  textarea.dispatchEvent(inputEvent);
}

function stopHandledEnterEvent(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function insertNewlineByExecCommand(textbox) {
  textbox.focus();

  const insertedLineBreak = document.execCommand("insertLineBreak");
  if (DEBUG_USE_EXEC_COMMAND_NEWLINE) {
    console.log("[Gemini Enter Key Control] execCommand insertLineBreak", insertedLineBreak);
  }
  if (insertedLineBreak) return;

  const insertedText = document.execCommand("insertText", false, "\n");
  if (DEBUG_USE_EXEC_COMMAND_NEWLINE) {
    console.log("[Gemini Enter Key Control] execCommand insertText fallback", insertedText);
  }
}

function getControlledInput(target) {
  const notebookLmTextarea = getNotebookLmChatTextarea(target);
  if (notebookLmTextarea) {
    return { notebookLmTextarea, textbox: null };
  }

  const textbox = getTargetTextbox(target);
  if (textbox) {
    return { notebookLmTextarea: null, textbox };
  }

  return { notebookLmTextarea: null, textbox: null };
}

function getCurrentGeminiTextbox() {
  if (location.hostname !== "gemini.google.com") return null;

  const activeTextbox = getTargetTextbox(document.activeElement);
  if (activeTextbox) return activeTextbox;

  const textboxes = document.querySelectorAll(TEXTBOX_SELECTOR);
  for (let index = textboxes.length - 1; index >= 0; index -= 1) {
    const textbox = textboxes[index];
    if (!(textbox instanceof HTMLElement)) continue;
    if (!isElementVisible(textbox)) continue;
    if (isElementDisabled(textbox)) continue;
    return textbox;
  }

  return null;
}

function restoreGeminiTextboxFocusAfterSend() {
  if (!DEBUG_RESTORE_FOCUS_AFTER_GEMINI_SEND) return;

  for (const delay of [0, 50, 150, 300]) {
    setTimeout(() => {
      const textbox = getCurrentGeminiTextbox();
      if (!textbox) return;
      textbox.focus();
    }, delay);
  }
}

function shouldSendByMode(mode, isShift, isCtrl, isAlt, isMeta) {
  if (mode === "shift") {
    return isShift && !isCtrl && !isAlt && !isMeta;
  }
  if (mode === "ctrl") {
    return isCtrl && !isShift && !isAlt && !isMeta;
  }
  if (mode === "cmd") {
    return isMeta && !isShift && !isCtrl && !isAlt;
  }
  if (mode === "both") {
    return [isShift, isCtrl, isMeta].filter(Boolean).length === 1 && !isAlt;
  }
  if (mode === "shiftCmd") {
    return isShift && isMeta && !isCtrl && !isAlt;
  }
  return isShift && isCtrl && !isAlt && !isMeta;
}

function handleKey(event) {
  if (isDispatchingSyntheticEnter) return;
  if (!event.isTrusted) return;

  // IME composing/confirming should be untouched to avoid input corruption.
  const inCompositionGraceWindow =
    lastCompositionEndAt > 0 &&
    performance.now() - lastCompositionEndAt < COMPOSITION_END_GRACE_MS;
  if (isComposingActive || event.isComposing || event.keyCode === 229 || inCompositionGraceWindow) return;

  const isEnter = event.code === "Enter" || event.code === "NumpadEnter";
  if (!isEnter) return;

  const { notebookLmTextarea, textbox } = getControlledInput(event.target);
  if (!notebookLmTextarea && !textbox) return;
  if (!settingsLoaded) return;
  if (!settings.enabled) return;

  const isShift = event.shiftKey;
  const isCtrl = event.ctrlKey;
  const isAlt = event.altKey;
  const isMeta = event.metaKey;
  const mode = sanitizeModeForPlatform(settings.mode, isMacPlatform);
  // Exclusive modifier logic avoids accidental cross-mode sends.
  const isSend = shouldSendByMode(mode, isShift, isCtrl, isAlt, isMeta);

  if (notebookLmTextarea) {
    if (isSend) {
      stopHandledEnterEvent(event);
      sendNotebookLmMessage(notebookLmTextarea);
      return;
    }

    stopHandledEnterEvent(event);
    insertTextareaNewline(notebookLmTextarea);
    return;
  }

  if (isSend) {
    stopHandledEnterEvent(event);
    if (DEBUG_SKIP_GEMINI_SEND_CLICK) {
      console.log("[Gemini Enter Key Control] skipped Gemini send button click");
      return;
    }
    sendMessageByButton(textbox);
    restoreGeminiTextboxFocusAfterSend();
    return;
  }

  stopHandledEnterEvent(event);
  if (DEBUG_USE_EXEC_COMMAND_NEWLINE) {
    insertNewlineByExecCommand(textbox);
    return;
  }

  // Convert plain Enter into synthetic Shift+Enter to use Gemini's native newline path.
  dispatchSyntheticShiftEnter(textbox);
}

document.addEventListener("keydown", handleKey, true);

document.addEventListener("compositionstart", (event) => {
  const { notebookLmTextarea, textbox } = getControlledInput(event.target);
  if (!notebookLmTextarea && !textbox) return;
  isComposingActive = true;
}, true);

document.addEventListener("compositionend", (event) => {
  const { notebookLmTextarea, textbox } = getControlledInput(event.target);
  if (!notebookLmTextarea && !textbox) return;
  isComposingActive = false;
  lastCompositionEndAt = performance.now();
}, true);
})();
