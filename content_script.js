(() => {
// Temporary real-browser diagnostics. Set this back to false before publishing.
const DEBUG_LOG_FLOW_ACTIONS = false;
const INIT_KEY = "__geminiEnterKeyControlInitialized";
const INIT_VERSION_KEY = "__geminiEnterKeyControlInitVersion";
const INIT_VERSION = "1.5.0-flow-trusted-native-react-1";
const INIT_MARKER_ATTRIBUTE = "data-gemini-enter-key-control-initialized";
if (window[INIT_KEY] || document.documentElement?.hasAttribute(INIT_MARKER_ATTRIBUTE)) {
  if (DEBUG_LOG_FLOW_ACTIONS &&
      location.hostname === "labs.google" &&
      location.pathname.includes("/tools/flow/")) {
    console.debug("[Gemini Enter Key Control] Flow initialization skipped", {
      windowMarker: window[INIT_KEY] === true,
      documentMarker: document.documentElement?.getAttribute(INIT_MARKER_ATTRIBUTE),
      existingVersion: window[INIT_VERSION_KEY] || null,
      attemptedVersion: INIT_VERSION
    });
  }
  return;
}
window[INIT_KEY] = true;
window[INIT_VERSION_KEY] = INIT_VERSION;
document.documentElement?.setAttribute(INIT_MARKER_ATTRIBUTE, INIT_VERSION);

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

function isKnownSendMode(mode) {
  return mode === "shift" ||
    mode === "ctrl" ||
    mode === "cmd" ||
    mode === "both" ||
    mode === "combo" ||
    mode === "shiftCmd";
}

function sanitizeMode(mode) {
  return isKnownSendMode(mode) ? mode : "shift";
}

const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "shift"
};
const DEV_FORCE_MAC_PLATFORM_KEY = "devForceMacPlatform";

const TEXTBOX_SELECTOR = 'div[contenteditable="true"][role="textbox"]';
const FLOW_TEXTBOX_SELECTOR =
  '[data-slate-editor="true"][role="textbox"][contenteditable="true"]';
const NOTEBOOKLM_CHAT_TEXTAREA_SELECTOR = "textarea.query-box-input";
const NOTEBOOKLM_EXCLUDED_TEXTAREA_SELECTOR =
  'textarea.query-box-textarea, textarea[formcontrolname="discoverSourcesQuery"]';
const NOTEBOOKLM_SEND_BUTTON_SELECTOR = 'button.submit-button[type="submit"]';
const SEND_BUTTON_SELECTORS = [
  "button"
];
const GEMINI_COMPOSER_ROOT_MAX_ANCESTOR_DEPTH = 10;
const GEMINI_COMPOSER_ROOT_MAX_BUTTONS = 24;
const GEMINI_SEND_BUTTON_AMBIGUOUS_SCORE_GAP = 15;
const GEMINI_SEND_BUTTON_MIN_SCORE = 70;
const GEMINI_SEND_ARIA_LABEL_PATTERNS = [
  "プロンプトを送信",
  "メッセージを送信",
  "送信",
  "Send prompt",
  "Send message",
  "Send",
  "Envoyer un message",
  "Envoyer",
  "Enviar mensaje",
  "Enviar mensagem",
  "Enviar",
  "Senden",
  "Nachricht senden",
  "Invia",
  "Invia messaggio",
  "Invia un messaggio",
  "Verzenden",
  "Bericht verzenden",
  "Bericht sturen",
  "Sturen",
  "Wyślij",
  "Wyślij wiadomość",
  "Gönder",
  "Mesaj gönder",
  "Kirim",
  "Kirim pesan",
  "Gửi",
  "Gửi tin nhắn",
  "ส่ง",
  "ส่งข้อความ",
  "भेजें",
  "संदेश भेजें",
  "सबमिट करें",
  "सबमिट",
  "إرسال",
  "إرسال رسالة",
  "שלח",
  "שליחת הודעה",
  "Отправить",
  "Отправить сообщение",
  "Надіслати",
  "Надіслати повідомлення",
  "메시지 보내기",
  "보내기",
  "전송",
  "发送消息",
  "发送",
  "傳送訊息",
  "傳送",
  "送出"
];
const GEMINI_SEND_ARIA_LABEL_LOWERCASE_PATTERNS = [
  "send",
  "envoyer",
  "enviar",
  "senden",
  "invia",
  "verzenden",
  "sturen",
  "wyślij",
  "gönder",
  "kirim",
  "gửi",
  "सबमिट",
  "отправить",
  "надіслати"
];
const GEMINI_EXCLUDED_BUTTON_ARIA_LABEL_PATTERNS = [
  "その他のオプション",
  "More options",
  "mic",
  "microphone",
  "microfoon",
  "voice",
  "audio",
  "attach",
  "attachment",
  "upload",
  "uploaden",
  "file",
  "image",
  "tools",
  "settings",
  "sidebar",
  "history",
  "recent",
  "menu",
  "options",
  "more",
  "open",
  "close",
  "expand",
  "collapse",
  "model",
  "moduskiezer",
  "feedback",
  "comment",
  "report",
  "commentaire",
  "commentaires",
  "retour",
  "comentario",
  "comentarios",
  "informar",
  "comentário",
  "comentários",
  "kommentar",
  "melden",
  "commento",
  "commenti",
  "segnala",
  "opmerking",
  "opinia",
  "komentarz",
  "zgłoś",
  "geri bildirim",
  "yorum",
  "bildir",
  "masukan",
  "komentar",
  "laporkan",
  "phản hồi",
  "bình luận",
  "báo cáo",
  "ความคิดเห็น",
  "รายงาน",
  "प्रतिक्रिया",
  "टिप्पणी",
  "रिपोर्ट",
  "फ़ाइल",
  "अपलोड",
  "टूल",
  "मोड",
  "पिकर",
  "माइक्रोफ़ोन",
  "माइक्रोफोन",
  "تعليقات",
  "ملاحظات",
  "إبلاغ",
  "משוב",
  "תגובה",
  "דווח",
  "отзыв",
  "комментарий",
  "пожаловаться",
  "відгук",
  "коментар",
  "поскаржитися",
  "コメント",
  "フィードバック",
  "報告",
  "의견",
  "피드백",
  "댓글",
  "신고",
  "反馈",
  "评论",
  "举报",
  "意見回饋",
  "回饋",
  "評論",
  "檢舉",
  "意見",
  "マイク",
  "添付",
  "設定",
  "サイドバー",
  "履歴",
  "音声",
  "画像",
  "ファイル",
  "開く",
  "閉じる"
];
const GEMINI_EXCLUDED_BUTTON_CLASS_PATTERNS = [
  "gem-conversation-actions-menu-button",
  "mat-menu-trigger"
];
const GEMINI_EXCLUDED_BUTTON_METADATA_PATTERN =
  /\b(?:feedback|comment|report|mic|microphone|voice|audio|attach|attachment|upload|file|image|menu|more|option|settings|sidebar|history|recent|model|selector|open|close|expand|collapse)\b/i;
const GEMINI_SEND_BUTTON_METADATA_PATTERN = /\b(?:send|submit)\b/i;
const GEMINI_SEND_BUTTON_JSLOG_PREFIX = "173899";
const GEMINI_EXCLUDED_BUTTON_JSLOG_PREFIXES = [
  "300142",
  "175863",
  "206752"
];
const GEMINI_MODE_PICKER_DATA_TEST_ID = "bard-mode-menu-button";
const FLOW_COMPOSER_ROOT_MAX_ANCESTOR_DEPTH = 10;
const FLOW_COMPOSER_ROOT_MAX_BUTTONS = 24;
const FLOW_GENERATE_BUTTON_AMBIGUOUS_SCORE_GAP = 15;
const FLOW_GENERATE_BUTTON_AMBIGUOUS_DISTANCE_GAP = 8;
const FLOW_GENERATE_BUTTON_MIN_SCORE = 70;
const FLOW_GENERATE_CLICK_DELAY_MS = 30;
const FLOW_SEND_LOCK_MS = 500;
const FLOW_FOCUS_RESTORE_DELAYS_MS = [100, 200, 350];
const FLOW_SEND_STRATEGY = "trusted-native-react-handler";
const FLOW_REACT_HANDLER_PHASE = "trusted-native-key-event";
const FLOW_REACT_BRIDGE_DISCOVER_EVENT = "__gecFlowReactBridgeDiscover";
const FLOW_REACT_BRIDGE_READY_EVENT = "__gecFlowReactBridgeReady";
const FLOW_REACT_BRIDGE_REQUEST_EVENT = "__gecFlowReactBridgeRequest";
const FLOW_REACT_BRIDGE_RESPONSE_EVENT = "__gecFlowReactBridgeResponse";
const FLOW_REACT_TARGET_ATTRIBUTE = "data-gec-flow-react-target";
const FLOW_REACT_TEXTBOX_ATTRIBUTE = "data-gec-flow-react-textbox";
const FLOW_SEND_STRATEGIES = [
  "request-submit",
  "native-click",
  "synthetic-enter",
  "trusted-key-handoff",
  "trusted-native-react-handler"
];
const FLOW_GENERATE_ICON_SIGNAL = "arrow_forward";
const FLOW_EXCLUDED_BUTTON_TEXT_PATTERNS = [
  "stop",
  "add_2",
  "article_spark",
  "tune",
  "close"
];

let settings = { ...DEFAULT_SETTINGS };
let rawStoredSettings = null;
let settingsLoaded = false;
let isMacPlatform = false;
let isDispatchingSyntheticEnter = false;
let isDispatchingSyntheticFlowEnter = false;
let isFlowSendLocked = false;
let flowReactBridgeToken = null;
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

  chrome.storage.local.get(null, (stored) => {
    rawStoredSettings = {
      enabled: stored.enabled,
      mode: stored.mode
    };
    const next = {
      enabled: sanitizeEnabled(stored.enabled),
      mode: sanitizeModeForPlatform(stored.mode, isMacPlatform)
    };
    settings = next;
    settingsLoaded = true;
    logFlowAction("settings loaded", {
      rawSettings: { ...rawStoredSettings },
      normalizedSettings: { ...settings },
      isMacPlatform
    });
  });
}

