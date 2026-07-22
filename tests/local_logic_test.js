const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { webcrypto } = require("crypto");

const ROOT = path.resolve(__dirname, "..");

class EventTargetMock {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((item) => item !== listener));
  }
  dispatchEvent(event) {
    event.target ||= this;
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener.call(this, event);
    return !event.defaultPrevented;
  }
}

class ElementMock extends EventTargetMock {
  constructor(tagName = "div") {
    super();
    this.tagName = tagName.toUpperCase();
    this.parentElement = null;
    this.children = [];
    this.attributeMap = new Map();
    this.textContent = "";
    this.isConnected = true;
    this.disabled = false;
    this.styleSnapshot = { display: "block", visibility: "visible", pointerEvents: "auto", opacity: "1" };
    this.rect = { left: 0, top: 0, width: 100, height: 40, right: 100, bottom: 40 };
    this.id = "";
    this.className = "";
  }
  get attributes() { return Array.from(this.attributeMap, ([name, value]) => ({ name, value })); }
  setAttribute(name, value) { this.attributeMap.set(name, String(value)); }
  getAttribute(name) { return this.attributeMap.has(name) ? this.attributeMap.get(name) : null; }
  hasAttribute(name) { return this.attributeMap.has(name); }
  removeAttribute(name) { this.attributeMap.delete(name); }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  matches(selector) {
    if (selector === "textarea") return this.tagName === "TEXTAREA";
    if (selector.includes("data-slate-editor")) {
      return this.getAttribute("data-slate-editor") === "true" &&
        this.getAttribute("role") === "textbox" &&
        this.getAttribute("contenteditable") === "true";
    }
    return false;
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (selector === "button" && node instanceof ButtonMock) return node;
      if (selector === "form" && node.tagName === "FORM") return node;
      if (node.matches(selector)) return node;
    }
    return null;
  }
  querySelectorAll(selector) {
    const results = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (selector === "button" && child instanceof ButtonMock) results.push(child);
        if (selector.includes("data-slate-editor") && child.matches(selector)) results.push(child);
        visit(child);
      }
    };
    visit(this);
    return results;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() { return this.rect; }
  getClientRects() { return this.rect.width > 0 && this.rect.height > 0 ? [this.rect] : []; }
  focus() { activeDocument.activeElement = this; }
}

class ButtonMock extends ElementMock { constructor() { super("button"); } }
class TextareaMock extends ElementMock { constructor() { super("textarea"); this.value = ""; } }
class CustomEventMock {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; this.defaultPrevented = false; }
}
class KeyboardEventMock {
  constructor(options) { Object.assign(this, options, { type: "keydown", defaultPrevented: false }); }
}

let activeDocument;

function makeTextbox() {
  const textbox = new ElementMock("div");
  textbox.setAttribute("data-slate-editor", "true");
  textbox.setAttribute("role", "textbox");
  textbox.setAttribute("contenteditable", "true");
  textbox.textContent = "prompt";
  return textbox;
}

function makeButton(text = "arrow_forward") {
  const button = new ButtonMock();
  button.textContent = text;
  return button;
}

function loadMainBridge(pathname = "/fx/ja/tools/flow/project/test") {
  const document = new EventTargetMock();
  const elements = [];
  document.querySelectorAll = (selector) => {
    if (selector.startsWith("button[")) {
      return elements.filter((element) => element instanceof ButtonMock &&
        element.hasAttribute("data-gec-flow-react-target"));
    }
    if (selector === "[data-gec-flow-react-textbox]") {
      return elements.filter((element) => element.hasAttribute("data-gec-flow-react-textbox"));
    }
    return [];
  };
  const context = vm.createContext({
    console: { debug() {}, warn() {} }, window: {}, document,
    location: { hostname: "labs.google", pathname },
    Element: ElementMock, HTMLElement: ElementMock, HTMLButtonElement: ButtonMock,
    CustomEvent: CustomEventMock, getComputedStyle: (element) => element.styleSnapshot,
    crypto: webcrypto, performance, setTimeout, clearTimeout, Promise, Object, Set, WeakSet
  });
  context.window = context;
  vm.runInContext(fs.readFileSync(path.join(ROOT, "flow_main_world.js"), "utf8"), context);
  let token = null;
  document.addEventListener("__gecFlowReactBridgeReady", (event) => { token = event.detail.token; });
  document.dispatchEvent(new CustomEventMock("__gecFlowReactBridgeDiscover"));
  return { document, elements, token };
}

