const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");
const tick = () => new Promise(resolve => setImmediate(resolve));
const signal = () => {
  const listeners = new Set();
  return { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn),
    fire: (...args) => [...listeners].map(fn => fn(...args)) };
};

async function contentTests() {
  // Reuse the existing DOM harness; execute only its declarations.
  const harness = read("tests/local_logic_test.js");
  const box = vm.createContext({ require, __dirname, console, setTimeout, clearTimeout, performance });
  vm.runInContext(harness.slice(0, harness.lastIndexOf("Promise.resolve()")) +
    "\nglobalThis.h = { createContentContext, ElementMock, TextareaMock, makeButton };", box);
  const { createContentContext, ElementMock, TextareaMock, makeButton } = box.h;
  const matches = ElementMock.prototype.matches;
  ElementMock.prototype.matches = function(selector) {
    if (selector === 'button[data-xid="input-plate-send-button"]') {
      return this.tagName === "BUTTON" && this.getAttribute("data-xid") === "input-plate-send-button";
    }
    if (selector === '[role="dialog"], dialog') return this.getAttribute("role") === "dialog" || this.tagName === "DIALOG";
    return matches.call(this, selector);
  };
  const ctx = createContentContext();
  ctx.URL = URL;
  ctx.location = { protocol: "https:", hostname: "www.google.com", href: "https://www.google.com/search?udm=50" };
  ctx.addEventListener = () => {};
  ctx.removeEventListener = () => {};
  let now = 1000;
  ctx.performance = { now: () => now };
  let state = { enabled: true, selected: true, granted: true, registered: true, mode: "shift", isMac: false };
  ctx.chrome.runtime.id = "test";
  ctx.chrome.runtime.sendMessage = async () => ({ ...state });
  ctx.chrome.runtime.onMessage = signal();
  ctx.chrome.storage.onChanged = signal();
  const source = read("google_ai_mode.js");
  const make = () => {
    const root = new ElementMock();
    const textarea = new TextareaMock();
    textarea.setAttribute("maxlength", "8192");
    let inner = root;
    for (let i = 0; i < 3; i++) { const next = new ElementMock(); inner.append(next); inner = next; }
    inner.append(textarea);
    const button = makeButton();
    button.setAttribute("data-xid", "input-plate-send-button");
    const voice = makeButton();
    voice.setAttribute("data-xid", "input-plate-voice-send-button");
    root.append(button, voice, makeButton("stop"), makeButton("retry"));
    ctx.document.body.append(root);
    textarea.focus();
    return { root, textarea, button, voice };
  };
  const chat = make();
  const other = make();
  chat.textarea.focus();
  const key = (mods = {}, target = chat.textarea) => {
    const event = { type: "keydown", target, code: "Enter", isTrusted: true, keyCode: 13,
      shiftKey: false, ctrlKey: false, metaKey: false, altKey: false,
      preventDefault() { this.prevented = true; }, stopImmediatePropagation() {}, ...mods };
    ctx.document.dispatchEvent(event);
    return event;
  };
  vm.runInContext(source, ctx);
  assert(!key({ shiftKey: true }).prevented, "no handling before permission handshake");
  await tick();
  for (const [mode, mods, isMac] of [
    ["shift", { shiftKey: true }], ["ctrl", { ctrlKey: true }],
    ["both", { shiftKey: true }], ["both", { ctrlKey: true }],
    ["both", { metaKey: true }, true], ["combo", { shiftKey: true, ctrlKey: true }],
    ["cmd", { metaKey: true }, true], ["shiftCmd", { shiftKey: true, metaKey: true }, true]
  ]) {
    state = { ...state, mode, isMac: !!isMac };
    await ctx.__gecGoogleAiMode.refresh();
    const before = chat.button.clickCount;
    assert(key(mods).prevented);
    assert.strictEqual(chat.button.clickCount, before + 1, mode);
  }
  state.mode = "shift";
  await ctx.__gecGoogleAiMode.refresh();
  chat.textarea.value = "abcdef";
  chat.textarea.selectionStart = chat.textarea.selectionEnd = 3;
  let input;
  chat.textarea.addEventListener("input", e => { input = e; });
  key();
  assert.strictEqual(chat.textarea.value, "abc\ndef");
  assert.strictEqual(chat.textarea.selectionStart, 4);
  assert(input.bubbles && input.composed && input.inputType === "insertLineBreak" && input.data === null);
  const count = chat.button.clickCount;
  key({ ctrlKey: true });
  assert.strictEqual(chat.button.clickCount, count);
  assert.strictEqual(chat.textarea.value, "abc\n\ndef");
  for (const mods of [{ repeat: true, shiftKey: true }, { isTrusted: false },
    { isComposing: true }, { keyCode: 229 }, { which: 229 }]) {
    const before = chat.textarea.value;
    key(mods);
    assert.strictEqual(chat.textarea.value, before);
    assert.strictEqual(chat.button.clickCount, count);
  }
  ctx.document.dispatchEvent({ type: "compositionstart", target: chat.textarea });
  assert(!key({ shiftKey: true }).prevented);
  ctx.document.dispatchEvent({ type: "compositionend", target: chat.textarea });
  assert(!key({ shiftKey: true }).prevented);
  now += 81;
  assert(key({ shiftKey: true }).prevented);
  for (const url of ["https://www.google.com/search?q=test", "https://www.google.com/ai",
    "http://www.google.com/search?udm=50", "https://www.google.com.evil/search?udm=50",
    "https://www.google.com/search?udm=1", "https://www.google.com/search?udm=50&udm=50"]) {
    ctx.location.href = url;
    assert(!key().prevented, url);
  }
  ctx.location.href = "https://www.google.com/search?udm=50";
  const blocked = (setup, restore, untouched = false) => {
    setup();
    const before = chat.button.clickCount;
    const event = key({ shiftKey: true });
    assert.strictEqual(chat.button.clickCount, before);
    if (untouched) assert(!event.prevented);
    restore();
  };
  blocked(() => { chat.button.disabled = true; }, () => { chat.button.disabled = false; });
  blocked(() => chat.button.setAttribute("aria-disabled", "true"), () => chat.button.removeAttribute("aria-disabled"));
  for (const element of [chat.textarea, chat.button]) {
    blocked(() => { element.isConnected = false; }, () => { element.isConnected = true; });
  }
  blocked(() => other.textarea.focus(), () => chat.textarea.focus(), true);
  blocked(() => chat.textarea.setAttribute("maxlength", "1500"), () => chat.textarea.setAttribute("maxlength", "8192"), true);
  blocked(() => chat.textarea.setAttribute("role", "combobox"), () => chat.textarea.removeAttribute("role"), true);
  blocked(() => chat.root.setAttribute("role", "dialog"), () => chat.root.removeAttribute("role"), true);
  blocked(() => { chat.textarea.readOnly = true; }, () => { chat.textarea.readOnly = false; }, true);
  blocked(() => { chat.button.styleSnapshot.visibility = "hidden"; },
    () => { chat.button.styleSnapshot.visibility = "visible"; });
  blocked(() => { chat.textarea.rect.width = 0; }, () => { chat.textarea.rect.width = 100; }, true);
  const originalParent = chat.textarea.parentElement;
  const deepRoot = new ElementMock();
  let deepParent = deepRoot;
  for (let i = 0; i < 7; i++) { const next = new ElementMock(); deepParent.append(next); deepParent = next; }
  const deepButton = makeButton();
  deepButton.setAttribute("data-xid", "input-plate-send-button");
  deepRoot.append(deepButton);
  ctx.document.body.append(deepRoot);
  blocked(() => { originalParent.children.pop(); deepParent.append(chat.textarea); },
    () => { deepParent.children.pop(); originalParent.append(chat.textarea); }, true);
  for (const extra of [new TextareaMock(), Object.assign(makeButton(), {})]) {
    if (extra.tagName === "BUTTON") extra.setAttribute("data-xid", "input-plate-send-button");
    blocked(() => chat.root.append(extra), () => { chat.root.children.pop(); extra.parentElement = null; }, true);
  }
  blocked(() => chat.button.removeAttribute("data-xid"),
    () => chat.button.setAttribute("data-xid", "input-plate-send-button"), true);
  assert.strictEqual(chat.voice.clickCount, 0);
  assert.strictEqual(other.button.clickCount, 0);
  for (const field of ["enabled", "selected", "granted", "registered"]) {
    state[field] = false;
    await ctx.__gecGoogleAiMode.refresh();
    assert(!key().prevented);
    state[field] = true;
  }
  await ctx.__gecGoogleAiMode.refresh();
  vm.runInContext(source, ctx);
  await tick();
  const before = chat.button.clickCount;
  key({ shiftKey: true });
  assert.strictEqual(chat.button.clickCount, before + 1, "duplicate injection");
  ctx.__gecGoogleAiMode.dispose();
  assert(!key().prevented);
  vm.runInContext(source, ctx);
  await tick();
  assert(key().prevented, "reenable after disposal");
}

