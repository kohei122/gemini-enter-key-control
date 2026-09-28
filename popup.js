const DEFAULT_SETTINGS = {
  enabled: true,
  mode: "shift"
};
const FORCE_LANG_STORAGE_KEY = "forceLang";
const FORCE_LANGS = ["en", "ja", "ko", "zh_CN", "zh_TW", "es", "pt_BR"];
const OTHER_EXTENSIONS_URL = "https://chromewebstore.google.com/search/(by%20marusin)?hl=ja&authuser=0";
const CONTENT_SCRIPT_FILE = "content_script.js";
// Local verification only. Always keep this false before publishing.
const FORCE_MAC_FOR_DEBUG = false;
// Temporary real-browser diagnostics. Set this back to false before publishing.
const DEBUG_LOG_FLOW_SETTINGS = false;

function logStoredSettings(message, details = {}) {
  if (!DEBUG_LOG_FLOW_SETTINGS) return;

  chrome.storage.local.get(["enabled", "mode"], (stored) => {
    console.debug("[Gemini Enter Key Control] Popup", message, {
      ...details,
      stored,
      isMacPlatform
    });
  });
}

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

function sanitizeModeForPlatform(mode, isMac) {
  const sanitized = sanitizeMode(mode);
  if (!isMac && (sanitized === "cmd" || sanitized === "shiftCmd")) {
    return "shift";
  }
  return sanitized;
}

const toggle = document.getElementById("toggle");
const modeOptions = document.getElementById("mode-options");
const appVersion = document.getElementById("app-version");
const appHeader = document.getElementById("app-header");
const enableEnterControlLabel = document.getElementById("label-enable-enter-control");
const sendKeyTitle = document.getElementById("title-send-key");
const secondaryToggle = document.getElementById("secondary-toggle");
const secondaryToggleWrap = document.getElementById("secondary-toggle-wrap");
const secondaryContent = document.getElementById("secondary-content");
const otherExtensionsLink = document.getElementById("other-extensions-link");
const languageSettingLabel = document.getElementById("language-setting-label");
const languageSelect = document.getElementById("language-select");
const flowShortcutNotice = document.getElementById("flow-shortcut-notice");
const i18nElements = document.querySelectorAll("[data-i18n]");
let isMacPlatform = false;

function getForcedLang() {
  const forcedLang = localStorage.getItem(FORCE_LANG_STORAGE_KEY);
  return FORCE_LANGS.includes(forcedLang) ? forcedLang : null;
}

async function loadForcedMessages(forceLang) {
  if (!forceLang) return null;

  try {
    const response = await fetch(chrome.runtime.getURL(`_locales/${forceLang}/messages.json`));
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function getMessage(key, forcedMessages) {
  const forcedMessage = forcedMessages?.[key]?.message;
  if (typeof forcedMessage === "string" && forcedMessage.length > 0) {
    return forcedMessage;
  }
  return chrome.i18n.getMessage(key);
}

function applyPopupTexts(forcedMessages, isMac) {
  const appName = getMessage("appNameShort", forcedMessages);
  if (appName) {
    document.title = appName;
  }

  if (appHeader && appName) {
    appHeader.textContent = appName;
  }

  if (enableEnterControlLabel) {
    enableEnterControlLabel.textContent = getMessage("enableEnterControl", forcedMessages);
  }

  if (sendKeyTitle) {
    sendKeyTitle.textContent = getMessage("sendKey", forcedMessages);
  }

  if (languageSettingLabel) {
    languageSettingLabel.textContent = getMessage("languageSetting", forcedMessages);
  }

  if (otherExtensionsLink) {
    otherExtensionsLink.textContent = getMessage("otherExtensions", forcedMessages);
  }

  if (appVersion) {
    appVersion.textContent = `v${chrome.runtime.getManifest().version}`;
  }

  i18nElements.forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (!key) return;

    const message = getMessage(key, forcedMessages);
    if (message) element.textContent = message;
  });

}

function getModeOptionConfigs(isMac) {
  const baseOptions = [
    { value: "shift", labelKey: "modeShift" },
    { value: "ctrl", labelKey: "modeCtrl" },
    { value: "both", labelKey: "modeBoth" },
    { value: "combo", labelKey: "modeCombo" }
  ];

  if (!isMac) return baseOptions;

  return [
    { value: "shift", labelKey: "modeShift" },
    { value: "ctrl", labelKey: "modeCtrl" },
    { value: "cmd", labelKey: "modeCmd" },
    { value: "both", labelKey: "modeBothMac" },
    { value: "combo", labelKey: "modeCombo" },
    { value: "shiftCmd", labelKey: "modeShiftCmd" }
  ];
}

function renderModeOptions(isMac, selectedMode, forcedMessages) {
  if (!modeOptions) return;

  modeOptions.replaceChildren();

  for (const option of getModeOptionConfigs(isMac)) {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    const text = document.createElement("span");

    radio.type = "radio";
    radio.name = "mode";
    radio.value = option.value;
    radio.checked = option.value === selectedMode;

    text.textContent = getMessage(option.labelKey, forcedMessages);

    label.append(radio, " ", text);
    modeOptions.append(label);
  }
}

