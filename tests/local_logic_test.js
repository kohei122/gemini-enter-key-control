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
    const selectors = selector.split(",").map((item) => item.trim());
    if (selectors.length > 1) return selectors.some((item) => this.matches(item));
    const classes = String(this.className || "").split(/\s+/).filter(Boolean);
    if (selector === "textarea") return this.tagName === "TEXTAREA";
    if (selector === "textarea.query-box-input") {
      return this.tagName === "TEXTAREA" && classes.includes("query-box-input");
    }
    if (selector === "textarea.query-box-textarea") {
      return this.tagName === "TEXTAREA" && classes.includes("query-box-textarea");
    }
    if (selector === 'textarea[formcontrolname="discoverSourcesQuery"]') {
      return this.tagName === "TEXTAREA" &&
        this.getAttribute("formcontrolname") === "discoverSourcesQuery";
    }
    if (selector === 'button.submit-button[type="submit"]') {
      return this.tagName === "BUTTON" &&
        classes.includes("submit-button") &&
        this.getAttribute("type") === "submit";
    }
    if (selector === 'c-wiz[data-is-room-compose-postbar="true"][role="region"]') {
      return this.tagName === "C-WIZ" &&
        this.getAttribute("data-is-room-compose-postbar") === "true" &&
        this.getAttribute("role") === "region";
    }
    if (selector ===
        '[role="textbox"][contenteditable="true"][aria-multiline="true"][g_editable="true"]') {
      return this.getAttribute("role") === "textbox" &&
        this.getAttribute("contenteditable") === "true" &&
        this.getAttribute("aria-multiline") === "true" &&
        this.getAttribute("g_editable") === "true";
    }
    if (selector === 'button[jsname="GBTyxb"]') {
      return this.tagName === "BUTTON" && this.getAttribute("jsname") === "GBTyxb";
    }
    if (selector === 'button[jsname="ssKfee"]') {
      return this.tagName === "BUTTON" && this.getAttribute("jsname") === "ssKfee";
    }
    if (selector === '[role="listbox"]') return this.getAttribute("role") === "listbox";
    if (selector === '[role="menu"]') return this.getAttribute("role") === "menu";
    if (selector === '[role="option"][aria-selected="true"]') {
      return this.getAttribute("role") === "option" &&
        this.getAttribute("aria-selected") === "true";
    }
    if (selector === '[data-expanded="true"]') {
      return this.getAttribute("data-expanded") === "true";
    }
    if (selector === ".actions-enter-button") return classes.includes("actions-enter-button");
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
        if (selector !== "button" && child.matches(selector)) results.push(child);
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