loadSettings();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  rawStoredSettings ??= {};

  if (changes.enabled) {
    rawStoredSettings.enabled = changes.enabled.newValue;
    settings.enabled = sanitizeEnabled(changes.enabled.newValue);
  }

  if (changes.mode) {
    rawStoredSettings.mode = changes.mode.newValue;
    settings.mode = sanitizeModeForPlatform(changes.mode.newValue, isMacPlatform);
  }

  if (changes.enabled || changes.mode) {
    logFlowAction("storage settings changed", {
      changes,
      rawSettings: { ...rawStoredSettings },
      normalizedSettings: { ...settings },
      isMacPlatform
    });
  }

  if (changes[DEV_FORCE_MAC_PLATFORM_KEY]) {
    resolveIsMacPlatform().then((nextIsMacPlatform) => {
      isMacPlatform = nextIsMacPlatform;
      settings.mode = sanitizeModeForPlatform(settings.mode, isMacPlatform);
    });
  }
});

function getTargetTextbox(target) {
  if (location.hostname !== "gemini.google.com") return null;
  if (!target) return null;

  const element = target instanceof Element ? target : target.parentElement;
  if (!element) return null;

  return element.closest(TEXTBOX_SELECTOR);
}

function isGoogleFlowPage() {
  return location.hostname === "labs.google" && location.pathname.includes("/tools/flow/");
}

function getFlowTextbox(target) {
  if (!isGoogleFlowPage()) return null;
  if (!target) return null;

  const element = target instanceof Element ? target : target.parentElement;
  if (!element) return null;

  const textbox = element.closest(FLOW_TEXTBOX_SELECTOR);
  if (!(textbox instanceof HTMLElement)) return null;
  if (!isElementVisible(textbox)) return null;
  if (isElementDisabled(textbox)) return null;

  return textbox;
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
  const candidates = collectGeminiSendButtonCandidates(textbox);
  const rankedCandidates = candidates
    .map((candidate) => ({
      button: candidate,
      score: scoreGeminiSendButton(candidate, textbox, candidate.geminiComposerRoot),
      hasStrongSendSignal: hasStrongGeminiSendSignal(candidate)
    }))
    .filter((candidate) => candidate.score >= GEMINI_SEND_BUTTON_MIN_SCORE && candidate.hasStrongSendSignal)
    .sort((a, b) => b.score - a.score);

  if (rankedCandidates.length === 0) {
    return findSendButtonBySingleRemainingCandidate(candidates);
  }
  if (
    rankedCandidates.length > 1 &&
    rankedCandidates[0].score - rankedCandidates[1].score < GEMINI_SEND_BUTTON_AMBIGUOUS_SCORE_GAP
  ) {
    return null;
  }

  return rankedCandidates[0].button;
}

function findSendButtonBySingleRemainingCandidate(candidates) {
  const remainingCandidates = candidates.filter((candidate) => isSelectableGeminiButton(candidate));
  return remainingCandidates.length === 1 ? remainingCandidates[0] : null;
}

function collectSendButtonCandidates(textbox) {
  return collectGeminiSendButtonCandidates(textbox);
}

function collectGeminiSendButtonCandidates(textbox) {
  const candidates = [];
  const seen = new Set();
  const root = findGeminiComposerRoot(textbox);

  if (!root) return candidates;

  for (const selector of SEND_BUTTON_SELECTORS) {
    collectCandidates(root, selector, candidates, seen);
  }

  for (const candidate of candidates) {
    candidate.geminiComposerRoot = root;
  }

  return candidates;
}

function findGeminiComposerRoot(textbox) {
  if (!(textbox instanceof HTMLElement)) return null;

  const form = textbox.closest("form");
  if (isUsableGeminiComposerRoot(form, textbox)) return form;

  let ancestor = textbox.parentElement;
  for (let depth = 0; ancestor && depth < GEMINI_COMPOSER_ROOT_MAX_ANCESTOR_DEPTH; depth += 1) {
    if (ancestor === form) {
      ancestor = ancestor.parentElement;
      continue;
    }
    if (isBroadGeminiComposerRoot(ancestor)) break;
    if (isUsableGeminiComposerRoot(ancestor, textbox)) return ancestor;
    ancestor = ancestor.parentElement;
  }

  return null;
}

function isBroadGeminiComposerRoot(root) {
  if (!(root instanceof HTMLElement)) return true;
  if (root === document.body || root === document.documentElement) return true;

  const tagName = root.tagName.toLowerCase();
  return tagName === "body" || tagName === "html" || tagName === "main";
}

function isUsableGeminiComposerRoot(root, textbox) {
  if (!(root instanceof HTMLElement)) return false;
  if (isBroadGeminiComposerRoot(root)) return false;
  if (!root.contains(textbox)) return false;

  const buttons = root.querySelectorAll("button");
  if (buttons.length === 0 || buttons.length > GEMINI_COMPOSER_ROOT_MAX_BUTTONS) return false;

  for (const button of buttons) {
    if (scoreGeminiSendButton(button, textbox, root) >= GEMINI_SEND_BUTTON_MIN_SCORE) return true;
  }

  return false;
}

function includesAny(value, patterns) {
  return patterns.some((pattern) => value.includes(pattern));
}

function getGeminiButtonMetadata(candidate) {
  if (!(candidate instanceof HTMLElement)) return "";

  const values = [
    candidate.getAttribute("aria-label"),
    candidate.getAttribute("title"),
    candidate.getAttribute("type"),
    candidate.getAttribute("name"),
    candidate.getAttribute("value"),
    candidate.getAttribute("jslog"),
    candidate.id,
    String(candidate.className || "")
  ];

  for (const attribute of candidate.attributes) {
    if (attribute.name.startsWith("data-")) values.push(attribute.value);
  }

  return values.filter(Boolean).join(" ");
}

function getGeminiButtonJslog(candidate) {
  if (!(candidate instanceof HTMLElement)) return "";
  return candidate.getAttribute("jslog") || "";
}

function hasGeminiSendJslog(candidate) {
  return getGeminiButtonJslog(candidate).startsWith(GEMINI_SEND_BUTTON_JSLOG_PREFIX);
}

function hasExcludedGeminiJslog(candidate) {
  const jslog = getGeminiButtonJslog(candidate);
  return GEMINI_EXCLUDED_BUTTON_JSLOG_PREFIXES.some((prefix) => jslog.startsWith(prefix));
}

function isGeminiModePickerButton(candidate) {
  return candidate.getAttribute("data-test-id") === GEMINI_MODE_PICKER_DATA_TEST_ID;
}