async function workerTests() {
  const stored = { enabled: true, googleAiModeEnabled: false, mode: "shift" };
  let granted = false;
  let scripts = [];
  let injections = 0;
  let registrations = 0;
  let notices = 0;
  let removals = 0;
  const chrome = {
    storage: { local: { get: async defaults => ({ ...defaults, ...stored }),
      set: async changes => { Object.assign(stored, changes); } }, onChanged: signal() },
    permissions: { contains: async ({ origins }) => origins[0].includes("www.google.com") && granted, remove: async () => { granted = false; removals++; return true; },
      onAdded: signal(), onRemoved: signal() },
    scripting: {
      getRegisteredContentScripts: async ({ ids }) => scripts.filter(script => ids.includes(script.id)),
      registerContentScripts: async next => { assert.strictEqual(scripts.length, 0); scripts = next; registrations++; },
      updateContentScripts: async next => { scripts = next; },
      unregisterContentScripts: async () => { scripts = []; },
      executeScript: async () => { injections++; }
    },
    tabs: { query: async () => [{ id: 1 }], sendMessage: async () => { notices++; } },
    runtime: { id: "test", getURL: p => `chrome-extension://test/${p}`, getPlatformInfo: async () => ({ os: "win" }),
      onInstalled: signal(), onStartup: signal(), onMessage: signal() }
  };
  const ctx = vm.createContext({ chrome });
  vm.runInContext(read("service_worker.js"), ctx);
  const drain = () => vm.runInContext("queue", ctx);
  await drain();
  assert.strictEqual(scripts.length, 0);
  granted = true;
  chrome.permissions.onAdded.fire({ origins: ["https://www.google.com/*"] });
  await drain();
  assert.strictEqual(granted, true, "grant event before setting must not revoke permission");
  stored.googleAiModeEnabled = true;
  chrome.storage.onChanged.fire({ googleAiModeEnabled: {} }, "local");
  await drain();
  assert.strictEqual(scripts.length, 1);
  assert(injections > 0);
  chrome.runtime.onInstalled.fire();
  chrome.runtime.onStartup.fire();
  await drain();
  assert.strictEqual(registrations, 1);
  scripts = [];
  chrome.runtime.onInstalled.fire();
  await drain();
  assert.strictEqual(scripts.length, 1, "repair missing registration");
  stored.enabled = false;
  chrome.storage.onChanged.fire({ enabled: {} }, "local");
  await drain();
  assert.strictEqual(scripts.length, 0);
  assert(stored.googleAiModeEnabled && granted);
  stored.enabled = true;
  chrome.storage.onChanged.fire({ enabled: {} }, "local");
  await drain();
  granted = false;
  chrome.permissions.onRemoved.fire({ origins: ["https://www.google.com/*"] });
  await drain();
  assert.strictEqual(stored.googleAiModeEnabled, false);
  assert.strictEqual(scripts.length, 0);
  assert(notices > 0);
  granted = stored.googleAiModeEnabled = true;
  const reply = await new Promise(resolve => chrome.runtime.onMessage.fire({ type: "gec-ai-disable" },
    { id: "test", url: "chrome-extension://test/popup.html" }, resolve));
  assert(reply.ok);
  assert.strictEqual(stored.googleAiModeEnabled, false);
  assert.strictEqual(granted, false);
  assert.strictEqual(removals, 1);
  // A fresh worker reconstructs state without a prior in-memory flag.
  granted = stored.googleAiModeEnabled = true;
  const restarted = vm.createContext({ chrome });
  vm.runInContext(read("service_worker.js"), restarted);
  await vm.runInContext("queue", restarted);
  assert.strictEqual(scripts.length, 1);
  chrome.scripting.unregisterContentScripts = async () => { throw new Error("registration cleanup failed"); };
  const failed = await new Promise(resolve => chrome.runtime.onMessage.fire({ type: "gec-ai-disable" },
    { id: "test", url: "chrome-extension://test/popup.html" }, resolve));
  assert.strictEqual(failed.ok, false);
  assert.strictEqual(granted, false, "OFF still releases permission if unregister fails");
}

