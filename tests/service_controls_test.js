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
function harness() {
  const source = read("tests/local_logic_test.js");
  const box = vm.createContext({ require, __dirname, console, setTimeout, clearTimeout, performance });
  vm.runInContext(source.slice(0, source.lastIndexOf("Promise.resolve()")) +
    "\nglobalThis.h = { createContentContext, ElementMock, makeButton };", box);
  return box.h;
}

async function flowTests() {
  const { createContentContext, ElementMock, makeButton } = harness();
  const matches = ElementMock.prototype.matches;
  ElementMock.prototype.matches = function(selector) {
    if (selector === '.ProseMirror[contenteditable="true"]') return this.className === "ProseMirror" && this.getAttribute("contenteditable") === "true";
    if (selector === 'button[type="submit"]') return this.tagName === "BUTTON" && this.getAttribute("type") === "submit";
    if (["flow-rich-text-editor", "flow-base-prompt-box"].includes(selector)) return this.tagName.toLowerCase() === selector;
    return matches.call(this, selector);
  };
  const ctx = createContentContext();
  ctx.URL = URL;
  ctx.location = { protocol: "https:", hostname: "flow.google.com", href: "https://flow.google.com/project/test" };
  ctx.addEventListener = ctx.removeEventListener = () => {};
  let now = 1000;
  ctx.performance = { now: () => now };
  const state = { enabled: true, selected: true, granted: true, registered: true, mode: "shift", isMac: false };
  ctx.chrome.runtime.id = "test";
  ctx.chrome.runtime.onMessage = signal();
  ctx.chrome.storage.onChanged = signal();
  ctx.chrome.runtime.sendMessage = async () => ({ ...state });
  function make() {
    const root = new ElementMock("flow-base-prompt-box");
    const wrapper = new ElementMock("flow-rich-text-editor");
    const editor = new ElementMock();
    editor.className = "ProseMirror";
    editor.setAttribute("contenteditable", "true");
    const button = makeButton();
    button.setAttribute("type", "submit");
    wrapper.append(editor); root.append(wrapper, button); ctx.document.body.append(root);
    return { root, wrapper, editor, button };
  }
  const chat = make(), other = make();
  chat.editor.focus();
  const synthetic = [];
  chat.editor.addEventListener("keydown", event => {
    synthetic.push(event);
    // Simulate bubbling back to the extension. No ProseMirror behavior is mocked as real DOM output.
    ctx.document.dispatchEvent(event);
  });
  const key = (extra = {}, target = chat.editor) => {
    const event = { type: "keydown", target, code: "Enter", key: "Enter", keyCode: 13, which: 13,
      isTrusted: true, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false,
      preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra };
    ctx.document.dispatchEvent(event); return event;
  };
  const source = read("google_flow_current.js");
  vm.runInContext(source, ctx);
  assert(!key().prevented, "inactive before handshake");
  await tick();
  assert(key().prevented);
  assert.strictEqual(synthetic.length, 1, "no recursion");
  for (const [name, value] of Object.entries({ key: "Enter", code: "Enter", keyCode: 13, which: 13,
    shiftKey: true, bubbles: true, cancelable: true, composed: true, isTrusted: false })) assert.strictEqual(synthetic[0][name], value, name);
  assert.strictEqual(chat.button.clickCount, 0);
  for (const [mode, mods, mac] of [
    ["shift", { shiftKey: true }], ["ctrl", { ctrlKey: true }], ["both", { ctrlKey: true }],
    ["both", { shiftKey: true }], ["combo", { shiftKey: true, ctrlKey: true }],
    ["cmd", { metaKey: true }, true], ["shiftCmd", { shiftKey: true, metaKey: true }, true],
    ["both", { metaKey: true }, true]
  ]) {
    Object.assign(state, { mode, isMac: !!mac }); await ctx.__gecGoogleFlowCurrent.refresh();
    const before = chat.button.clickCount;
    assert(key(mods).prevented);
    assert.strictEqual(chat.button.clickCount, before + 1, "synchronous single click: " + mode);
    key({ ...mods, repeat: true }); assert.strictEqual(chat.button.clickCount, before + 1);
  }
  Object.assign(state, { mode: "shift", isMac: false }); await ctx.__gecGoogleFlowCurrent.refresh();
  const before = synthetic.length;
  for (const extra of [{ isTrusted: false }, { isComposing: true }, { keyCode: 229 }, { which: 229 }, { code: "KeyA" }]) assert(!key(extra).prevented);
  ctx.document.dispatchEvent({ type: "compositionstart", target: chat.editor });
  assert(!key().prevented);
  ctx.document.dispatchEvent({ type: "compositionend", target: chat.editor });
  assert(!key().prevented); now += 81;
  assert(key({ code: "NumpadEnter" }).prevented);
  assert.strictEqual(synthetic.length, before + 1);
  const blocked = (set, reset) => { set(); assert(!key().prevented); reset(); };
  blocked(() => other.editor.focus(), () => chat.editor.focus());
  blocked(() => { chat.editor.isConnected = false; }, () => { chat.editor.isConnected = true; });
  blocked(() => { chat.editor.rect.width = 0; }, () => { chat.editor.rect.width = 100; });
  blocked(() => chat.editor.setAttribute("contenteditable", "false"), () => chat.editor.setAttribute("contenteditable", "true"));
  blocked(() => { chat.wrapper.tagName = "DIV"; }, () => { chat.wrapper.tagName = "FLOW-RICH-TEXT-EDITOR"; });
  blocked(() => { ctx.location.href = "https://flow.google.com/"; }, () => { ctx.location.href = "https://flow.google.com/project/test"; });
  for (const extra of [makeButton(), new ElementMock()]) {
    if (extra.tagName === "BUTTON") extra.setAttribute("type", "submit");
    else { extra.className = "ProseMirror"; extra.setAttribute("contenteditable", "true"); }
    blocked(() => chat.root.append(extra), () => { chat.root.children.pop(); extra.parentElement = null; });
  }
  for (const prop of ["disabled", "isConnected"]) {
    chat.button[prop] = prop === "disabled";
    const count = chat.button.clickCount; key({ shiftKey: true }); assert.strictEqual(chat.button.clickCount, count);
    chat.button[prop] = prop !== "disabled";
  }
  chat.button.setAttribute("aria-disabled", "true");
  const count = chat.button.clickCount; key({ shiftKey: true }); assert.strictEqual(chat.button.clickCount, count);
  chat.button.removeAttribute("aria-disabled");
  assert.strictEqual(other.button.clickCount, 0);
  for (const field of ["enabled", "selected", "granted", "registered"]) {
    state[field] = false; await ctx.__gecGoogleFlowCurrent.refresh(); assert(!key().prevented); state[field] = true;
  }
  await ctx.__gecGoogleFlowCurrent.refresh();
  vm.runInContext(source, ctx); await tick();
  const once = synthetic.length; key(); assert.strictEqual(synthetic.length, once + 1, "duplicate injection");
  ctx.__gecGoogleFlowCurrent.dispose(); assert(!key().prevented);
  vm.runInContext(source, ctx); await tick(); assert(key().prevented, "reenable");
  assert(!/execCommand\(|beforeinput|innerHTML\s*=|insertAdjacentHTML/.test(source));
}

async function staticServiceTests() {
  const { createContentContext, ElementMock } = harness();
  for (const [host, pathname, key] of [
    ["gemini.google.com", "/app", "geminiEnabled"], ["notebook.google.com", "/notebook/test", "notebookEnabled"],
    ["notebooklm.google.com", "/notebook/test", "notebookEnabled"],
    ["chat.google.com", "/", "googleChatEnabled"], ["labs.google", "/fx/tools/flow/project/test", "flowEnabled"]
  ]) {
    const ctx = createContentContext();
    ctx.location = { hostname: host, pathname };
    if (host === "chat.google.com") ctx.window.top = {}; // Gmail-embedded Chat uses the same key.
    const timers = [];
    ctx.setTimeout = fn => { timers.push(fn); return timers.length; };
    ctx.chrome.storage.onChanged = signal();
    let stored = { enabled: true, mode: "shift", [key]: false };
    ctx.chrome.storage.local.get = (defaults, callback) => callback({ ...defaults, ...stored });
    const exports = `globalThis.api = { currentServiceEnabled, handleKey, dispatchSyntheticShiftEnter, loadSettings,
      requestFlowReactHandlerSend, restoreFlowTextboxFocus };`;
    vm.runInContext(read("content_script.js").replace(/\}\)\(\);\s*$/, exports + "})();"), ctx);
    await tick();
    assert.strictEqual(ctx.api.currentServiceEnabled(), false, host + " preserves stored false");
    const event = { key: "Enter", code: "Enter", preventDefault() { throw Error("OFF preventDefault"); },
      stopPropagation() { throw Error("OFF stopPropagation"); }, stopImmediatePropagation() { throw Error("OFF stopImmediatePropagation"); } };
    ctx.api.handleKey(event);
    assert.strictEqual(ctx.api.requestFlowReactHandlerSend(event, null, null), false, "OFF never requests send bridge");
    assert.strictEqual(ctx.api.restoreFlowTextboxFocus(null, "test"), false);
    ctx.chrome.storage.onChanged.fire({ [key]: { newValue: true } }, "local");
    assert.strictEqual(ctx.api.currentServiceEnabled(), true);
    let fired = 0, focused = 0;
    const editor = new ElementMock();
    editor.focus = () => focused++;
    editor.addEventListener("keydown", () => fired++);
    ctx.api.dispatchSyntheticShiftEnter(editor);
    ctx.chrome.storage.onChanged.fire({ [key]: { newValue: false } }, "local");
    ctx.chrome.storage.onChanged.fire({ [key]: { newValue: true } }, "local");
    timers.splice(0).forEach(fn => fn());
    assert.strictEqual(fired, 0, "OFF then ON cancels old delayed actions");
    assert.strictEqual(focused, 0, "old newline cannot steal focus");
    ctx.api.dispatchSyntheticShiftEnter(editor);
    timers.splice(0).forEach(fn => fn());
    assert.strictEqual(fired, 1, "new action works after reenable");
    ctx.chrome.storage.onChanged.fire({ enabled: { newValue: false } }, "local");
    assert.strictEqual(ctx.api.currentServiceEnabled(), false);
    stored = { enabled: true, mode: "shift" };
    await ctx.api.loadSettings(); await tick();
    assert.strictEqual(ctx.api.currentServiceEnabled(), true, "missing key defaults ON");
  }
}