class ButtonMock extends ElementMock {
  constructor() {
    super("button");
    this.clickCount = 0;
  }
  click() { this.clickCount += 1; }
}
class TextareaMock extends ElementMock {
  constructor() {
    super("textarea");
    this.value = "";
    this.selectionStart = 0;
    this.selectionEnd = 0;
  }
  setRangeText(replacement, start, end) {
    this.value = `${this.value.slice(0, start)}${replacement}${this.value.slice(end)}`;
    this.selectionStart = start + replacement.length;
    this.selectionEnd = this.selectionStart;
  }
}
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
  document.getElementById = (id) => {
    const visit = (node) => {
      if (node.id === id || node.getAttribute?.("id") === id) return node;
      for (const child of node.children || []) {
        const match = visit(child);
        if (match) return match;
      }
      return null;
    };
    return visit(document.documentElement);
  };
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
    KeyboardEvent: class {
      constructor(type, init = {}) {
        Object.assign(this, init, { type, isTrusted: false, defaultPrevented: false });
      }
    },
    InputEvent: class {
      constructor(type, init = {}) {
        Object.assign(this, init, { type, defaultPrevented: false });
      }
    },
    Event: class {
      constructor(type, init = {}) {
        Object.assign(this, init, { type, defaultPrevented: false });
      }
    },
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
  inspectFlowTrustedKeyHandoffAfterDelay, restoreFlowTextboxFocus, handleKey,
  isNotebookHost, getNotebookLmChatTextarea, findNotebookLmSendButton,
  isGoogleChatHost, isGoogleChatEditor, getGoogleChatComposer,
  getGoogleChatComposerRoot, findGoogleChatSendButton,
  shouldBypassGoogleChatEnter,
  isSyntheticEnterDispatchActive: () => isDispatchingSyntheticEnter
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

  const makeNotebookComposer = () => {
    const form = new ElementMock("form");
    const textarea = new TextareaMock();
    textarea.className = "query-box-input";
    const button = makeButton("send");
    button.className = "submit-button";
    button.setAttribute("type", "submit");
    form.append(textarea, button);
    context.document.body.append(form);
    return { form, textarea, button };
  };

  assert.strictEqual(api.isNotebookHost("notebook.google.com"), true);
  assert.strictEqual(api.isNotebookHost("notebooklm.google.com"), true);
  assert.strictEqual(api.isNotebookHost("evil-notebook.google.com"), false);
  assert.strictEqual(api.isNotebookHost("notebook.google.com.evil.example"), false);

  const notebook = makeNotebookComposer();
  for (const hostname of ["notebook.google.com", "notebooklm.google.com"]) {
    context.location.hostname = hostname;
    assert.strictEqual(api.getNotebookLmChatTextarea(notebook.textarea), notebook.textarea);
    assert.strictEqual(api.findNotebookLmSendButton(notebook.textarea), notebook.button);
  }
  context.location.hostname = "example.com";
  assert.strictEqual(api.getNotebookLmChatTextarea(notebook.textarea), null);

  context.location.hostname = "notebook.google.com";
  const detachedChat = new TextareaMock();
  detachedChat.className = "query-box-input";
  assert.strictEqual(api.getNotebookLmChatTextarea(detachedChat), detachedChat);
  assert.strictEqual(api.findNotebookLmSendButton(detachedChat), null);
  const sourceSearch = new TextareaMock();
  sourceSearch.className = "query-box-input query-box-textarea";
  assert.strictEqual(api.getNotebookLmChatTextarea(sourceSearch), null);
  const discoverSources = new TextareaMock();
  discoverSources.className = "query-box-input";
  discoverSources.setAttribute("formcontrolname", "discoverSourcesQuery");
  assert.strictEqual(api.getNotebookLmChatTextarea(discoverSources), null);

  notebook.button.className = "submit-button actions-enter-button";
  assert.strictEqual(api.findNotebookLmSendButton(notebook.textarea), null);
  notebook.button.className = "submit-button";
  notebook.button.disabled = true;
  assert.strictEqual(api.findNotebookLmSendButton(notebook.textarea), null);
  notebook.button.disabled = false;
  notebook.button.setAttribute("aria-disabled", "true");
  assert.strictEqual(api.findNotebookLmSendButton(notebook.textarea), null);
  notebook.button.removeAttribute("aria-disabled");
  notebook.button.rect.width = 0;
  assert.strictEqual(api.findNotebookLmSendButton(notebook.textarea), null);
  notebook.button.rect.width = 100;
  const secondButton = makeButton("send two");
  secondButton.className = "submit-button";
  secondButton.setAttribute("type", "submit");
  notebook.form.append(secondButton);
  assert.strictEqual(api.findNotebookLmSendButton(notebook.textarea), null);

  const notebookKeys = makeNotebookComposer();
  const notebookEvent = (modifiers = {}, overrides = {}) => {
    let prevented = 0;
    let propagationStops = 0;
    const event = {
      target: notebookKeys.textarea,
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
      ...modifiers,
      ...overrides
    };
    return {
      event,
      get prevented() { return prevented; },
      get propagationStops() { return propagationStops; }
    };
  };
  const expectNotebookSend = (mode, modifiers, isMac = false) => {
    context.__setTestSettings(mode, isMac);
    const before = notebookKeys.button.clickCount;
    const captured = notebookEvent(modifiers);
    api.handleKey(captured.event);
    assert.strictEqual(notebookKeys.button.clickCount, before + 1, `${mode} should send`);
    assert.strictEqual(captured.prevented, 1);
    assert.strictEqual(captured.propagationStops, 1);
  };
  expectNotebookSend("shift", { shiftKey: true });
  expectNotebookSend("ctrl", { ctrlKey: true });
  expectNotebookSend("cmd", { metaKey: true }, true);
  expectNotebookSend("both", { shiftKey: true });
  expectNotebookSend("both", { ctrlKey: true });
  expectNotebookSend("both", { metaKey: true }, true);
  expectNotebookSend("combo", { shiftKey: true, ctrlKey: true });
  expectNotebookSend("shiftCmd", { shiftKey: true, metaKey: true }, true);

  context.__setTestSettings("shift", false);
  notebookKeys.textarea.value = "prompt";
  notebookKeys.textarea.selectionStart = notebookKeys.textarea.value.length;
  notebookKeys.textarea.selectionEnd = notebookKeys.textarea.value.length;
  const plainEnter = notebookEvent();
  api.handleKey(plainEnter.event);
  assert.strictEqual(notebookKeys.textarea.value, "prompt\n");
  const clicksBeforeNonSelected = notebookKeys.button.clickCount;
  const nonSelected = notebookEvent({ ctrlKey: true });
  api.handleKey(nonSelected.event);
  assert.strictEqual(notebookKeys.button.clickCount, clicksBeforeNonSelected);
  const altEnter = notebookEvent({ altKey: true });
  api.handleKey(altEnter.event);
  assert.strictEqual(notebookKeys.button.clickCount, clicksBeforeNonSelected);

  const valueBeforeRepeat = notebookKeys.textarea.value;
  const repeated = notebookEvent({ shiftKey: true }, { repeat: true });
  api.handleKey(repeated.event);
  assert.strictEqual(notebookKeys.button.clickCount, clicksBeforeNonSelected);
  assert.strictEqual(notebookKeys.textarea.value, valueBeforeRepeat);
  assert.strictEqual(repeated.prevented, 1);

  for (const overrides of [
    { isComposing: true },
    { keyCode: 229 }
  ]) {
    const beforeValue = notebookKeys.textarea.value;
    const beforeClicks = notebookKeys.button.clickCount;
    const composing = notebookEvent({ shiftKey: true }, overrides);
    api.handleKey(composing.event);
    assert.strictEqual(notebookKeys.textarea.value, beforeValue);
    assert.strictEqual(notebookKeys.button.clickCount, beforeClicks);
    assert.strictEqual(composing.prevented, 0);
  }

  const makeGoogleChatComposer = (sendAriaLabel = "localized send label") => {
    const root = new ElementMock("c-wiz");
    root.setAttribute("data-is-room-compose-postbar", "true");
    root.setAttribute("role", "region");
    const editor = new ElementMock("div");
    editor.setAttribute("role", "textbox");
    editor.setAttribute("contenteditable", "true");
    editor.setAttribute("aria-multiline", "true");
    editor.setAttribute("g_editable", "true");
    const sendButton = makeButton("localized send label");
    sendButton.setAttribute("jsname", "GBTyxb");
    if (sendAriaLabel !== null) sendButton.setAttribute("aria-label", sendAriaLabel);
    const scheduleButton = makeButton("localized schedule label");
    scheduleButton.setAttribute("jsname", "ssKfee");
    root.append(editor, sendButton, scheduleButton);
    context.document.body.append(root);
    return { root, editor, sendButton, scheduleButton };
  };

  context.location.hostname = "chat.google.com";
  context.location.pathname = "/u/0/dm/test";
  assert.strictEqual(api.isGoogleChatHost("chat.google.com"), true);
  assert.strictEqual(api.isGoogleChatHost("mail.google.com"), false);
  assert.strictEqual(api.isGoogleChatHost("chat.google.com.evil.example"), false);

  const chat = makeGoogleChatComposer();
  activeDocument.activeElement = chat.editor;
  assert.strictEqual(api.isGoogleChatEditor(chat.editor), true);
  assert.strictEqual(api.getGoogleChatComposer(chat.editor), chat.editor);
  assert.strictEqual(api.getGoogleChatComposerRoot(chat.editor), chat.root);
  assert.strictEqual(api.findGoogleChatSendButton(chat.editor), chat.sendButton);
  assert.strictEqual(chat.scheduleButton.clickCount, 0);

  for (const ariaLabel of ["メッセージを送信", "Send message", "메시지 보내기", null]) {
    const localizedChat = makeGoogleChatComposer(ariaLabel);
    assert.strictEqual(
      api.findGoogleChatSendButton(localizedChat.editor),
      localizedChat.sendButton,
      `Google Chat send detection must not depend on aria-label: ${ariaLabel}`
    );
  }

  const outsideEditor = new ElementMock("div");
  for (const [name, value] of [
    ["role", "textbox"],
    ["contenteditable", "true"],
    ["aria-multiline", "true"],
    ["g_editable", "true"]
  ]) {
    outsideEditor.setAttribute(name, value);
  }
  context.document.body.append(outsideEditor);
  assert.strictEqual(api.getGoogleChatComposer(outsideEditor), null);

  for (const role of ["search", "dialog"]) {
    const excludedContainer = new ElementMock("div");
    excludedContainer.setAttribute("role", role);
    const excludedEditor = new ElementMock("div");
    for (const [name, value] of [
      ["role", "textbox"],
      ["contenteditable", "true"],
      ["aria-multiline", "true"],
      ["g_editable", "true"]
    ]) {
      excludedEditor.setAttribute(name, value);
    }
    excludedContainer.append(excludedEditor);
    context.document.body.append(excludedContainer);
    assert.strictEqual(api.getGoogleChatComposer(excludedEditor), null);
  }

  for (const [attribute, value] of [
    ["contenteditable", "false"],
    ["aria-multiline", null],
    ["g_editable", null]
  ]) {
    const invalid = makeGoogleChatComposer();
    if (value === null) invalid.editor.removeAttribute(attribute);
    else invalid.editor.setAttribute(attribute, value);
    assert.strictEqual(api.getGoogleChatComposer(invalid.editor), null);
  }
  const hiddenChat = makeGoogleChatComposer();
  hiddenChat.editor.rect.width = 0;
  assert.strictEqual(api.getGoogleChatComposer(hiddenChat.editor), null);

  chat.sendButton.disabled = true;
  assert.strictEqual(api.findGoogleChatSendButton(chat.editor), null);
  chat.sendButton.disabled = false;
  chat.sendButton.setAttribute("aria-disabled", "true");
  assert.strictEqual(api.findGoogleChatSendButton(chat.editor), null);
  chat.sendButton.removeAttribute("aria-disabled");
  chat.sendButton.rect.width = 0;
  assert.strictEqual(api.findGoogleChatSendButton(chat.editor), null);
  chat.sendButton.rect.width = 100;
  assert.strictEqual(api.findGoogleChatSendButton(chat.editor), chat.sendButton);

  const ambiguousChat = makeGoogleChatComposer();
  const duplicateSend = makeButton("duplicate");
  duplicateSend.setAttribute("jsname", "GBTyxb");
  ambiguousChat.root.append(duplicateSend);
  assert.strictEqual(api.findGoogleChatSendButton(ambiguousChat.editor), null);
  assert.strictEqual(api.findGoogleChatSendButton(outsideEditor), null);

  const candidateChat = makeGoogleChatComposer();
  activeDocument.activeElement = candidateChat.editor;
  const candidateEvent = { key: "Enter" };
  assert.strictEqual(api.shouldBypassGoogleChatEnter(candidateEvent, candidateChat.editor), false);
  candidateChat.editor.setAttribute("aria-activedescendant", "active-option");
  assert.strictEqual(api.shouldBypassGoogleChatEnter(candidateEvent, candidateChat.editor), true);
  candidateChat.editor.removeAttribute("aria-activedescendant");

  const listbox = new ElementMock("div");
  listbox.id = "chat-suggestions";
  listbox.setAttribute("role", "listbox");
  listbox.rect.width = 0;
  candidateChat.root.append(listbox);
  candidateChat.editor.setAttribute("aria-controls", listbox.id);
  assert.strictEqual(api.shouldBypassGoogleChatEnter(candidateEvent, candidateChat.editor), false);
  listbox.rect.width = 100;
  assert.strictEqual(api.shouldBypassGoogleChatEnter(candidateEvent, candidateChat.editor), true);

  const expandedCandidates = new ElementMock("div");
  expandedCandidates.setAttribute("data-expanded", "true");
  candidateChat.root.append(expandedCandidates);
  listbox.rect.width = 0;
  assert.strictEqual(api.shouldBypassGoogleChatEnter(candidateEvent, candidateChat.editor), true);
  activeDocument.activeElement = activeDocument.body;
  assert.strictEqual(api.shouldBypassGoogleChatEnter(candidateEvent, candidateChat.editor), true);

  const chatKeys = makeGoogleChatComposer();
  activeDocument.activeElement = chatKeys.editor;
  let syntheticLineBreaks = 0;
  chatKeys.editor.addEventListener("keydown", (event) => {
    if (event.shiftKey === true && event.isTrusted === false) syntheticLineBreaks += 1;
  });
  const waitForSyntheticEnterGuard = async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (!api.isSyntheticEnterDispatchActive()) return;
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.fail("synthetic Enter re-entry guard did not clear");
  };
  const chatEvent = (modifiers = {}, overrides = {}) => {
    let prevented = 0;
    let propagationStops = 0;
    const event = {
      target: chatKeys.editor,
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
      ...modifiers,
      ...overrides
    };
    return {
      event,
      get prevented() { return prevented; },
      get propagationStops() { return propagationStops; }
    };
  };
  const expectChatSend = (mode, modifiers, isMac = false) => {
    context.__setTestSettings(mode, isMac);
    activeDocument.activeElement = chatKeys.editor;
    const before = chatKeys.sendButton.clickCount;
    const captured = chatEvent(modifiers);
    api.handleKey(captured.event);
    assert.strictEqual(chatKeys.sendButton.clickCount, before + 1, `${mode} should send in Chat`);
    assert.strictEqual(chatKeys.scheduleButton.clickCount, 0);
    assert.strictEqual(captured.prevented, 1);
    assert.strictEqual(captured.propagationStops, 1);
  };
  expectChatSend("shift", { shiftKey: true });
  expectChatSend("ctrl", { ctrlKey: true });
  expectChatSend("cmd", { metaKey: true }, true);
  expectChatSend("both", { shiftKey: true });
  expectChatSend("both", { ctrlKey: true });
  expectChatSend("both", { metaKey: true }, true);
  expectChatSend("combo", { shiftKey: true, ctrlKey: true });
  expectChatSend("shiftCmd", { shiftKey: true, metaKey: true }, true);

  context.__setTestSettings("shift", false);
  activeDocument.activeElement = chatKeys.editor;
  const plainChatEnter = chatEvent();
  api.handleKey(plainChatEnter.event);
  await new Promise((resolve) => setTimeout(resolve, 5));
  await waitForSyntheticEnterGuard();
  assert.strictEqual(syntheticLineBreaks, 1);
  assert.strictEqual(plainChatEnter.prevented, 1);

  const clicksBeforeNonSelectedChat = chatKeys.sendButton.clickCount;
  const nonSelectedChat = chatEvent({ ctrlKey: true });
  api.handleKey(nonSelectedChat.event);
  await new Promise((resolve) => setTimeout(resolve, 5));
  await waitForSyntheticEnterGuard();
  assert.strictEqual(chatKeys.sendButton.clickCount, clicksBeforeNonSelectedChat);
  assert.strictEqual(syntheticLineBreaks, 2);
  const altChat = chatEvent({ altKey: true });
  api.handleKey(altChat.event);
  await new Promise((resolve) => setTimeout(resolve, 5));
  await waitForSyntheticEnterGuard();
  assert.strictEqual(chatKeys.sendButton.clickCount, clicksBeforeNonSelectedChat);
  assert.strictEqual(syntheticLineBreaks, 3);

  const repeatedChat = chatEvent({ shiftKey: true }, { repeat: true });
  api.handleKey(repeatedChat.event);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.strictEqual(chatKeys.sendButton.clickCount, clicksBeforeNonSelectedChat);
  assert.strictEqual(syntheticLineBreaks, 3);
  assert.strictEqual(repeatedChat.prevented, 1);

  const untrustedChat = chatEvent({ shiftKey: true }, { isTrusted: false });
  api.handleKey(untrustedChat.event);
  assert.strictEqual(untrustedChat.prevented, 0);
  for (const overrides of [{ isComposing: true }, { keyCode: 229 }]) {
    const before = chatKeys.sendButton.clickCount;
    const composingChat = chatEvent({ shiftKey: true }, overrides);
    api.handleKey(composingChat.event);
    assert.strictEqual(chatKeys.sendButton.clickCount, before);
    assert.strictEqual(composingChat.prevented, 0);
  }

  chatKeys.sendButton.disabled = true;
  const disabledSend = chatEvent({ shiftKey: true });
  api.handleKey(disabledSend.event);
  assert.strictEqual(chatKeys.sendButton.clickCount, clicksBeforeNonSelectedChat);
  assert.strictEqual(disabledSend.prevented, 1);
  chatKeys.sendButton.disabled = false;
  chatKeys.sendButton.setAttribute("jsname", "not-send");
  const missingSend = chatEvent({ shiftKey: true });
  api.handleKey(missingSend.event);
  assert.strictEqual(chatKeys.sendButton.clickCount, clicksBeforeNonSelectedChat);
  assert.strictEqual(missingSend.prevented, 1);
  chatKeys.sendButton.setAttribute("jsname", "GBTyxb");

  const bypassedChat = makeGoogleChatComposer();
  activeDocument.activeElement = bypassedChat.editor;
  bypassedChat.editor.setAttribute("aria-activedescendant", "mention-option");
  const bypassEvent = chatEvent();
  bypassEvent.event.target = bypassedChat.editor;
  api.handleKey(bypassEvent.event);
  assert.strictEqual(bypassEvent.prevented, 0);

  context.document.dispatchEvent({ type: "compositionend", target: notebookKeys.textarea });
  const graceWindow = notebookEvent({ shiftKey: true });
  api.handleKey(graceWindow.event);
  assert.strictEqual(graceWindow.prevented, 0);
  await new Promise((resolve) => setTimeout(resolve, 90));
  activeDocument.activeElement = chatKeys.editor;
  context.document.dispatchEvent({ type: "compositionstart", target: chatKeys.editor });
  const activeComposition = chatEvent({ shiftKey: true });
  api.handleKey(activeComposition.event);
  assert.strictEqual(activeComposition.prevented, 0);
  context.document.dispatchEvent({ type: "compositionend", target: chatKeys.editor });
  const chatGraceWindow = chatEvent({ shiftKey: true });
  api.handleKey(chatGraceWindow.event);
  assert.strictEqual(chatGraceWindow.prevented, 0);
}