async function popupTests() {
  const source = read("popup.js");
  const secondarySetup = source.slice(source.indexOf("function setupSecondarySection("), source.indexOf("function setupOtherExtensionsLink("));
  const html = read("popup.html");
  assert(!html.includes("google-ai-details-toggle"));
  assert(!source.includes("setupGoogleAiDetails"));
  assert(/id="secondary-toggle"[^>]*aria-expanded="false"><span data-i18n="detailsLabel"><\/span> <span aria-hidden="true">▼<\/span>/.test(html));
  assert(!html.includes('id="side-panel-notice"'));
  assert(!source.includes('getMessage("sidePanelNotice"'));
  assert(html.includes('id="language-select"'));
  assert(/class="popup-footer">\s*<a[^>]*id="other-extensions-link"[^>]*><\/a>\s*<div[^>]*id="app-version"/.test(html));
  assert(/\.popup-footer\s*\{[^}]*display: flex;[^}]*flex-wrap: wrap;/.test(html));
  assert(source.includes('appVersion.textContent = `v${chrome.runtime.getManifest().version}`;'));
  assert(!/id="service-access-note"[^>]*\bhidden\b/.test(html), "explanation visible with its parent");
  const detailsStart = html.indexOf('<div class="secondary-content" id="secondary-content">');
  const mainHtml = html.slice(0, detailsStart);
  const detailsHtml = html.slice(detailsStart);
  assert(!mainHtml.includes('data-i18n="servicesTitle"'));
  assert(detailsHtml.includes('data-i18n="servicesTitle"'));
  for (const id of ["gemini-service-toggle", "notebook-service-toggle", "chat-service-toggle", "flow-service-toggle", "google-ai-mode-title", "google-ai-mode-toggle", "google-ai-mode-status"]) {
    assert(!mainHtml.includes(`id="${id}"`));
    assert(detailsHtml.includes(`id="${id}"`));
  }
  assert(!mainHtml.includes('id="service-access-note"'));
  assert(detailsHtml.includes('id="service-access-note" data-i18n="serviceAccessNote"'));
  assert(/\.secondary-content\s*\{[^}]*max-height: 0;[^}]*opacity: 0;[^}]*overflow: hidden;/.test(html));
  assert(/\.secondary-content\.open\s*\{[^}]*max-height: none;[^}]*opacity: 1;/.test(html));
  assert(/id="google-ai-mode-toggle"[^>]*aria-labelledby="google-ai-mode-title"/.test(html));
  assert(!/<label\b[^>]*>[\s\S]*?google-ai-mode-title[\s\S]*?<\/label>/.test(html), "title must not activate checkbox");
  assert(!/<label[^>]*for="google-ai-mode-toggle"/.test(html));
  const setup = source.slice(source.indexOf("async function setupGoogleAiMode("), source.indexOf("\ninitializePopup();"));
  for (const granted of [false, true]) {
    let click;
    const control = { checked: false, addEventListener: (_, fn) => { click = fn; } };
    const status = {};
    const secondaryToggle = { attrs: { "aria-expanded": "false" },
      setAttribute(key, value) { this.attrs[key] = value; },
      addEventListener(_, listener) { this.click = listener; } };
    const classes = new Set();
    const wrapClasses = new Set();
    const secondaryContent = { classList: { add: name => classes.add(name) } };
    const secondaryToggleWrap = { classList: { add: name => wrapClasses.add(name) } };
    const note = {};
    const title = {};
    const elements = { "google-ai-mode-toggle": control, "google-ai-mode-status": status,
      "service-access-note": note, "google-ai-mode-title": title };
    const stored = {};
    const calls = [];
    const ctx = vm.createContext({ document: { getElementById: id => elements[id] },
      secondaryToggle, secondaryContent, secondaryToggleWrap,
      getMessage: key => key,
      chrome: { permissions: { contains: async () => false, request: () => { calls.push("request"); return Promise.resolve(granted); } },
        storage: { local: { get: async () => stored, set: async x => { calls.push("save"); Object.assign(stored, x); } } },
        runtime: { sendMessage: async x => { calls.push(x.type); return { ok: true }; } } } });
    vm.runInContext(setup, ctx);
    vm.runInContext(secondarySetup, ctx);
    vm.runInContext("setupSecondarySection()", ctx);
    await vm.runInContext("setupGoogleAiMode(null)", ctx);
    assert(!classes.has("open"));
    assert.strictEqual(control.disabled, false, "toggle available before expanding details");
    assert.deepStrictEqual(calls, [], "opening popup never requests permission");
    secondaryToggle.click();
    assert(classes.has("open"));
    assert.deepStrictEqual(calls, [], "opening details never requests permission");
    // Explicit ON after revealing the service controls.
    control.checked = true;
    await click();
    assert.strictEqual(calls[0], "request");
    assert.strictEqual(stored.googleAiModeEnabled, granted);
    assert.strictEqual(control.checked, granted);
    assert.strictEqual(calls.includes("gec-ai-sync"), granted);
    const callsBeforeExpand = [...calls];
    secondaryToggle.click();
    assert(classes.has("open"));
    assert.strictEqual(secondaryToggle.attrs["aria-expanded"], "true");
    // Preserve the existing one-way disclosure: the button disappears after opening.
    assert(wrapClasses.has("hidden"));
    assert.strictEqual(note.click, undefined);
    assert.strictEqual(title.click, undefined);
    assert.deepStrictEqual(calls, callsBeforeExpand, "expanding details must not request permission or persist state");
    if (granted) {
      const requests = calls.filter(call => call === "request").length;
      control.checked = false;
      await click();
      assert(calls.includes("gec-ai-disable"));
      assert.strictEqual(calls.filter(call => call === "request").length, requests, "OFF must not request permission");
    }
  }
}