function captureKey(harness, textbox, modifiers = {}, overrides = {}) {
  const event = new KeyboardEventMock({
    target: overrides.target || textbox,
    key: "Enter", code: "Enter", isTrusted: true, isComposing: false, repeat: false,
    shiftKey: false, ctrlKey: false, metaKey: false, altKey: false,
    ...modifiers, ...overrides
  });
  harness.document.dispatchEvent(event);
  return event;
}

function request(harness, button, textbox, requestId, expectedModifiers) {
  const responses = [];
  const listener = (event) => {
    if (event.detail.requestId === requestId) responses.push(event.detail);
  };
  harness.document.addEventListener("__gecFlowReactBridgeResponse", listener);
  button.setAttribute("data-gec-flow-react-target", requestId);
  textbox.setAttribute("data-gec-flow-react-textbox", requestId);
  harness.document.dispatchEvent(new CustomEventMock("__gecFlowReactBridgeRequest", {
    detail: {
      token: harness.token,
      requestId,
      phase: "trusted-native-key-event",
      expectedModifiers
    }
  }));
  button.removeAttribute("data-gec-flow-react-target");
  textbox.removeAttribute("data-gec-flow-react-textbox");
  harness.document.removeEventListener("__gecFlowReactBridgeResponse", listener);
  return responses;
}