async function popupTests() {
  const source = read("popup.js");
  const setup = source.slice(source.indexOf("async function setupServiceControls("), source.indexOf("async function setupGoogleAiMode("));
  for (const grant of [false, true]) {
    const ids = ["gemini-service-toggle", "notebook-service-toggle", "chat-service-toggle", "flow-service-toggle", "flow-access", "flow-access-button", "service-status"];
    const elements = Object.fromEntries(ids.map(id => [id, { addEventListener(_, fn) { this.click = fn; } }]));
    const stored = { geminiEnabled: false, googleAiModeEnabled: true };
    const calls = [];
    const ctx = vm.createContext({ document: { getElementById: id => elements[id] }, getMessage: key => key,
      sanitizeEnabled: value => value !== false && value !== "false", chrome: {
        storage: { local: { get: async defaults => ({ ...defaults, ...stored }), set: async values => { calls.push("save"); Object.assign(stored, values); } } },
        permissions: { contains: async () => false, request: ({ origins }) => {
          assert.deepStrictEqual([...origins], ["https://flow.google.com/*"]); calls.push("request"); return Promise.resolve(grant);
        }, remove: async () => { calls.push("remove"); } },
        runtime: { sendMessage: async message => { calls.push(message.type); return { ok: true }; } }
      } });
    vm.runInContext(setup, ctx); await vm.runInContext("setupServiceControls(null)", ctx);
    assert.deepStrictEqual(calls, [], "opening popup never requests or writes defaults");
    assert.strictEqual(elements["gemini-service-toggle"].checked, false);
    assert.strictEqual(elements["notebook-service-toggle"].checked, true);
    assert.strictEqual(elements["flow-service-toggle"].checked, true);
    assert.strictEqual(elements["flow-access"].hidden, false);
    await elements["flow-access-button"].click();
    assert.strictEqual(calls[0], "request", "permission requested before await");
    assert.strictEqual(stored.flowEnabled, true);
    assert.strictEqual(stored.flowCurrentEnabled, grant);
    assert.strictEqual(elements["flow-access"].hidden, grant);
    assert.strictEqual(calls.includes("gec-flow-sync"), grant);
    if (!grant) assert.strictEqual(elements["service-status"].textContent, "flowAccessDenied");
    const flow = elements["flow-service-toggle"];
    calls.length = 0; flow.checked = false; await flow.click();
    assert.strictEqual(stored.flowEnabled, false); assert.strictEqual(stored.flowCurrentEnabled, false);
    assert(calls.includes("gec-flow-disable")); assert(!calls.includes("request"));
    calls.length = 0; flow.checked = true; await flow.click();
    assert.strictEqual(calls[0], "request"); assert.strictEqual(stored.flowEnabled, true);
    assert.strictEqual(stored.googleAiModeEnabled, true, "Flow leaves AI setting alone");
    const gemini = elements["gemini-service-toggle"];
    calls.length = 0; gemini.checked = true; await gemini.click();
    assert.strictEqual(stored.geminiEnabled, true); assert.deepStrictEqual(calls, ["save"]);
  }
}