function isExcludedGeminiButton(candidate) {
  const ariaLabel = candidate.getAttribute("aria-label") || "";
  const normalizedAriaLabel = ariaLabel.toLowerCase();
  const className = String(candidate.className || "");
  const metadata = getGeminiButtonMetadata(candidate);

  if (hasGeminiSendJslog(candidate)) return false;
  if (hasExcludedGeminiJslog(candidate)) return true;
  if (isGeminiModePickerButton(candidate)) return true;
  if (includesAny(ariaLabel, GEMINI_EXCLUDED_BUTTON_ARIA_LABEL_PATTERNS)) return true;
  if (includesAny(normalizedAriaLabel, GEMINI_EXCLUDED_BUTTON_ARIA_LABEL_PATTERNS)) return true;
  if (includesAny(className, GEMINI_EXCLUDED_BUTTON_CLASS_PATTERNS)) return true;
  if (GEMINI_EXCLUDED_BUTTON_METADATA_PATTERN.test(metadata)) return true;
  if (candidate.hasAttribute("mat-menu-trigger")) return true;
  if (candidate.getAttribute("aria-haspopup") === "menu") return true;

  return false;
}

function isSelectableGeminiButton(candidate) {
  if (!(candidate instanceof HTMLButtonElement)) return false;
  if (!isElementVisible(candidate)) return false;
  if (isElementDisabled(candidate)) return false;
  if (isExcludedGeminiButton(candidate)) return false;
  return true;
}

function hasGeminiSendAriaLabel(candidate) {
  const ariaLabel = candidate.getAttribute("aria-label") || "";
  const normalizedAriaLabel = ariaLabel.toLowerCase();
  return includesAny(ariaLabel, GEMINI_SEND_ARIA_LABEL_PATTERNS) ||
    includesAny(normalizedAriaLabel, GEMINI_SEND_ARIA_LABEL_LOWERCASE_PATTERNS);
}

function hasStrongGeminiSendSignal(candidate) {
  if (!(candidate instanceof HTMLButtonElement)) return false;
  if (hasGeminiSendJslog(candidate)) return true;
  if (hasGeminiSendAriaLabel(candidate)) return true;
  if (candidate.getAttribute("type") === "submit") return true;
  return GEMINI_SEND_BUTTON_METADATA_PATTERN.test(getGeminiButtonMetadata(candidate));
}

function isValidGeminiSendButton(candidate) {
  if (!isSelectableGeminiButton(candidate)) return false;

  return hasGeminiSendJslog(candidate) || hasGeminiSendAriaLabel(candidate);
}

function getElementRect(element) {
  if (!(element instanceof HTMLElement)) return null;

  const rect = element.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0 && rect.left === 0 && rect.top === 0)) return null;
  return rect;
}

function scoreGeminiSendButton(candidate, textbox, root) {
  if (!isSelectableGeminiButton(candidate)) return 0;

  let score = 0;
  const metadata = getGeminiButtonMetadata(candidate);

  if (root instanceof HTMLElement && root.contains(candidate)) score += 50;
  if (textbox.closest("form") && textbox.closest("form") === candidate.closest("form")) score += 35;
  if (hasGeminiSendJslog(candidate)) score += 90;
  if (GEMINI_SEND_BUTTON_METADATA_PATTERN.test(metadata)) score += 30;
  if (candidate.getAttribute("type") === "submit") score += 25;
  if (hasGeminiSendAriaLabel(candidate)) score += 45;
  score += 20;

  if (candidate.querySelector("svg")) score += 8;

  const textboxRect = getElementRect(textbox);
  const buttonRect = getElementRect(candidate);
  const rootRect = getElementRect(root);

  if (textboxRect && buttonRect) {
    const textboxCenterX = textboxRect.left + textboxRect.width / 2;
    const textboxCenterY = textboxRect.top + textboxRect.height / 2;
    const buttonCenterX = buttonRect.left + buttonRect.width / 2;
    const buttonCenterY = buttonRect.top + buttonRect.height / 2;
    const distance = Math.hypot(buttonCenterX - textboxCenterX, buttonCenterY - textboxCenterY);

    score += Math.max(0, 12 - Math.min(distance / 40, 12));
    if (buttonCenterY >= textboxCenterY || buttonCenterX >= textboxCenterX) score += 5;
  }

  if (rootRect && buttonRect) {
    const buttonCenterX = buttonRect.left + buttonRect.width / 2;
    const buttonCenterY = buttonRect.top + buttonRect.height / 2;
    const rootRightBias = (buttonCenterX - rootRect.left) / Math.max(rootRect.width, 1);
    const rootBottomBias = (buttonCenterY - rootRect.top) / Math.max(rootRect.height, 1);

    if (rootRightBias > 0.6) score += 4;
    if (rootBottomBias > 0.55) score += 4;
  }

  return score;
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
      validGeminiSendButton: isValidGeminiSendButton(candidate),
      score: scoreGeminiSendButton(candidate, textbox, candidate.geminiComposerRoot),
      strongSendSignal: hasStrongGeminiSendSignal(candidate)
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
  const button = findSendButton(textbox);

  if (candidates) {
    logSendButtonCandidates(textbox, candidates, button);
  }

  if (!button) return;
  button.click();
}

function findFlowGenerateButton(textbox) {
  if ((textbox?.textContent || "").trim().length === 0) return null;
  const candidates = collectFlowGenerateButtonCandidates(textbox);
  const rankedCandidates = candidates
    .map((candidate) => ({
      button: candidate,
      score: scoreFlowGenerateButton(candidate, textbox, candidate.flowComposerRoot),
      distance: getFlowElementDistance(textbox, candidate),
      hasStrongGenerateSignal: hasStrongFlowGenerateSignal(candidate)
    }))
    .filter((candidate) => candidate.score >= FLOW_GENERATE_BUTTON_MIN_SCORE && candidate.hasStrongGenerateSignal)
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      return b.score - a.score;
    });

  if (rankedCandidates.length === 0) {
    return findFlowGenerateButtonBySingleRemainingCandidate(candidates);
  }
  if (
    rankedCandidates.length > 1 &&
    Math.abs(rankedCandidates[0].distance - rankedCandidates[1].distance) <
      FLOW_GENERATE_BUTTON_AMBIGUOUS_DISTANCE_GAP &&
    rankedCandidates[0].score - rankedCandidates[1].score < FLOW_GENERATE_BUTTON_AMBIGUOUS_SCORE_GAP
  ) {
    return null;
  }

  return rankedCandidates[0].button;
}

function findFlowGenerateButtonBySingleRemainingCandidate(candidates) {
  const remainingCandidates = candidates.filter((candidate) => {
    return isSelectableFlowButton(candidate) && hasStrongFlowGenerateSignal(candidate);
  });
  return remainingCandidates.length === 1 ? remainingCandidates[0] : null;
}

function collectFlowGenerateButtonCandidates(textbox) {
  const candidates = [];
  const seen = new Set();
  const root = findFlowComposerRoot(textbox);

  if (!root) return candidates;

  collectCandidates(root, "button", candidates, seen);

  for (const candidate of candidates) {
    candidate.flowComposerRoot = root;
  }

  return candidates;
}

function findFlowComposerRoot(textbox) {
  if (!(textbox instanceof HTMLElement)) return null;

  let ancestor = textbox.parentElement;
  for (let depth = 0; ancestor && depth < FLOW_COMPOSER_ROOT_MAX_ANCESTOR_DEPTH; depth += 1) {
    if (isBroadFlowComposerRoot(ancestor)) break;
    if (isUsableFlowComposerRoot(ancestor, textbox)) return ancestor;
    ancestor = ancestor.parentElement;
  }

  return null;
}

function isBroadFlowComposerRoot(root) {
  if (!(root instanceof HTMLElement)) return true;
  if (root === document.body || root === document.documentElement) return true;

  const tagName = root.tagName.toLowerCase();
  return tagName === "body" || tagName === "html" || tagName === "main";
}

function isUsableFlowComposerRoot(root, textbox) {
  if (!(root instanceof HTMLElement)) return false;
  if (isBroadFlowComposerRoot(root)) return false;
  if (!root.contains(textbox)) return false;

  const buttons = root.querySelectorAll("button");
  if (buttons.length === 0 || buttons.length > FLOW_COMPOSER_ROOT_MAX_BUTTONS) return false;

  for (const button of buttons) {
    if (scoreFlowGenerateButton(button, textbox, root) >= FLOW_GENERATE_BUTTON_MIN_SCORE) return true;
  }

  return false;
}

function getFlowButtonText(candidate) {
  if (!(candidate instanceof HTMLElement)) return "";
  return `${candidate.textContent || ""} ${candidate.getAttribute("aria-label") || ""}`.trim();
}

function getFlowButtonContentText(candidate) {
  if (!(candidate instanceof HTMLElement)) return "";
  return candidate.textContent || "";
}