function manifestTests() {
  const manifest = JSON.parse(read("manifest.json"));
  assert.deepStrictEqual(manifest.permissions, ["storage", "activeTab", "scripting"]);
  assert.deepStrictEqual(manifest.optional_host_permissions, ["https://www.google.com/*", "https://flow.google.com/*"]);
  assert(!manifest.host_permissions);
  assert(!manifest.content_scripts.some(script => script.matches.some(match => match.includes("www.google.com"))));
  assert.strictEqual(manifest.background.service_worker, "service_worker.js");
  for (const locale of ["en", "ja", "ko", "zh_CN", "zh_TW", "es", "pt_BR"]) {
    const messages = JSON.parse(read(`_locales/${locale}/messages.json`));
    for (const key of ["googleAiModeEnable", "serviceAccessNote", "googleAiModeDenied", "googleAiModeError", "detailsLabel"]) assert(messages[key].message);
    assert(!Object.hasOwn(messages, "googleAiModeDetails"));
    const englishKeys = Object.keys(JSON.parse(read("_locales/en/messages.json"))).sort();
    assert.deepStrictEqual(Object.keys(messages).sort(), englishKeys, locale + " locale key parity");
    assert(!messages.serviceAccessNote.message.includes("google.com"));
    assert(!Object.hasOwn(messages, "googleAiModeNote"));
    if (locale === "ja") {
      assert.strictEqual(messages.detailsLabel.message, "詳細");
      assert.strictEqual(messages.serviceAccessNote.message,
        "各サービスでEnter改行・ショートカット送信を使用するには、それぞれのサービスへのアクセス権限が必要です。このアプリは入力内容や検索内容を収集しません。");
    }
  }
}

(async () => {
  await contentTests();
  await workerTests();
  await popupTests();
  manifestTests();
  console.log("Google AI Mode content, permissions, lifecycle, popup, and manifest tests: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