async function workerTests() {
  const ai = "https://www.google.com/*", flow = "https://flow.google.com/*";
  const grants = new Set([ai, flow]);
  const stored = { enabled: true, googleAiModeEnabled: true, flowEnabled: true, flowCurrentEnabled: true };
  const scripts = new Map(), injected = [], removed = [];
  const chrome = {
    storage: { local: { get: async defaults => ({ ...defaults, ...stored }), set: async values => Object.assign(stored, values) }, onChanged: signal() },
    permissions: { contains: async ({ origins }) => grants.has(origins[0]), remove: async ({ origins }) => {
      removed.push(origins[0]); grants.delete(origins[0]); return true;
    }, onAdded: signal(), onRemoved: signal() },
    scripting: {
      getRegisteredContentScripts: async ({ ids }) => [...scripts.values()].filter(script => ids.includes(script.id)),
      registerContentScripts: async values => values.forEach(script => { assert(!scripts.has(script.id)); scripts.set(script.id, script); }),
      updateContentScripts: async values => values.forEach(script => scripts.set(script.id, script)),
      unregisterContentScripts: async ({ ids }) => ids.forEach(id => scripts.delete(id)),
      executeScript: async args => injected.push(args)
    },
    tabs: { query: async () => [{ id: 1 }], sendMessage: async () => {} },
    runtime: { id: "test", getURL: p => "chrome-extension://test/" + p, getPlatformInfo: async () => ({ os: "win" }),
      onInstalled: signal(), onStartup: signal(), onMessage: signal() }
  };
  const ctx = vm.createContext({ chrome, URL });
  vm.runInContext(read("service_worker.js"), ctx);
  const drain = () => vm.runInContext("queue", ctx);
  const message = type => new Promise(resolve => chrome.runtime.onMessage.fire({ type }, { id: "test", url: "chrome-extension://test/popup.html" }, resolve));
  await drain(); assert.strictEqual(scripts.size, 2);
  assert(injected.some(x => x.files[0] === "google_flow_current.js"));
  assert(injected.every(x => x.target.frameIds.length === 1 && x.target.frameIds[0] === 0));
  const result = await message("gec-flow-state"); assert(result.registered && result.granted && result.selected);
  stored.enabled = false; chrome.storage.onChanged.fire({ enabled: {} }, "local"); await drain();
  assert.strictEqual(scripts.size, 0); assert.strictEqual(grants.size, 2); assert(stored.flowCurrentEnabled && stored.googleAiModeEnabled);
  stored.enabled = true; chrome.storage.onChanged.fire({ enabled: {} }, "local"); await drain(); assert.strictEqual(scripts.size, 2);
  assert((await message("gec-flow-disable")).ok);
  assert.strictEqual(stored.flowEnabled, false); assert.strictEqual(stored.flowCurrentEnabled, false);
  assert.deepStrictEqual(removed, [flow]); assert(scripts.has("google-ai-mode")); assert(grants.has(ai));
  stored.flowEnabled = stored.flowCurrentEnabled = true; grants.add(flow);
  assert((await message("gec-flow-sync")).ok); assert.strictEqual(scripts.size, 2);
  grants.delete(flow); chrome.permissions.onRemoved.fire({ origins: [flow] }); await drain();
  assert.strictEqual(stored.flowCurrentEnabled, false); assert.strictEqual(stored.flowEnabled, true);
  assert(scripts.has("google-ai-mode")); assert(!scripts.has("google-flow-current"));
  grants.add(flow); stored.flowCurrentEnabled = true;
  await message("gec-flow-sync");
  const registration = scripts.get("google-flow-current"); registration.allFrames = true;
  chrome.runtime.onStartup.fire(); await drain(); assert.strictEqual(scripts.get("google-flow-current").allFrames, false);
  await message("gec-ai-disable"); assert(scripts.has("google-flow-current")); assert(grants.has(flow));
  let responded = false;
  chrome.runtime.onMessage.fire({ type: "gec-flow-disable" }, { id: "test", tab: { id: 1 }, frameId: 0, url: "https://flow.google.com/project/test" }, () => { responded = true; });
  await drain(); assert(!responded); assert(scripts.has("google-flow-current"), "tab cannot disable");
  // One broken registration must not stop the other optional host.
  scripts.clear(); grants.add(ai); stored.googleAiModeEnabled = true;
  const register = chrome.scripting.registerContentScripts;
  chrome.scripting.registerContentScripts = async values => {
    if (values[0].id === "google-ai-mode") throw Error("AI registration failed");
    return register(values);
  };
  chrome.runtime.onStartup.fire(); await drain(); assert(scripts.has("google-flow-current"));
  chrome.scripting.registerContentScripts = register;
  const restarted = vm.createContext({ chrome, URL });
  vm.runInContext(read("service_worker.js"), restarted);
  await vm.runInContext("queue", restarted);
  assert.strictEqual(scripts.size, 2, "worker restart repairs both services without duplicate registration");
}

function manifestAndLocales() {
  const manifest = JSON.parse(read("manifest.json"));
  assert.strictEqual(manifest.version, "1.6.4");
  assert.deepStrictEqual(manifest.optional_host_permissions, ["https://www.google.com/*", "https://flow.google.com/*"]);
  assert(!manifest.host_permissions);
  assert(!manifest.content_scripts.some(script => script.matches.some(match => match.includes("flow.google.com"))));
  for (const locale of ["en", "ja", "ko", "zh_CN", "zh_TW", "es", "pt_BR"]) {
    const messages = JSON.parse(read(`_locales/${locale}/messages.json`));
    for (const key of ["servicesTitle", "googleAiServiceName", "flowAccessNote", "flowAccessEnable", "flowAccessDenied", "serviceError"]) assert(messages[key]?.message, locale + " " + key);
    assert.deepStrictEqual(Object.keys(messages).sort(), Object.keys(JSON.parse(read("_locales/en/messages.json"))).sort());
  }
}

(async () => {
  await flowTests(); await staticServiceTests(); await popupTests(); await workerTests(); manifestAndLocales();
  console.log("Service controls, current Flow, optional-host isolation, popup, and locale tests: PASS");
})().catch(error => { console.error(error); process.exitCode = 1; });