function hasFlowMaterialSymbol(candidate, symbolName) {
  return getFlowButtonContentText(candidate).toLowerCase().includes(symbolName);
}

function hasFlowGenerateIconSignal(candidate) {
  return hasFlowMaterialSymbol(candidate, FLOW_GENERATE_ICON_SIGNAL);
}

function isExcludedFlowButton(candidate) {
  if (!(candidate instanceof HTMLElement)) return true;
  if (candidate.getAttribute("aria-haspopup") === "menu") return true;

  if (FLOW_EXCLUDED_BUTTON_TEXT_PATTERNS.some((pattern) => hasFlowMaterialSymbol(candidate, pattern))) {
    return true;
  }
  if (hasFlowGenerateIconSignal(candidate)) return false;

  return false;
}

function isSelectableFlowButton(candidate) {
  if (!(candidate instanceof HTMLButtonElement)) return false;
  if (!candidate.isConnected) return false;
  if (!isElementVisible(candidate)) return false;
  if (isElementDisabled(candidate)) return false;
  if (isExcludedFlowButton(candidate)) return false;
  if (typeof getComputedStyle === "function") {
    const style = getComputedStyle(candidate);
    if (style.display === "none") return false;
    if (style.visibility === "hidden" || style.visibility === "collapse") return false;
    if (style.pointerEvents === "none") return false;
    const opacity = Number.parseFloat(style.opacity);
    if (Number.isFinite(opacity) && opacity <= 0) return false;
  }
  return true;
}

function findFlowGenerationStopButton(textbox) {
  if (!(textbox instanceof HTMLElement)) return null;

  let ancestor = textbox.parentElement;
  for (let depth = 0; ancestor && depth < FLOW_COMPOSER_ROOT_MAX_ANCESTOR_DEPTH; depth += 1) {
    if (isBroadFlowComposerRoot(ancestor)) break;
    const buttons = ancestor.querySelectorAll("button");
    if (buttons.length > 0 && buttons.length <= FLOW_COMPOSER_ROOT_MAX_BUTTONS) {
      for (const button of buttons) {
        if (!(button instanceof HTMLButtonElement)) continue;
        if (!button.isConnected || !isElementVisible(button)) continue;
        if (hasFlowMaterialSymbol(button, "stop")) return button;
      }
    }
    ancestor = ancestor.parentElement;
  }

  return null;
}

function hasStrongFlowGenerateSignal(candidate) {
  if (!(candidate instanceof HTMLButtonElement)) return false;
  return hasFlowGenerateIconSignal(candidate);
}

function scoreFlowGenerateButton(candidate, textbox, root) {
  if (!isSelectableFlowButton(candidate)) return 0;

  let score = 0;

  if (root instanceof HTMLElement && root.contains(candidate)) score += 50;
  if (hasFlowGenerateIconSignal(candidate)) score += 100;
  score += 20;

  const textboxRect = getElementRect(textbox);
  const buttonRect = getElementRect(candidate);
  const rootRect = getElementRect(root);

  if (textboxRect && buttonRect) {
    const textboxCenterX = textboxRect.left + textboxRect.width / 2;
    const textboxCenterY = textboxRect.top + textboxRect.height / 2;
    const buttonCenterX = buttonRect.left + buttonRect.width / 2;
    const buttonCenterY = buttonRect.top + buttonRect.height / 2;
    const distance = Math.hypot(buttonCenterX - textboxCenterX, buttonCenterY - textboxCenterY);

    score += Math.max(0, 12 - Math.min(distance / 40, 12));
    if (buttonCenterY >= textboxCenterY || buttonCenterX >= textboxCenterX) score += 5;
  }

  if (rootRect && buttonRect) {
    const buttonCenterX = buttonRect.left + buttonRect.width / 2;
    const buttonCenterY = buttonRect.top + buttonRect.height / 2;
    const rootRightBias = (buttonCenterX - rootRect.left) / Math.max(rootRect.width, 1);
    const rootBottomBias = (buttonCenterY - rootRect.top) / Math.max(rootRect.height, 1);

    if (rootRightBias > 0.6) score += 4;
    if (rootBottomBias > 0.55) score += 4;
  }

  return score;
}

function getFlowElementDistance(first, second) {
  const firstRect = getElementRect(first);
  const secondRect = getElementRect(second);
  if (!firstRect || !secondRect) return Number.POSITIVE_INFINITY;

  const firstCenterX = firstRect.left + firstRect.width / 2;
  const firstCenterY = firstRect.top + firstRect.height / 2;
  const secondCenterX = secondRect.left + secondRect.width / 2;
  const secondCenterY = secondRect.top + secondRect.height / 2;
  return Math.hypot(secondCenterX - firstCenterX, secondCenterY - firstCenterY);
}

function getClosestSharedFlowAncestor(first, second) {
  if (!(first instanceof HTMLElement) || !(second instanceof HTMLElement)) return null;

  const firstAncestors = new Set();
  for (let ancestor = first; ancestor; ancestor = ancestor.parentElement) {
    firstAncestors.add(ancestor);
  }
  for (let ancestor = second; ancestor; ancestor = ancestor.parentElement) {
    if (firstAncestors.has(ancestor)) return ancestor;
  }
  return null;
}

function describeFlowElement(element) {
  if (!(element instanceof HTMLElement)) return null;
  const id = element.id ? `#${element.id}` : "";
  const className = String(element.className || "").trim();
  const classes = className ? `.${className.split(/\s+/).join(".")}` : "";
  return `${element.tagName.toLowerCase()}${id}${classes}`;
}

function getFlowButtonForm(button) {
  if (!(button instanceof HTMLButtonElement)) return null;
  if (button.form instanceof HTMLElement) return button.form;
  const closestForm = button.closest("form");
  return closestForm instanceof HTMLElement ? closestForm : null;
}

function getFlowSelectionSnapshot() {
  const selection = typeof window.getSelection === "function" ? window.getSelection() : null;
  if (!selection) return null;

  return {
    anchorNode: describeFlowElement(selection.anchorNode?.parentElement || selection.anchorNode),
    anchorOffset: selection.anchorOffset,
    focusNode: describeFlowElement(selection.focusNode?.parentElement || selection.focusNode),
    focusOffset: selection.focusOffset,
    isCollapsed: selection.isCollapsed
  };
}

function getFlowStateSnapshot(textbox, button) {
  const root = button?.flowComposerRoot || findFlowComposerRoot(textbox);
  const textboxTextLength = (textbox?.textContent || "").length;
  return {
    textboxTextLength,
    textboxIsEmpty: textboxTextLength === 0,
    selection: getFlowSelectionSnapshot(),
    activeElement: describeFlowElement(document.activeElement),
    composerRoot: describeFlowElement(root),
    button: describeFlowElement(button),
    buttonForm: describeFlowElement(getFlowButtonForm(button))
  };
}

function getFlowButtonDiagnostic(candidate, textbox, index) {
  const rect = candidate.getBoundingClientRect();
  const style = typeof getComputedStyle === "function" ? getComputedStyle(candidate) : null;
  const form = getFlowButtonForm(candidate);
  return {
    candidateIndex: index,
    tagName: candidate.tagName,
    textContent: candidate.textContent || "",
    ariaLabel: candidate.getAttribute("aria-label"),
    title: candidate.getAttribute("title"),
    disabled: isElementDisabled(candidate),
    ariaDisabled: candidate.getAttribute("aria-disabled"),
    isConnected: candidate.isConnected,
    rect: {
      x: rect.x ?? rect.left,
      y: rect.y ?? rect.top,
      width: rect.width,
      height: rect.height
    },
    computedStyle: style ? {
      display: style.display,
      visibility: style.visibility,
      pointerEvents: style.pointerEvents,
      opacity: style.opacity
    } : null,
    hasOffsetParent: candidate.offsetParent !== null,
    textboxDistance: getFlowElementDistance(textbox, candidate),
    closestSharedAncestor: describeFlowElement(getClosestSharedFlowAncestor(textbox, candidate)),
    hasButtonForm: Boolean(candidate.form),
    hasClosestForm: Boolean(candidate.closest("form")),
    form: describeFlowElement(form),
    score: scoreFlowGenerateButton(candidate, textbox, candidate.flowComposerRoot),
    strongSignal: hasStrongFlowGenerateSignal(candidate),
    selectable: isSelectableFlowButton(candidate)
  };
}