function getIsMacPlatform() {
  return new Promise((resolve) => {
    if (FORCE_MAC_FOR_DEBUG) {
      resolve(true);
      return;
    }

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

function setupLanguageSelect(forceLang) {
  if (!languageSelect) return;

  languageSelect.value = forceLang ?? "auto";
  languageSelect.addEventListener("change", () => {
    if (languageSelect.value === "auto") {
      localStorage.removeItem(FORCE_LANG_STORAGE_KEY);
    } else {
      localStorage.setItem(FORCE_LANG_STORAGE_KEY, languageSelect.value);
    }
    window.location.reload();
  });
}

function setupSecondarySection() {
  if (!secondaryToggle || !secondaryContent || !secondaryToggleWrap) return;

  secondaryToggle.addEventListener("click", () => {
    secondaryContent.classList.add("open");
    secondaryToggle.setAttribute("aria-expanded", "true");
    secondaryToggleWrap.classList.add("hidden");
  });
}

function setupOtherExtensionsLink() {
  if (!otherExtensionsLink) return;

  otherExtensionsLink.addEventListener("click", (event) => {
    event.preventDefault();
    chrome.tabs.create({ url: OTHER_EXTENSIONS_URL });
  });
}

function isNotebookHost(hostname) {
  return hostname === "notebook.google.com" ||
    hostname === "notebooklm.google.com";
}

function isGoogleChatHost(hostname) {
  return hostname === "chat.google.com";
}

function isTargetTabUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (parsed.hostname === "gemini.google.com" ||
        isNotebookHost(parsed.hostname) ||
        isGoogleChatHost(parsed.hostname)) {
      return true;
    }
    return parsed.hostname === "labs.google" && parsed.pathname.includes("/tools/flow/");
  } catch {
    return false;
  }
}

function isGoogleFlowUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      parsed.hostname === "labs.google" &&
      parsed.pathname.includes("/tools/flow/");
  } catch {
    return false;
  }
}

function shouldShowFlowShortcutNotice(url, isMac) {
  return isMac && isGoogleFlowUrl(url);
}

function updateFlowShortcutNotice() {
  if (!flowShortcutNotice || !chrome.tabs) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) return;
    const shouldShowMacNotice = shouldShowFlowShortcutNotice(tabs[0]?.url, isMacPlatform);
    flowShortcutNotice.hidden = !shouldShowMacNotice;
  });
}

function injectContentScriptIntoActiveTab() {
  if (!chrome.tabs || !chrome.scripting) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError) return;

    const tab = tabs[0];
    if (!tab || typeof tab.id !== "number" || !isTargetTabUrl(tab.url)) return;

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [CONTENT_SCRIPT_FILE]
    }, () => {
      void chrome.runtime.lastError;
    });
  });
}

async function initializePopup() {
  const forceLang = getForcedLang();
  const [forcedMessages, isMac] = await Promise.all([
    loadForcedMessages(forceLang),
    getIsMacPlatform()
  ]);
  isMacPlatform = isMac;

  injectContentScriptIntoActiveTab();
  setupSecondarySection();
  setupLanguageSelect(forceLang);
  setupOtherExtensionsLink();
  applyPopupTexts(forcedMessages, isMac);
  setupGoogleAiMode(forcedMessages);
  setupServiceControls(forcedMessages);

  chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
    const mode = sanitizeModeForPlatform(stored.mode, isMac);
    const settings = {
      enabled: sanitizeEnabled(stored.enabled),
      mode
    };

    toggle.checked = settings.enabled;
    renderModeOptions(isMac, settings.mode, forcedMessages);
    updateFlowShortcutNotice();

    if (DEBUG_LOG_FLOW_SETTINGS) {
      console.debug("[Gemini Enter Key Control] Popup settings loaded", {
        rawSettings: stored,
        normalizedSettings: settings,
        isMacPlatform: isMac
      });
    }
    chrome.storage.local.set(settings, () => {
      logStoredSettings("settings stored after initialization");
    });
  });
}

