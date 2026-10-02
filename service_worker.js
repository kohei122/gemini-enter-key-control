// Only the two optional hosts are managed here. Existing static scripts stay static.
const OPTIONAL_SERVICES = {
  ai: { key: "googleAiModeEnabled", origin: "https://www.google.com/*", host: "www.google.com",
    id: "google-ai-mode", file: "google_ai_mode.js", refresh: "gec-ai-refresh" },
  flow: { key: "flowCurrentEnabled", parent: "flowEnabled", origin: "https://flow.google.com/*", host: "flow.google.com",
    id: "google-flow-current", file: "google_flow_current.js", refresh: "gec-flow-refresh" }
};
let queue = Promise.resolve();
const enabledValue = value => value !== false && value !== "false";
function scriptFor(service) {
  return { id: service.id, matches: [service.origin], js: [service.file],
    runAt: "document_idle", world: "ISOLATED", allFrames: false, persistAcrossSessions: true };
}
function registrationMatches(actual, expected) {
  return actual && Object.keys(expected).every(key => JSON.stringify(actual[key]) === JSON.stringify(expected[key]));
}
async function readServiceState(service) {
  const [stored, granted, platform, scripts] = await Promise.all([
    chrome.storage.local.get({ enabled: true, mode: "shift", [service.key]: false,
      ...(service.parent ? { [service.parent]: true } : {}) }),
    chrome.permissions.contains({ origins: [service.origin] }),
    chrome.runtime.getPlatformInfo(),
    chrome.scripting.getRegisteredContentScripts({ ids: [service.id] })
  ]);
  return { enabled: enabledValue(stored.enabled), mode: stored.mode,
    selected: stored[service.key] === true && (!service.parent || enabledValue(stored[service.parent])),
    granted, registered: registrationMatches(scripts[0], scriptFor(service)), isMac: platform.os === "mac" };
}
async function notifyService(service) {
  // IDs remain readable after revocation, even when the tab URL is unavailable.
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => chrome.tabs.sendMessage(tab.id,
    { type: service.refresh }, { frameId: 0 }).catch(() => {})));
}
async function reconcileService(service, inject = false) {
  const state = await readServiceState(service);
  if (!state.granted) {
    const stored = await chrome.storage.local.get({ [service.key]: false });
    if (stored[service.key] === true) await chrome.storage.local.set({ [service.key]: false });
  }
  const scripts = await chrome.scripting.getRegisteredContentScripts({ ids: [service.id] });
  const wanted = state.enabled && state.selected && state.granted;
  try {
    if (wanted) {
      if (!scripts.length) await chrome.scripting.registerContentScripts([scriptFor(service)]);
      else if (!registrationMatches(scripts[0], scriptFor(service))) await chrome.scripting.updateContentScripts([scriptFor(service)]);
    } else if (scripts.length) await chrome.scripting.unregisterContentScripts({ ids: [service.id] });
  } finally { await notifyService(service); }
  if (wanted && inject) {
    const tabs = await chrome.tabs.query({ url: [service.origin] });
    await Promise.all(tabs.map(tab => chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] }, files: [service.file], world: "ISOLATED"
    }).catch(() => {}))); // A tab may close or navigate while enabling.
  }
}
function schedule(task) {
  const result = queue.then(task);
  queue = result.catch(() => {});
  return result;
}
function wake(services = Object.values(OPTIONAL_SERVICES), inject = true) {
  void schedule(async () => {
    // One service failing must not prevent the other from being reconciled.
    for (const service of services) {
      try { await reconcileService(service, inject); } catch { /* Retried on the next lifecycle event or explicit enable. */ }
    }
  });
}
chrome.runtime.onInstalled.addListener(() => wake());
chrome.runtime.onStartup.addListener(() => wake());
chrome.permissions.onAdded.addListener(permissions => {
  // Each optional host is requested only by its service's explicit enable action.
  // Complete that grant in the worker even if Chrome closed the requesting popup.
  // Do not infer enable intent from existing permissions at startup/update.
  const services = Object.values(OPTIONAL_SERVICES).filter(service =>
    permissions.origins?.includes(service.origin));
  if (!services.length) return;
  void schedule(async () => {
    for (const service of services) {
      try {
        // A queued grant may already have been revoked.
        if (!await chrome.permissions.contains({ origins: [service.origin] })) continue;
        await chrome.storage.local.set({
          [service.key]: true, ...(service.parent ? { [service.parent]: true } : {})
        });
        await reconcileService(service, true);
      } catch { /* Preserve a saved selection; lifecycle events can retry registration. */ }
    }
  });
});
chrome.permissions.onRemoved.addListener(() => wake());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  const services = Object.values(OPTIONAL_SERVICES).filter(service =>
    ["enabled", "mode", service.key, service.parent].some(key => key && key in changes));
  if (services.length) wake(services, !("mode" in changes));
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id) return;
  const match = /^gec-(ai|flow)-(state|sync|disable)$/.exec(message?.type || "");
  if (!match) return;
  const service = OPTIONAL_SERVICES[match[1]];
  const action = match[2];
  const extensionPage = !sender.tab && sender.url?.startsWith(chrome.runtime.getURL(""));
  if (action === "state") {
    if (!extensionPage) {
      try { if (sender.frameId !== 0 || new URL(sender.url).origin !== `https://${service.host}`) return; }
      catch { return; }
    }
    readServiceState(service).then(respond, () => respond({ granted: false, selected: false, registered: false }));
    return true;
  }
  if (!extensionPage) return;
  schedule(async () => {
    if (action === "disable") {
      await chrome.storage.local.set({ [service.key]: false, ...(service.parent ? { [service.parent]: false } : {}) });
      try { await reconcileService(service); }
      finally { await chrome.permissions.remove({ origins: [service.origin] }); }
    } else await reconcileService(service, true);
  }).then(() => respond({ ok: true }), () => respond({ ok: false }));
  return true;
});
wake();