function logFlowGenerateButtonCandidates(textbox, selectedButton, phase) {
  if (!DEBUG_LOG_FLOW_ACTIONS) return;
  const candidates = collectFlowGenerateButtonCandidates(textbox);
  logFlowAction(`${phase} generate candidates`, {
    candidateCount: candidates.length,
    selectedCandidateIndex: candidates.indexOf(selectedButton),
    selectedButton: describeFlowElement(selectedButton),
    state: getFlowStateSnapshot(textbox, selectedButton)
  });
  candidates.forEach((candidate, index) => {
    logFlowAction(`${phase} generate candidate ${index}`, getFlowButtonDiagnostic(candidate, textbox, index));
  });
}

function logFlowAction(message, details = {}) {
  if (!DEBUG_LOG_FLOW_ACTIONS) return;
  if (!isGoogleFlowPage()) return;
  const summary = Object.entries(details)
    .map(([key, value]) => {
      if (value === null || typeof value !== "object") return `${key}=${String(value)}`;
      try {
        return `${key}=${JSON.stringify(value)}`;
      } catch {
        return `${key}=[unserializable]`;
      }
    })
    .join(" ");
  console.debug(`[Gemini Enter Key Control] Flow ${message}${summary ? ` | ${summary}` : ""}`);
  console.debug("[Gemini Enter Key Control] Flow", message, details);
}

function logFlowWarning(message, details = {}) {
  if (!isGoogleFlowPage()) return;
  console.warn(`[Gemini Enter Key Control] Flow ${message}`, details);
}

function initializeFlowReactBridge() {
  if (!isGoogleFlowPage()) return;

  document.addEventListener(FLOW_REACT_BRIDGE_READY_EVENT, (event) => {
    const token = event.detail?.token;
    if (typeof token !== "string" || !/^[a-f0-9]{32}$/.test(token)) return;
    if (flowReactBridgeToken && flowReactBridgeToken !== token) return;
    flowReactBridgeToken = token;
    logFlowAction("MAIN world bridge initialized", {
      version: event.detail?.version ?? null
    });
  });

  for (const delayMs of [0, 100, 500]) {
    setTimeout(() => {
      if (flowReactBridgeToken) return;
      document.dispatchEvent(new CustomEvent(FLOW_REACT_BRIDGE_DISCOVER_EVENT));
    }, delayMs);
  }
  setTimeout(() => {
    if (!flowReactBridgeToken) {
      logFlowWarning("MAIN world bridge unavailable");
    }
  }, 750);
}

function createFlowReactRequestId() {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  const values = new Uint32Array(4);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("-");
}

function getCurrentFlowTextbox(previousTextbox) {
  const activeTextbox = getFlowTextbox(document.activeElement);
  if (activeTextbox) return activeTextbox;

  if (previousTextbox?.isConnected) {
    return getFlowTextbox(previousTextbox);
  }

  return null;
}

function observeFlowSendEvents(textbox, button, form) {
  if (!DEBUG_LOG_FLOW_ACTIONS) return () => {};
  const cleanupCallbacks = [];
  const observe = (target, eventName, targetName) => {
    if (!target?.addEventListener) return;
    const listener = (event) => {
      logFlowAction(`${eventName} event observed`, {
        target: targetName,
        isTrusted: event.isTrusted,
        defaultPrevented: event.defaultPrevented
      });
    };
    target.addEventListener(eventName, listener, true);
    cleanupCallbacks.push(() => target.removeEventListener(eventName, listener, true));
  };

  observe(button, "pointerdown", "generate-button");
  observe(button, "mousedown", "generate-button");
  observe(button, "click", "generate-button");
  observe(form, "submit", "form");
  observe(textbox, "keydown", "textbox");
  observe(textbox, "keypress", "textbox");
  observe(textbox, "keyup", "textbox");

  const cleanup = () => cleanupCallbacks.forEach((callback) => callback());
  setTimeout(cleanup, 250);
  return cleanup;
}

function submitFlowGenerateForm(button) {
  const form = getFlowButtonForm(button);
  const requestSubmitAvailable = typeof form?.requestSubmit === "function";
  logFlowAction("request-submit strategy inspected form", {
    formFound: Boolean(form),
    form: describeFlowElement(form),
    requestSubmitAvailable
  });
  if (!form?.isConnected || !requestSubmitAvailable) {
    return { executed: false, reason: "connected form with requestSubmit was not available" };
  }

  try {
    form.requestSubmit(button);
    logFlowAction("form.requestSubmit called", { withButton: true });
    return { executed: true, method: "requestSubmit(button)" };
  } catch (error) {
    logFlowAction("form.requestSubmit(button) rejected", { error: String(error) });
    try {
      form.requestSubmit();
      logFlowAction("form.requestSubmit called", { withButton: false });
      return { executed: true, method: "requestSubmit()" };
    } catch (fallbackError) {
      return { executed: false, reason: String(fallbackError) };
    }
  }
}

function getFlowNativeClickSnapshot(textbox, button) {
  return {
    activeElement: describeFlowElement(document.activeElement),
    selection: getFlowSelectionSnapshot(),
    textboxTextLength: (textbox?.textContent || "").length,
    buttonIsConnected: button?.isConnected === true,
    buttonDisabled: button ? isElementDisabled(button) : null,
    buttonAriaDisabled: button?.getAttribute("aria-disabled") ?? null
  };
}

function clickFlowGenerateButton(textbox, button) {
  if (!button?.isConnected ||
      !isSelectableFlowButton(button) ||
      !hasStrongFlowGenerateSignal(button)) {
    return { executed: false, reason: "generate button was not selectable" };
  }

  const nativeClick = HTMLButtonElement.prototype.click;
  if (typeof nativeClick !== "function") {
    return { executed: false, reason: "HTMLButtonElement.prototype.click was not available" };
  }

  const beforeClick = getFlowNativeClickSnapshot(textbox, button);
  logFlowAction("prototype native click before", beforeClick);
  nativeClick.call(button);
  const afterClick = getFlowNativeClickSnapshot(textbox, button);
  logFlowAction("prototype native click called", {
    textContent: getFlowButtonText(button),
    focusCalled: false,
    beforeClick,
    afterClick
  });
  return {
    executed: true,
    method: "HTMLButtonElement.prototype.click.call(button)",
    focusCalled: false,
    beforeClick,
    afterClick
  };
}

function dispatchFlowSyntheticEnter(textbox) {
  if (!textbox?.isConnected || getFlowTextbox(textbox) !== textbox) {
    return { executed: false, reason: "Flow textbox was not connected" };
  }

  textbox.focus({ preventScroll: true });
  const synthetic = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    bubbles: true,
    cancelable: true,
    composed: true
  });

  isDispatchingSyntheticFlowEnter = true;
  try {
    const notCanceled = textbox.dispatchEvent(synthetic);
    logFlowAction("synthetic plain Enter dispatched", {
      eventType: "keydown",
      isTrusted: synthetic.isTrusted,
      notCanceled,
      focusCalled: true
    });
    return {
      executed: true,
      method: "synthetic-keydown-enter",
      notCanceled,
      isTrusted: synthetic.isTrusted
    };
  } finally {
    isDispatchingSyntheticFlowEnter = false;
  }
}

function executeFlowSendStrategy(textbox, button) {
  if (!FLOW_SEND_STRATEGIES.includes(FLOW_SEND_STRATEGY)) {
    return { executed: false, reason: "unknown Flow send strategy" };
  }

  logFlowAction("strategy execution started", {
    selectedStrategy: FLOW_SEND_STRATEGY,
    sendLockActive: isFlowSendLocked
  });
  if (FLOW_SEND_STRATEGY === "request-submit") return submitFlowGenerateForm(button);
  if (FLOW_SEND_STRATEGY === "native-click") return clickFlowGenerateButton(textbox, button);
  if (FLOW_SEND_STRATEGY === "trusted-key-handoff" ||
      FLOW_SEND_STRATEGY === "trusted-native-react-handler") {
    return { executed: false, reason: `${FLOW_SEND_STRATEGY} must run synchronously from keydown` };
  }
  return dispatchFlowSyntheticEnter(textbox);
}

function getFlowHandoffState(textbox, button) {
  const root = button?.flowComposerRoot || findFlowComposerRoot(textbox);
  return {
    textboxConnected: textbox?.isConnected === true,
    textboxTextLength: (textbox?.textContent || "").length,
    activeElement: describeFlowElement(document.activeElement),
    selection: getFlowSelectionSnapshot(),
    composerRoot: describeFlowElement(root),
    buttonConnected: button?.isConnected === true,
    buttonDisabled: button ? isElementDisabled(button) : null,
    buttonAriaDisabled: button?.getAttribute("aria-disabled") ?? null
  };
}