async function setupServiceControls(forcedMessages) {
  const simple = { "gemini-service-toggle": "geminiEnabled", "notebook-service-toggle": "notebookEnabled", "chat-service-toggle": "googleChatEnabled" };
  const flow = document.getElementById("flow-service-toggle");
  const access = document.getElementById("flow-access");
  const button = document.getElementById("flow-access-button");
  const status = document.getElementById("service-status");
  const origins = ["https://flow.google.com/*"];
  const show = key => { status.textContent = key ? getMessage(key, forcedMessages) : ""; };
  try {
    const stored = await chrome.storage.local.get({ geminiEnabled: true, notebookEnabled: true, googleChatEnabled: true, flowEnabled: true, flowCurrentEnabled: false });
    for (const [id, key] of Object.entries(simple)) {
      const control = document.getElementById(id);
      control.checked = sanitizeEnabled(stored[key]);
      control.disabled = false;
      control.addEventListener("click", async () => {
        control.disabled = true;
        try { await chrome.storage.local.set({ [key]: control.checked }); show(""); }
        catch { control.checked = !control.checked; show("serviceError"); }
        finally { control.disabled = false; }
      });
    }
    flow.checked = sanitizeEnabled(stored.flowEnabled);
    const granted = await chrome.permissions.contains({ origins });
    access.hidden = !flow.checked || (stored.flowCurrentEnabled === true && granted);
    flow.disabled = false;
  } catch { show("serviceError"); return; }
  async function enableCurrent() {
    flow.disabled = button.disabled = true;
    show("");
    try {
      // Invoked directly by either ON or the access button. A denial retains
      // the legacy service selection, with the current host explicitly inactive.
      const granted = await chrome.permissions.request({ origins });
      await chrome.storage.local.set({ flowEnabled: true, flowCurrentEnabled: granted });
      flow.checked = true;
      access.hidden = granted;
      if (!granted) { show("flowAccessDenied"); return; }
      const result = await chrome.runtime.sendMessage({ type: "gec-flow-sync" });
      if (!result?.ok) throw new Error("Flow registration failed");
    } catch {
      await chrome.storage.local.set({ flowCurrentEnabled: false }).catch(() => {});
      await chrome.permissions.remove({ origins }).catch(() => {});
      const stored = await chrome.storage.local.get({ flowEnabled: true }).catch(() => null);
      if (stored) flow.checked = sanitizeEnabled(stored.flowEnabled);
      access.hidden = !flow.checked;
      show("serviceError");
    } finally { flow.disabled = button.disabled = false; }
  }
  button.addEventListener("click", enableCurrent);
  flow.addEventListener("click", async () => {
    if (flow.checked) { await enableCurrent(); return; }
    flow.disabled = button.disabled = true;
    show("");
    try {
      await chrome.storage.local.set({ flowEnabled: false, flowCurrentEnabled: false });
      const result = await chrome.runtime.sendMessage({ type: "gec-flow-disable" });
      if (!result?.ok) throw new Error("Flow disable failed");
    } catch {
      const stored = await chrome.storage.local.get({ flowEnabled: true }).catch(() => null);
      if (stored) flow.checked = sanitizeEnabled(stored.flowEnabled);
      show("serviceError");
    } finally { access.hidden = !flow.checked; flow.disabled = button.disabled = false; }
  });
}

async function setupGoogleAiMode(forcedMessages) {
  const control = document.getElementById("google-ai-mode-toggle");
  const status = document.getElementById("google-ai-mode-status");
  if (!control || !status) return;
  const origins = ["https://www.google.com/*"];
  const show = key => { status.textContent = key ? getMessage(key, forcedMessages) : ""; };
  try {
    const [stored, granted] = await Promise.all([
      chrome.storage.local.get({ googleAiModeEnabled: false }),
      chrome.permissions.contains({ origins })
    ]);
    control.checked = stored.googleAiModeEnabled === true && granted;
    control.disabled = false;
  } catch { show("googleAiModeError"); return; }
  control.addEventListener("click", async () => {
    const wanted = control.checked;
    control.disabled = true;
    show("");
    try {
      // Call directly from the user's click, before any other async work.
      const granted = wanted ? await chrome.permissions.request({ origins }) : false;
      if (wanted && !granted) {
        await chrome.storage.local.set({ googleAiModeEnabled: false });
        control.checked = false;
        show("googleAiModeDenied");
        return;
      }
      if (wanted) await chrome.storage.local.set({ googleAiModeEnabled: true });
      const result = await chrome.runtime.sendMessage({ type: wanted ? "gec-ai-sync" : "gec-ai-disable" });
      if (!result?.ok) throw new Error("AI Mode setup failed");
      control.checked = wanted;
    } catch {
      control.checked = false;
      await chrome.storage.local.set({ googleAiModeEnabled: false }).catch(() => {});
      await chrome.runtime.sendMessage({ type: "gec-ai-disable" }).catch(() => {});
      show("googleAiModeError");
    } finally { control.disabled = false; }
  });
}

initializePopup();

toggle.addEventListener("change", () => {
  chrome.storage.local.set({ enabled: sanitizeEnabled(toggle.checked) }, () => {
    logStoredSettings("enabled setting saved");
  });
});

if (modeOptions) {
  modeOptions.addEventListener("change", (event) => {
    const radio = event.target;
    if (!(radio instanceof HTMLInputElement)) return;
    if (radio.name !== "mode" || !radio.checked) return;
    const mode = sanitizeModeForPlatform(radio.value, isMacPlatform);
    updateFlowShortcutNotice();
    chrome.storage.local.set({ mode }, () => {
      logStoredSettings("mode setting saved", {
        selectedRadioValue: radio.value,
        normalizedMode: mode
      });
    });
  });
}