async function verifyMainBridge() {
  const harness = loadMainBridge();
  assert.match(harness.token, /^[a-f0-9]{32}$/);
  const textbox = makeTextbox();
  const otherTextbox = makeTextbox();
  const button = makeButton();
  harness.elements.push(textbox, otherTextbox, button);
  let handlerCalls = 0;
  let receivedNativeEvent = null;
  button.__reactProps$test = {
    onClick(event) {
      handlerCalls += 1;
      receivedNativeEvent = event.nativeEvent;
    }
  };

  const ctrl = { shiftKey: false, ctrlKey: true, metaKey: false, altKey: false };
  const combo = { shiftKey: true, ctrlKey: true, metaKey: false, altKey: false };
  const trustedCtrl = captureKey(harness, textbox, ctrl);
  let responses = request(harness, button, textbox, "ctrl-ok", ctrl);
  assert.strictEqual(handlerCalls, 1);
  assert.strictEqual(receivedNativeEvent, trustedCtrl);
  assert.strictEqual(receivedNativeEvent.isTrusted, true);
  assert.strictEqual(responses[0].trustedKeydown.accepted, true);

  assert.strictEqual(request(harness, button, textbox, "ctrl-ok", ctrl).length, 0);
  assert.strictEqual(handlerCalls, 1);

  captureKey(harness, textbox, ctrl);
  responses = request(harness, button, textbox, "modifier-mismatch", combo);
  assert.strictEqual(responses[0].invoked, false);
  assert.strictEqual(responses[0].trustedKeydown.modifierMatch, false);

  captureKey(harness, textbox, ctrl);
  responses = request(harness, button, otherTextbox, "textbox-mismatch", ctrl);
  assert.strictEqual(responses[0].invoked, false);
  assert.strictEqual(responses[0].trustedKeydown.targetMatch, false);

  for (const invalid of [
    { repeat: true }, { isComposing: true }, { altKey: true }, { isTrusted: false }
  ]) {
    captureKey(harness, textbox, ctrl);
    captureKey(harness, textbox, ctrl, invalid);
    responses = request(harness, button, textbox, `invalid-${Object.keys(invalid)[0]}`, ctrl);
    assert.strictEqual(responses[0].invoked, false);
  }

  captureKey(harness, textbox, ctrl);
  await new Promise((resolve) => setTimeout(resolve, 275));
  responses = request(harness, button, textbox, "expired", ctrl);
  assert.strictEqual(responses[0].invoked, false);

  const fiberButton = makeButton();
  let fiberCalls = 0;
  fiberButton.__reactFiber$test = {
    tag: 5,
    memoizedProps: {},
    pendingProps: {},
    return: {
      tag: 1,
      memoizedProps: { onClick() { fiberCalls += 1; } },
      pendingProps: {},
      return: null
    }
  };
  harness.elements.push(fiberButton);
  captureKey(harness, textbox, combo);
  responses = request(harness, fiberButton, textbox, "fiber", combo);
  assert.strictEqual(fiberCalls, 1);
  assert.strictEqual(responses[0].diagnostics.handlerLocation, "fiber[1].memoizedProps.onClick");

  const pendingButton = makeButton();
  let pendingCalls = 0;
  pendingButton.__reactFiber$test = {
    tag: 5,
    memoizedProps: {},
    pendingProps: { onClick() { pendingCalls += 1; } },
    return: null
  };
  harness.elements.push(pendingButton);
  captureKey(harness, textbox, ctrl);
  responses = request(harness, pendingButton, textbox, "pending-fiber", ctrl);
  assert.strictEqual(pendingCalls, 1);
  assert.strictEqual(responses[0].diagnostics.handlerLocation, "fiber[0].pendingProps.onClick");

  const tooDeepButton = makeButton();
  let deepFiber = { tag: 15, memoizedProps: { onClick() {} }, pendingProps: {}, return: null };
  for (let depth = 14; depth >= 0; depth -= 1) {
    deepFiber = { tag: depth, memoizedProps: {}, pendingProps: {}, return: deepFiber };
  }
  tooDeepButton.__reactFiber$test = deepFiber;
  harness.elements.push(tooDeepButton);
  captureKey(harness, textbox, ctrl);
  responses = request(harness, tooDeepButton, textbox, "fiber-depth-limit", ctrl);
  assert.strictEqual(responses[0].invoked, false);

  const throwing = makeButton();
  throwing.__reactProps$test = { onClick() { throw new Error("handler failure"); } };
  harness.elements.push(throwing);
  captureKey(harness, textbox, ctrl);
  responses = request(harness, throwing, textbox, "exception", ctrl);
  assert.strictEqual(responses[0].invoked, false);
  assert.match(responses[0].error, /handler failure/);

  for (const invalidButton of [
    makeButton("stop"), makeButton("arrow_forward stop"), makeButton("close"),
    makeButton("add_2"), makeButton("article_spark"), makeButton("tune")
  ]) {
    invalidButton.__reactProps$test = { onClick() { throw new Error("invalid button handler ran"); } };
    harness.elements.push(invalidButton);
    captureKey(harness, textbox, ctrl);
    responses = request(harness, invalidButton, textbox, `invalid-button-${invalidButton.textContent}`, ctrl);
    assert.strictEqual(responses[0].invoked, false);
  }
}

function createContentContext() {
  const document = new EventTargetMock();
  document.documentElement = new ElementMock("html");
  document.body = new ElementMock("body");
  document.documentElement.append(document.body);
  document.activeElement = document.body;
  document.querySelectorAll = (...args) => document.documentElement.querySelectorAll(...args);
  document.querySelector = () => null;
  document.createRange = () => ({ selectNodeContents() {}, collapse() {} });
  document.execCommand = () => false;
  activeDocument = document;
  const context = vm.createContext({
    console: { debug() {}, log() {}, warn() {}, group() {}, groupEnd() {} }, window: {}, document,
    location: { hostname: "gemini.google.com", pathname: "/app" },
    chrome: {
      runtime: { lastError: null, getPlatformInfo(callback) { callback({ os: "win" }); } },
      storage: {
        local: { get(defaults, callback) { callback(defaults === null ? { enabled: true, mode: "shift" } : defaults); } },
        onChanged: { addListener() {} }
      }
    },
    Element: ElementMock, HTMLElement: ElementMock, HTMLButtonElement: ButtonMock,
    HTMLTextAreaElement: TextareaMock, CustomEvent: CustomEventMock,
    KeyboardEvent: class {}, InputEvent: class {}, Event: class {},
    getComputedStyle: (element) => element.styleSnapshot,
    crypto: webcrypto, performance, setTimeout, clearTimeout, Node: { TEXT_NODE: 3 }
  });
  context.window = context;
  context.window.getSelection = () => null;
  return context;
}