function findLatestFlowTextbox() {
  if (!isGoogleFlowPage()) return null;

  const activeTextbox = getFlowTextbox(document.activeElement);
  if (activeTextbox?.isConnected) return activeTextbox;

  const textboxes = document.querySelectorAll(FLOW_TEXTBOX_SELECTOR);
  for (let index = textboxes.length - 1; index >= 0; index -= 1) {
    const textbox = textboxes[index];
    if (!(textbox instanceof HTMLElement)) continue;
    if (!textbox.isConnected || !isElementVisible(textbox) || isElementDisabled(textbox)) continue;
    return textbox;
  }
  return null;
}

function restoreFlowCaret(textbox) {
  const selection = typeof window.getSelection === "function" ? window.getSelection() : null;
  if (!selection) return "selection-unavailable";

  const anchorInside = textbox.contains(selection.anchorNode) || selection.anchorNode === textbox;
  const focusInside = textbox.contains(selection.focusNode) || selection.focusNode === textbox;
  if (anchorInside && focusInside) return "existing-selection-preserved";
  if ((textbox.textContent || "").length > 0) return "non-empty-textbox-focus-only";
  if (typeof document.createRange !== "function") return "range-unavailable";

  const range = document.createRange();
  range.selectNodeContents(textbox);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
  return "collapsed-at-end";
}

function restoreFlowTextboxFocus(textbox, reason) {
  if (!(textbox instanceof HTMLElement) || !textbox.isConnected || !isElementVisible(textbox)) {
    return false;
  }

  logFlowAction("focus restore attempted", { reason });
  textbox.focus({ preventScroll: true });
  const caretRestoreResult = restoreFlowCaret(textbox);
  const activeElementInside = document.activeElement === textbox || textbox.contains(document.activeElement);
  logFlowAction("focus restoration result", {
    reason,
    activeElementAfterRestore: describeFlowElement(document.activeElement),
    activeElementInside,
    caretRestoreResult
  });
  return activeElementInside;
}

function inspectFlowTrustedKeyHandoffAfterDelay(
  textbox,
  initialButton,
  beforeState,
  outcomeSource = "trusted-key-handoff"
) {
  let settled = false;

  FLOW_FOCUS_RESTORE_DELAYS_MS.forEach((delayMs, index) => {
    setTimeout(() => {
      if (settled) return;

      const latestTextbox = findLatestFlowTextbox();
      const currentButton = latestTextbox ? findFlowGenerateButton(latestTextbox) : null;
      const stopButton = latestTextbox ? findFlowGenerationStopButton(latestTextbox) : null;
      const afterState = getFlowHandoffState(latestTextbox, currentButton || stopButton);
      const promptRemains = Boolean(latestTextbox) &&
        beforeState.textboxTextLength > 0 &&
        afterState.textboxTextLength === beforeState.textboxTextLength;
      const promptCleared = Boolean(latestTextbox) &&
        beforeState.textboxTextLength > 0 &&
        afterState.textboxTextLength === 0;
      const generationSuccessDetected = promptCleared ||
        Boolean(stopButton) ||
        !initialButton.isConnected;

      logFlowAction("textbox reacquire attempt", {
        attempt: index + 1,
        delayMs,
        latestTextboxFound: Boolean(latestTextbox),
        textboxTextLength: afterState.textboxTextLength,
        activeElement: afterState.activeElement,
        promptRemains,
        promptCleared,
        stopButtonFound: Boolean(stopButton),
        generationSuccessDetected
      });
      if (outcomeSource === "trusted-native-react-handler") {
        logFlowAction("generation state after invocation", {
          attempt: index + 1,
          delayMs,
          latestTextboxFound: Boolean(latestTextbox),
          textboxTextLength: afterState.textboxTextLength,
          promptRemains,
          promptCleared,
          stopButtonFound: Boolean(stopButton),
          initialButtonConnected: initialButton.isConnected,
          generationSuccessDetected
        });
      }

      if (generationSuccessDetected && latestTextbox) {
        logFlowAction("generation success detected", {
          attempt: index + 1,
          delayMs,
          promptCleared,
          stopButtonFound: Boolean(stopButton),
          initialButtonConnected: initialButton.isConnected
        });
        if (outcomeSource === "trusted-native-react-handler") {
          logFlowAction("Flow React handler send succeeded", {
            attempt: index + 1,
            delayMs
          });
        }
        settled = restoreFlowTextboxFocus(latestTextbox, "generation-success");
        if (settled) return;
      }

      const isFinalAttempt = index === FLOW_FOCUS_RESTORE_DELAYS_MS.length - 1;
      if (isFinalAttempt && latestTextbox && !generationSuccessDetected) {
        settled = restoreFlowTextboxFocus(latestTextbox, "generation-not-detected");
      }
      if (isFinalAttempt && !settled) {
        if (outcomeSource === "trusted-native-react-handler") {
          logFlowAction("Flow React handler send failed", {
            latestTextboxFound: Boolean(latestTextbox),
            promptRemains,
            generationSuccessDetected
          });
        }
        logFlowAction("focus restore exhausted", {
          attempts: FLOW_FOCUS_RESTORE_DELAYS_MS.length,
          latestTextboxFound: Boolean(latestTextbox),
          generationSuccessDetected
        });
      }
    }, delayMs);
  });
}

function requestFlowReactHandlerSend(event, textbox, button) {
  if (!flowReactBridgeToken) {
    logFlowWarning("React handler send unavailable", {
      reason: "MAIN world bridge unavailable"
    });
    logFlowAction("Flow React handler send failed", {
      error: "MAIN world bridge unavailable"
    });
    restoreFlowTextboxFocus(findLatestFlowTextbox() || textbox, "react-bridge-unavailable");
    return false;
  }
  if (isFlowSendLocked ||
      !button?.isConnected ||
      !isSelectableFlowButton(button) ||
      !hasStrongFlowGenerateSignal(button)) {
    logFlowAction("Flow React handler send failed", {
      error: "send lock active or generate button invalid",
      sendLockActive: isFlowSendLocked
    });
    return false;
  }

  isFlowSendLocked = true;
  const requestId = createFlowReactRequestId();
  const beforeState = getFlowHandoffState(textbox, button);
  let responded = false;

  const cleanup = () => {
    document.removeEventListener(FLOW_REACT_BRIDGE_RESPONSE_EVENT, handleResponse);
    if (button.getAttribute(FLOW_REACT_TARGET_ATTRIBUTE) === requestId) {
      button.removeAttribute(FLOW_REACT_TARGET_ATTRIBUTE);
    }
    if (textbox.getAttribute(FLOW_REACT_TEXTBOX_ATTRIBUTE) === requestId) {
      textbox.removeAttribute(FLOW_REACT_TEXTBOX_ATTRIBUTE);
    }
  };
  const handleResponse = (event) => {
    const detail = event.detail;
    if (!detail || detail.token !== flowReactBridgeToken || detail.requestId !== requestId) return;
    if (responded) return;
    responded = true;
    cleanup();
    logFlowAction("React handler invocation result", {
      invoked: detail.invoked === true,
      phase: detail.phase || FLOW_REACT_HANDLER_PHASE,
      resultType: detail.resultType || null,
      trustedKeydown: detail.trustedKeydown || null,
      diagnostics: detail.diagnostics || null,
      exceptionSummary: detail.error || null
    });

    if (detail.invoked === true) {
      inspectFlowTrustedKeyHandoffAfterDelay(
        textbox,
        button,
        beforeState,
        "trusted-native-react-handler"
      );
    } else {
      logFlowWarning("React handler send failed", {
        reason: detail.error || "handler was not invoked"
      });
      logFlowAction("Flow React handler send failed", {
        error: detail.error || "handler was not invoked"
      });
      restoreFlowTextboxFocus(findLatestFlowTextbox() || textbox, "react-handler-failed");
    }
    releaseFlowSendLockAfterDelay();
  };

  document.addEventListener(FLOW_REACT_BRIDGE_RESPONSE_EVENT, handleResponse);
  button.setAttribute(FLOW_REACT_TARGET_ATTRIBUTE, requestId);
  textbox.setAttribute(FLOW_REACT_TEXTBOX_ATTRIBUTE, requestId);
  const expectedModifiers = {
    shiftKey: event.shiftKey === true,
    ctrlKey: event.ctrlKey === true,
    metaKey: event.metaKey === true,
    altKey: event.altKey === true
  };
  logFlowAction("React handler invocation phase", {
    phase: FLOW_REACT_HANDLER_PHASE,
    requestId,
    expectedModifiers,
    sendLockActive: isFlowSendLocked
  });
  document.dispatchEvent(new CustomEvent(FLOW_REACT_BRIDGE_REQUEST_EVENT, {
    detail: {
      token: flowReactBridgeToken,
      requestId,
      phase: FLOW_REACT_HANDLER_PHASE,
      expectedModifiers
    }
  }));
  if (button.getAttribute(FLOW_REACT_TARGET_ATTRIBUTE) === requestId) {
    button.removeAttribute(FLOW_REACT_TARGET_ATTRIBUTE);
  }
  if (textbox.getAttribute(FLOW_REACT_TEXTBOX_ATTRIBUTE) === requestId) {
    textbox.removeAttribute(FLOW_REACT_TEXTBOX_ATTRIBUTE);
  }

  setTimeout(() => {
    if (responded) return;
    responded = true;
    cleanup();
    logFlowWarning("React handler send failed", {
      reason: "MAIN world bridge response timeout"
    });
    logFlowAction("Flow React handler send failed", {
      error: "MAIN world bridge response timeout"
    });
    restoreFlowTextboxFocus(findLatestFlowTextbox() || textbox, "react-handler-timeout");
    releaseFlowSendLockAfterDelay();
  }, 100);
  return true;
}

