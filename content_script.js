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