async function verifyContentLogic() {
  let source = fs.readFileSync(path.join(ROOT, "content_script.js"), "utf8");
  const exports = `
globalThis.__test = {
  shouldSendByMode, isPlainFlowEnter, isSupportedFlowSendShortcut,
  isFlowTrustedNativeReactShortcut, findFlowGenerateButton,
  findFlowGenerationStopButton, findSendButton,
  inspectFlowTrustedKeyHandoffAfterDelay, restoreFlowTextboxFocus, handleKey
};
globalThis.__setTestSettings = (mode, isMac) => {
  rawStoredSettings = { enabled: true, mode };
  settings = { enabled: true, mode };
  settingsLoaded = true;
  isMacPlatform = isMac;
};
`;
  source = source.replace(/\}\)\(\);\s*$/, `${exports}})();`);
  const context = createContentContext();
  vm.runInContext(source, context, { filename: "content_script.js" });
  const api = context.__test;
  const key = (shiftKey, ctrlKey, altKey = false) => ({
    key: "Enter", code: "Enter", shiftKey, ctrlKey, metaKey: false, altKey
  });
  const route = (mode, event) => {
    const shouldSend = api.shouldSendByMode(
      mode, event.shiftKey, event.ctrlKey, event.altKey, event.metaKey
    );
    if (api.isSupportedFlowSendShortcut(event, mode)) return "handoff";
    if (api.isFlowTrustedNativeReactShortcut(event, mode)) return "react";
    if (shouldSend) return "unavailable";
    if (api.isPlainFlowEnter(event)) return "newline";
    return "blocked";
  };

  assert.strictEqual(route("shift", key(true, false)), "handoff");
  assert.strictEqual(route("shift", key(false, true)), "blocked");
  assert.strictEqual(route("shift", key(true, true)), "blocked");
  assert.strictEqual(route("ctrl", key(false, true)), "react");
  assert.strictEqual(route("ctrl", key(true, false)), "blocked");
  assert.strictEqual(route("ctrl", key(true, true)), "blocked");
  assert.strictEqual(route("both", key(true, false)), "handoff");
  assert.strictEqual(route("both", key(false, true)), "react");
  assert.strictEqual(route("both", key(true, true)), "blocked");
  assert.strictEqual(route("combo", key(true, true)), "react");
  assert.strictEqual(route("combo", key(true, false)), "blocked");
  assert.strictEqual(route("combo", key(false, true)), "blocked");
  assert.strictEqual(route("shift", key(false, false)), "newline");
  assert.strictEqual(route("shift", key(false, false, true)), "blocked");
  assert.strictEqual(route("cmd", {
    ...key(false, false), metaKey: true
  }), "unavailable");
  assert.strictEqual(route("shiftCmd", {
    ...key(true, false), metaKey: true
  }), "unavailable");
  assert.strictEqual(route("both", {
    ...key(false, false), metaKey: true
  }), "unavailable");

  context.location.hostname = "labs.google";
  context.location.pathname = "/fx/ja/tools/flow/project/test";
  const root = new ElementMock("section");
  root.rect = { left: 0, top: 0, width: 400, height: 120, right: 400, bottom: 120 };
  const textbox = makeTextbox();
  const stop = makeButton("stop");
  const send = makeButton("arrow_forward");
  send.rect = { left: 350, top: 40, width: 40, height: 40, right: 390, bottom: 80 };
  root.append(textbox, stop, send);
  context.document.body.append(root);
  await new Promise((resolve) => setTimeout(resolve, 0));

  let prevented = 0;
  let propagationStops = 0;
  const controlledEvent = (overrides) => ({
    target: textbox,
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    isTrusted: true,
    isComposing: false,
    repeat: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    preventDefault() { prevented += 1; },
    stopPropagation() { propagationStops += 1; },
    stopImmediatePropagation() { propagationStops += 1; },
    ...overrides
  });
  api.handleKey(controlledEvent({ isComposing: true, keyCode: 229 }));
  assert.strictEqual(prevented, 0);
  assert.strictEqual(propagationStops, 0);
  api.handleKey(controlledEvent({ shiftKey: true, repeat: true }));
  assert.strictEqual(prevented, 1);
  assert.strictEqual(propagationStops, 2);

  let bridgeRequests = 0;
  context.document.addEventListener("__gecFlowReactBridgeRequest", () => { bridgeRequests += 1; });
  const macCases = [
    ["cmd", { metaKey: true }],
    ["shiftCmd", { shiftKey: true, metaKey: true }],
    ["both", { metaKey: true }]
  ];
  for (const [mode, modifiers] of macCases) {
    context.__setTestSettings(mode, true);
    activeDocument.activeElement = textbox;
    const preventedBefore = prevented;
    const propagationBefore = propagationStops;
    api.handleKey(controlledEvent(modifiers));
    assert.strictEqual(prevented, preventedBefore + 1);
    assert.strictEqual(propagationStops, propagationBefore + 2);
    assert.strictEqual(activeDocument.activeElement, textbox);
    assert.strictEqual(send.hasAttribute("data-gec-flow-react-target"), false);
  }
  assert.strictEqual(bridgeRequests, 0);
  context.__setTestSettings("shift", false);

  assert.strictEqual(api.findFlowGenerateButton(textbox), send);
  assert.strictEqual(api.findFlowGenerationStopButton(textbox), stop);
  send.setAttribute("aria-disabled", "true");
  assert.strictEqual(api.findFlowGenerateButton(textbox), null);
  send.removeAttribute("aria-disabled");
  send.disabled = true;
  assert.strictEqual(api.findFlowGenerateButton(textbox), null);
  send.disabled = false;
  textbox.textContent = "   ";
  assert.strictEqual(api.findFlowGenerateButton(textbox), null);
  textbox.textContent = "prompt";

  activeDocument.activeElement = activeDocument.body;
  assert.strictEqual(api.restoreFlowTextboxFocus(textbox, "handler-exception"), true);
  assert.strictEqual(activeDocument.activeElement, textbox);

  activeDocument.activeElement = activeDocument.body;
  send.isConnected = false;
  api.inspectFlowTrustedKeyHandoffAfterDelay(
    textbox,
    send,
    { textboxTextLength: textbox.textContent.length },
    "trusted-native-react-handler"
  );
  await new Promise((resolve) => setTimeout(resolve, 125));
  assert.strictEqual(activeDocument.activeElement, textbox);

  context.location.hostname = "gemini.google.com";
  context.location.pathname = "/app";
  const geminiRoot = new ElementMock("section");
  const geminiTextbox = new ElementMock("div");
  const upload = makeButton("Upload");
  upload.setAttribute("jslog", "300142;track:generic_click");
  const geminiSend = makeButton("Skicka meddelande");
  geminiSend.setAttribute("jslog", "173899;track:generic_click");
  geminiRoot.append(geminiTextbox, upload, geminiSend);
  assert.strictEqual(api.findSendButton(geminiTextbox), geminiSend);
}