function executeFlowTrustedKeyHandoff(event, textbox, button) {
  if (isFlowSendLocked) {
    logFlowAction("trusted key handoff send lock active", {
      originalEventIsTrusted: event.isTrusted,
      repeat: event.repeat === true
    });
    stopHandledFlowEnterEvent(event);
    return false;
  }
  if (!button?.isConnected ||
      !isSelectableFlowButton(button) ||
      !hasStrongFlowGenerateSignal(button)) {
    logFlowAction("trusted key handoff target invalid", {
      buttonFound: Boolean(button),
      buttonConnected: button?.isConnected === true,
      buttonDisabled: button ? isElementDisabled(button) : null,
      buttonAriaDisabled: button?.getAttribute("aria-disabled") ?? null
    });
    stopHandledFlowEnterEvent(event);
    return false;
  }

  isFlowSendLocked = true;
  const beforeState = getFlowHandoffState(textbox, button);
  observeFlowSendEvents(textbox, button, getFlowButtonForm(button));
  button.focus({ preventScroll: true });
  const afterFocusState = getFlowHandoffState(textbox, button);

  event.stopPropagation();
  event.stopImmediatePropagation();
  logFlowAction("trusted key handoff default action pending", {
    selectedStrategy: FLOW_SEND_STRATEGY,
    originalEventIsTrusted: event.isTrusted,
    key: event.key,
    code: event.code,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    altKey: event.altKey,
    buttonFound: true,
    activeElementBeforeFocus: beforeState.activeElement,
    activeElementAfterFocus: afterFocusState.activeElement,
    preventDefaultCalled: event.defaultPrevented,
    stopPropagationCalled: true,
    stopImmediatePropagationCalled: true,
    trustedKeyDefaultActionPending: true,
    beforeState,
    afterFocusState
  });

  inspectFlowTrustedKeyHandoffAfterDelay(textbox, button, beforeState);
  releaseFlowSendLockAfterDelay();
  return true;
}

function releaseFlowSendLockAfterDelay() {
  setTimeout(() => {
    isFlowSendLocked = false;
    logFlowAction("send lock released");
  }, FLOW_SEND_LOCK_MS);
}

function scheduleFlowGenerate(textbox) {
  if (!(textbox instanceof HTMLElement)) return false;
  if (isFlowSendLocked) {
    logFlowAction("send lock active; duplicate send blocked");
    return false;
  }

  isFlowSendLocked = true;

  logFlowAction("Flow send scheduled", {
    delayMs: FLOW_GENERATE_CLICK_DELAY_MS,
    selectedStrategy: FLOW_SEND_STRATEGY,
    sendLockActive: isFlowSendLocked
  });

  setTimeout(() => {
    const currentTextbox = getCurrentFlowTextbox(textbox);
    const button = currentTextbox ? findFlowGenerateButton(currentTextbox) : null;
    const form = getFlowButtonForm(button);
    logFlowAction("generate button reacquired", {
      selectedStrategy: FLOW_SEND_STRATEGY,
      textboxReacquired: Boolean(currentTextbox),
      generateButtonReacquired: Boolean(button),
      textContent: button ? getFlowButtonText(button) : null,
      isConnected: button?.isConnected === true,
      disabled: button ? isElementDisabled(button) : null,
      ariaDisabled: button?.getAttribute("aria-disabled") ?? null,
      formFound: Boolean(form),
      state: currentTextbox ? getFlowStateSnapshot(currentTextbox, button) : null
    });
    if (currentTextbox) logFlowGenerateButtonCandidates(currentTextbox, button, "reacquired");

    const cleanupObservers = observeFlowSendEvents(currentTextbox, button, form);
    const result = currentTextbox && button
      ? executeFlowSendStrategy(currentTextbox, button)
      : { executed: false, reason: "target could not be reacquired" };
    logFlowAction("strategy execution result", {
      selectedStrategy: FLOW_SEND_STRATEGY,
      ...result,
      sendLockActive: isFlowSendLocked
    });
    setTimeout(cleanupObservers, 50);
    releaseFlowSendLockAfterDelay();
  }, FLOW_GENERATE_CLICK_DELAY_MS);

  return true;
}

function canTryFlowLineBreak(textbox) {
  if (!(textbox instanceof HTMLElement)) return false;
  if (typeof document.execCommand !== "function") return false;
  if (typeof document.queryCommandSupported !== "function") return true;
  return document.queryCommandSupported("insertLineBreak") ||
    document.queryCommandSupported("insertHTML");
}

function dispatchFlowInputEvent(textbox) {
  const inputEvent =
    typeof InputEvent === "function"
      ? new InputEvent("input", {
          bubbles: true,
          inputType: "insertLineBreak",
          data: null
        })
      : new Event("input", { bubbles: true });

  textbox.dispatchEvent(inputEvent);
}

function insertFlowLineBreak(textbox) {
  if (!canTryFlowLineBreak(textbox)) return false;

  textbox.focus();

  if (typeof InputEvent === "function") {
    const beforeInputEvent = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertLineBreak",
      data: null
    });
    const notCanceled = textbox.dispatchEvent(beforeInputEvent);
    if (!notCanceled) {
      logFlowAction("beforeinput insertLineBreak was handled");
      return true;
    }
  }

  const insertedLineBreak = document.execCommand("insertLineBreak");
  if (insertedLineBreak) {
    dispatchFlowInputEvent(textbox);
    logFlowAction("execCommand insertLineBreak succeeded");
    return true;
  }

  const insertedHtmlBreak = document.execCommand("insertHTML", false, "<br>");
  if (insertedHtmlBreak) {
    dispatchFlowInputEvent(textbox);
    logFlowAction("execCommand insertHTML br succeeded");
    return true;
  }

  logFlowAction("line break insertion failed");
  return false;
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

function stopHandledFlowEnterEvent(event) {
  event.preventDefault();
  event.stopPropagation();
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
    return { notebookLmTextarea, flowTextbox: null, textbox: null };
  }

  const flowTextbox = getFlowTextbox(target);
  if (flowTextbox) {
    return { notebookLmTextarea: null, flowTextbox, textbox: null };
  }

  const textbox = getTargetTextbox(target);
  if (textbox) {
    return { notebookLmTextarea: null, flowTextbox: null, textbox };
  }

  return { notebookLmTextarea: null, flowTextbox: null, textbox: null };
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
  if (mode === "combo") {
    return isShift && isCtrl && !isAlt && !isMeta;
  }
  return false;
}

function isFlowEnterEvent(event) {
  return event.key === "Enter" || event.code === "Enter" || event.code === "NumpadEnter";
}

function isPlainFlowEnter(event) {
  return isFlowEnterEvent(event) &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey;
}

function isFlowSendShortcut(event, mode) {
  if (!isFlowEnterEvent(event)) return false;

  const isShift = event.shiftKey === true;
  const isCtrl = event.ctrlKey === true;
  const isAlt = event.altKey === true;
  const isMeta = event.metaKey === true;
  return shouldSendByMode(mode, isShift, isCtrl, isAlt, isMeta);
}

function isSupportedFlowSendShortcut(event, mode) {
  if (mode !== "shift" && mode !== "both") return false;
  return isFlowEnterEvent(event) &&
    event.shiftKey === true &&
    event.ctrlKey === false &&
    event.metaKey === false &&
    event.altKey === false;
}