function verifyManifestScope() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8"));
  const mainWorld = manifest.content_scripts.find((entry) => entry.world === "MAIN");
  assert.deepStrictEqual(mainWorld.matches, ["https://labs.google/fx/*"]);
  assert.strictEqual(mainWorld.run_at, "document_start");
  assert(!mainWorld.matches.some((match) => match.includes("notebook")));
  const normalWorld = manifest.content_scripts.find((entry) => entry.js.includes("content_script.js"));
  assert(normalWorld.matches.includes("https://chat.google.com/*"));
  assert(normalWorld.matches.includes("https://gemini.google.com/*"));
  assert(normalWorld.matches.includes("https://notebook.google.com/*"));
  assert(normalWorld.matches.includes("https://notebooklm.google.com/*"));
  assert.strictEqual(manifest.version, "1.6.0");
  assert.strictEqual(Object.hasOwn(manifest, "host_permissions"), false);
  assert(!normalWorld.matches.some((match) => match.includes("mail.google.com")));
  assert(!mainWorld.matches.some((match) => match.includes("chat.google.com")));
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
    assert(messages.appDescription.message.includes("Google Chat"));
    assert(messages.sidePanelNotice.message.includes("Google Chat"));
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
    ${extractFunction("isNotebookHost")}
    ${extractFunction("isGoogleChatHost")}
    ${extractFunction("isTargetTabUrl")}
    ${extractFunction("isGoogleFlowUrl")}
    ${extractFunction("shouldShowFlowShortcutNotice")}
    globalThis.popupLogic = {
      isNotebookHost, isGoogleChatHost, isTargetTabUrl,
      isGoogleFlowUrl, shouldShowFlowShortcutNotice
    };
  `, popupLogicContext);
  for (const url of [
    "https://chat.google.com/",
    "https://chat.google.com/u/0/",
    "https://chat.google.com/u/0/dm/example",
    "https://chat.google.com/u/0/room/example",
    "https://chat.google.com/u/0/dm/example?foo=bar"
  ]) {
    assert.strictEqual(popupLogicContext.popupLogic.isTargetTabUrl(url), true, url);
  }
  for (const url of [
    "http://chat.google.com/",
    "https://chat.google.com.evil.example/",
    "https://evil-chat.google.com/",
    "https://mail.google.com/",
    "https://example.com/chat.google.com/"
  ]) {
    assert.strictEqual(popupLogicContext.popupLogic.isTargetTabUrl(url), false, url);
  }
  for (const url of [
    "https://notebook.google.com/",
    "https://notebook.google.com",
    "https://notebook.google.com/notebook/97d2c3da-59b8-4447-8d4c-f0d78876e95e",
    "https://notebook.google.com/notebook/abc?foo=bar",
    "https://notebooklm.google.com/",
    "https://notebooklm.google.com",
    "https://notebooklm.google.com/notebook/abc"
  ]) {
    assert.strictEqual(popupLogicContext.popupLogic.isTargetTabUrl(url), true, url);
  }
  for (const url of [
    "http://notebook.google.com/",
    "https://notebook.google.com.evil.example/",
    "https://evil-notebook.google.com/",
    "https://notebooklm.google.com.evil.example/"
  ]) {
    assert.strictEqual(popupLogicContext.popupLogic.isTargetTabUrl(url), false, url);
  }
  const flowUrl = "https://labs.google/fx/ja/tools/flow/project/test";
  assert.strictEqual(popupLogicContext.popupLogic.shouldShowFlowShortcutNotice(flowUrl, true), true);
  assert.strictEqual(popupLogicContext.popupLogic.shouldShowFlowShortcutNotice(flowUrl, false), false);
  for (const url of [
    "https://chat.google.com/",
    "https://gemini.google.com/app",
    "https://notebook.google.com/notebook/test",
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
  .then(() => console.log(
    "Local Flow, Gemini, Notebook, Google Chat, and manifest regression verification: PASS"
  ))
  .catch((error) => { console.error(error); process.exitCode = 1; });