function verifyManifestScope() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const mainWorld = manifest.content_scripts.find((entry) => entry.world === "MAIN");
  assert.deepStrictEqual(mainWorld.matches, ["https://labs.google/fx/*"]);
  assert.strictEqual(mainWorld.run_at, "document_start");
  const normalWorld = manifest.content_scripts.find((entry) => entry.js.includes("content_script.js"));
  assert(normalWorld.matches.includes("https://gemini.google.com/*"));
  assert(normalWorld.matches.includes("https://notebooklm.google.com/*"));
  const nonFlowMainWorld = loadMainBridge("/fx/ja/tools/imagefx");
  assert.strictEqual(nonFlowMainWorld.token, null);
}

function verifyLocalesAndLanguageIndependentFlowSignals() {
  const localeNames = ["ja", "en", "ko", "zh_CN", "zh_TW", "es", "pt_BR"];
  const expectedNotices = {
    ja: "Google Flowでは、Commandキーを使った送信には現在対応していません。",
    en: "Command-key sending shortcuts are currently not supported in Google Flow.",
    ko: "Google Flow에서는 현재 Command 키를 사용한 전송을 지원하지 않습니다.",
    zh_CN: "Google Flow 目前不支持使用 Command 键发送。",
    zh_TW: "Google Flow 目前不支援使用 Command 鍵傳送。",
    es: "Actualmente, Google Flow no admite atajos de envío con la tecla Command.",
    pt_BR: "No momento, o Google Flow não oferece suporte a atalhos de envio com a tecla Command."
  };
  let expectedKeys = null;
  for (const localeName of localeNames) {
    const messages = JSON.parse(fs.readFileSync(
      path.join(ROOT, "_locales", localeName, "messages.json"),
      "utf8"
    ));
    const keys = Object.keys(messages).sort();
    expectedKeys ||= keys;
    assert.deepStrictEqual(keys, expectedKeys);
    assert.strictEqual(messages.flowShortcutNotice.message, expectedNotices[localeName]);
  }

  const popupHtml = fs.readFileSync(path.join(ROOT, "popup.html"), "utf8");
  assert(!popupHtml.includes(".flow-shortcut-notice.warning"));
  const popupMessageKeys = [...popupHtml.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1]);
  for (const key of popupMessageKeys) assert(expectedKeys.includes(key), `missing locale key: ${key}`);
  const popupSource = fs.readFileSync(path.join(ROOT, "popup.js"), "utf8");
  assert(popupSource.includes("return isMac && isGoogleFlowUrl(url);"));
  assert(popupSource.includes(
    "const shouldShowMacNotice = shouldShowFlowShortcutNotice(tabs[0]?.url, isMacPlatform);"
  ));
  assert(popupSource.includes("const DEBUG_LOG_FLOW_SETTINGS = false;"));
  const extractFunction = (name) => {
    const start = popupSource.indexOf(`function ${name}(`);
    assert(start >= 0, `popup function not found: ${name}`);
    const bodyStart = popupSource.indexOf("{", start);
    let depth = 0;
    for (let index = bodyStart; index < popupSource.length; index += 1) {
      if (popupSource[index] === "{") depth += 1;
      if (popupSource[index] === "}") depth -= 1;
      if (depth === 0) return popupSource.slice(start, index + 1);
    }
    throw new Error(`popup function was not closed: ${name}`);
  };
  const popupLogicContext = vm.createContext({ URL });
  vm.runInContext(`
    ${extractFunction("isGoogleFlowUrl")}
    ${extractFunction("shouldShowFlowShortcutNotice")}
    globalThis.popupLogic = { isGoogleFlowUrl, shouldShowFlowShortcutNotice };
  `, popupLogicContext);
  const flowUrl = "https://labs.google/fx/ja/tools/flow/project/test";
  assert.strictEqual(popupLogicContext.popupLogic.shouldShowFlowShortcutNotice(flowUrl, true), true);
  assert.strictEqual(popupLogicContext.popupLogic.shouldShowFlowShortcutNotice(flowUrl, false), false);
  for (const url of [
    "https://gemini.google.com/app",
    "https://notebooklm.google.com/notebook/test",
    "https://labs.google/fx/ja/tools/imagefx"
  ]) {
    assert.strictEqual(popupLogicContext.popupLogic.shouldShowFlowShortcutNotice(url, true), false);
  }

  const flowSources = ["content_script.js", "flow_main_world.js"]
    .map((fileName) => fs.readFileSync(path.join(ROOT, fileName), "utf8"))
    .join("\n");
  assert(!/["'](?:作成|Create|Generate|停止|何を作成しますか？)["']/.test(flowSources));
  for (const symbol of ["arrow_forward", "stop", "close", "add_2", "article_spark", "tune"]) {
    assert(flowSources.includes(`"${symbol}"`));
  }
  assert(flowSources.includes("const DEBUG_LOG_FLOW_ACTIONS = false;"));
  assert(flowSources.includes("const DEBUG_LOG_FLOW_MAIN = false;"));
}

Promise.resolve()
  .then(verifyMainBridge)
  .then(verifyContentLogic)
  .then(verifyManifestScope)
  .then(verifyLocalesAndLanguageIndependentFlowSignals)
  .then(() => console.log("Local Flow, Gemini, and manifest regression verification: PASS"))
  .catch((error) => { console.error(error); process.exitCode = 1; });