function isFlowTrustedNativeReactShortcut(event, mode) {
  if (FLOW_SEND_STRATEGY !== "trusted-native-react-handler") return false;
  if (!isFlowEnterEvent(event) || event.altKey === true || event.metaKey === true) return false;
  if (mode === "ctrl" || mode === "both") {
    return event.ctrlKey === true && event.shiftKey === false;
  }
  if (mode === "combo") {
    return event.ctrlKey === true && event.shiftKey === true;
  }
  return false;
}

function handleKey(event) {
  if (isDispatchingSyntheticEnter) return;
  if (isDispatchingSyntheticFlowEnter && !event.isTrusted) {
    logFlowAction("synthetic Flow Enter observed by extension capture listener", {
      key: event.key,
      code: event.code,
      isTrusted: event.isTrusted,
      defaultPrevented: event.defaultPrevented
    });
    return;
  }
  if (!event.isTrusted) return;

  // IME composing/confirming should be untouched to avoid input corruption.
  const inCompositionGraceWindow =
    lastCompositionEndAt > 0 &&
    performance.now() - lastCompositionEndAt < COMPOSITION_END_GRACE_MS;
  if (isComposingActive || event.isComposing || event.keyCode === 229 || inCompositionGraceWindow) return;

  const isEnter = event.code === "Enter" || event.code === "NumpadEnter";
  if (!isEnter) return;

  const { notebookLmTextarea, flowTextbox, textbox } = getControlledInput(event.target);
  if (!notebookLmTextarea && !flowTextbox && !textbox) return;
  if (!settingsLoaded) {
    if (flowTextbox) {
      logFlowAction("keydown ignored: settings not loaded", {
        rawSettings: rawStoredSettings,
        key: event.key,
        code: event.code,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey
      });
    }
    return;
  }
  if (!settings.enabled) {
    if (flowTextbox) {
      logFlowAction("keydown ignored: extension disabled", {
        rawSettings: rawStoredSettings ? { ...rawStoredSettings } : null,
        normalizedSettings: { ...settings }
      });
    }
    return;
  }

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

  if (flowTextbox) {
    const rawMode = rawStoredSettings?.mode;
    const flowMode = isKnownSendMode(rawMode)
      ? sanitizeModeForPlatform(rawMode, isMacPlatform)
      : null;
    const isPlainEnter = isPlainFlowEnter(event);
    const shouldSend = flowMode !== null &&
      shouldSendByMode(flowMode, isShift, isCtrl, isAlt, isMeta);
    const isFlowSend = flowMode !== null && isSupportedFlowSendShortcut(event, flowMode);
    const isFlowTrustedNativeReactSend = flowMode !== null &&
      isFlowTrustedNativeReactShortcut(event, flowMode);
    const isUnavailableFlowSendShortcut = shouldSend &&
      !isFlowSend &&
      !isFlowTrustedNativeReactSend;
    const branch = isFlowSend
      ? "send"
      : isFlowTrustedNativeReactSend
        ? "trusted-native-react-handler"
      : isUnavailableFlowSendShortcut
        ? "unavailable-send-shortcut-blocked"
      : isPlainEnter
        ? "plain-enter-newline"
        : "non-selected-modified-enter-blocked";
    logFlowAction("keydown", {
      rawSettings: rawStoredSettings ? { ...rawStoredSettings } : null,
      settingsMode: settings.mode,
      normalizedMode: flowMode,
      key: event.key,
      code: event.code,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      isPlainFlowEnter: isPlainEnter,
      shouldSendByMode: shouldSend,
      isFlowSend,
      isFlowTrustedNativeReactSend,
      isUnavailableFlowSendShortcut,
      branch,
      selectedStrategy: FLOW_SEND_STRATEGY
    });

    if (isUnavailableFlowSendShortcut) {
      logFlowAction("Flow unavailable send shortcut", {
        configuredMode: flowMode,
        shiftKey: event.shiftKey,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        buttonFocusAttempted: false
      });
      stopHandledFlowEnterEvent(event);
      return;
    }

    if (isFlowTrustedNativeReactSend) {
      if (event.repeat === true) {
        logFlowAction("repeated trusted native React send shortcut blocked", {
          configuredMode: flowMode,
          repeat: true
        });
        stopHandledFlowEnterEvent(event);
        return;
      }

      const stopButton = findFlowGenerationStopButton(flowTextbox);
      if (stopButton) {
        logFlowAction("generation active; trusted native React send blocked", {
          configuredMode: flowMode,
          stopButtonConnected: stopButton.isConnected
        });
        stopHandledFlowEnterEvent(event);
        return;
      }

      const button = findFlowGenerateButton(flowTextbox);
      logFlowAction("branch: trusted native React handler", {
        configuredMode: flowMode,
        phase: FLOW_REACT_HANDLER_PHASE,
        bridgeReady: Boolean(flowReactBridgeToken),
        generateButtonFound: Boolean(button),
        buttonConnected: button?.isConnected === true,
        buttonDisabled: button ? isElementDisabled(button) : null,
        buttonAriaDisabled: button?.getAttribute("aria-disabled") ?? null,
        sendLockActive: isFlowSendLocked
      });
      if (!button) {
        stopHandledFlowEnterEvent(event);
        logFlowAction("Flow React handler send failed", {
          error: "valid generate button not found"
        });
        return;
      }
      requestFlowReactHandlerSend(event, flowTextbox, button);
      // Invoke the handler while its trusted native event is not yet default-prevented.
      stopHandledFlowEnterEvent(event);
      return;
    }

    if (isFlowSend) {
      if (event.repeat === true) {
        logFlowAction("repeated send shortcut blocked", {
          selectedMode: flowMode,
          selectedStrategy: FLOW_SEND_STRATEGY,
          repeat: true
        });
        stopHandledFlowEnterEvent(event);
        return;
      }

      const stopButton = findFlowGenerationStopButton(flowTextbox);
      if (stopButton) {
        logFlowAction("generation active; send shortcut blocked", {
          selectedMode: flowMode,
          selectedStrategy: FLOW_SEND_STRATEGY,
          stopButtonTextContent: getFlowButtonContentText(stopButton),
          stopButtonConnected: stopButton.isConnected,
          activeElement: describeFlowElement(document.activeElement)
        });
        stopHandledFlowEnterEvent(event);
        return;
      }

      const button = findFlowGenerateButton(flowTextbox);
      logFlowAction("branch: send", {
        selectedMode: flowMode,
        selectedStrategy: FLOW_SEND_STRATEGY,
        generateButtonInitialFound: Boolean(button),
        textContent: button ? getFlowButtonText(button) : null,
        isConnected: button?.isConnected === true,
        disabled: button ? isElementDisabled(button) : null,
        ariaDisabled: button?.getAttribute("aria-disabled") ?? null,
        sendLockActive: isFlowSendLocked,
        state: getFlowStateSnapshot(flowTextbox, button)
      });
      logFlowGenerateButtonCandidates(flowTextbox, button, "initial");
      executeFlowTrustedKeyHandoff(event, flowTextbox, button);
      return;
    }

    if (!isPlainEnter) {
      logFlowAction("branch: non-selected modified Enter blocked", {
        reason: "modified Enter did not match the selected send mode",
        action: "prevented"
      });
      stopHandledFlowEnterEvent(event);
      return;
    }

    if (!canTryFlowLineBreak(flowTextbox)) {
      logFlowAction("branch: plain-enter-newline", {
        action: "pass-through",
        reason: "line break insertion is not supported"
      });
      return;
    }

    logFlowAction("branch: plain-enter-newline", {
      action: "insert-line-break"
    });
    stopHandledFlowEnterEvent(event);
    const inserted = insertFlowLineBreak(flowTextbox);
    logFlowAction("plain Enter line break result", { inserted });
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

initializeFlowReactBridge();
document.addEventListener("keydown", handleKey, true);

document.addEventListener("compositionstart", (event) => {
  const { notebookLmTextarea, flowTextbox, textbox } = getControlledInput(event.target);
  if (!notebookLmTextarea && !flowTextbox && !textbox) return;
  isComposingActive = true;
}, true);

document.addEventListener("compositionend", (event) => {
  const { notebookLmTextarea, flowTextbox, textbox } = getControlledInput(event.target);
  if (!notebookLmTextarea && !flowTextbox && !textbox) return;
  isComposingActive = false;
  lastCompositionEndAt = performance.now();
}, true);
})();
