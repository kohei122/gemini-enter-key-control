const { test: base, expect, chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');

const repo = path.resolve(__dirname, '../../..');
const fixtureRoot = path.resolve(__dirname, '../fixtures');
const targets = {
  gemini: ['gemini.google.com', '/app'],
  notebook: ['notebook.google.com', '/notebook/mock'],
  notebooklm: ['notebooklm.google.com', '/notebook/mock'],
  chat: ['chat.google.com', '/u/0/dm/mock'],
  unknown: ['unknown.invalid', '/app'],
};

const test = base.extend({
  harness: async ({}, use) => {
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gemini-mock-dom-'));
    const extension = path.join(temporaryRoot, 'extension');
    let context, server;
    const errors = [], blocked = [], served = [];
    try {
      await fs.mkdir(extension);
      for (const name of ['content_script.js', 'flow_main_world.js', 'google_ai_mode.js',
        'google_flow_current.js', 'service_worker.js', 'popup.js', 'popup.html',
        'icon16.png', 'icon48.png', 'icon128.png', '_locales']) {
        await fs.cp(path.join(repo, name), path.join(extension, name), { recursive: true });
      }
      await fs.copyFile(path.join(__dirname, 'settings-observer.js'),
        path.join(extension, 'settings-observer.js'));
      const manifest = JSON.parse(await fs.readFile(path.join(repo, 'manifest.json'), 'utf8'));
      // Production host checks remain intact. Only the temporary copy gains an
      // unknown-host negative control and an observer before its isolated script.
      for (const script of manifest.content_scripts) {
        if (script.js.includes('content_script.js')) script.js.unshift('settings-observer.js');
      }
      manifest.content_scripts.push({
        matches: ['https://unknown.invalid/*'],
        js: ['settings-observer.js', 'content_script.js'], run_at: 'document_idle',
      });
      await fs.writeFile(path.join(extension, 'manifest.json'), JSON.stringify(manifest));

      server = http.createServer(async (request, response) => {
        const name = request.url.slice(1);
        if (!/^[a-z-]+\.(html|js|css)$/.test(name)) return response.writeHead(404).end();
        try {
          const body = await fs.readFile(path.join(fixtureRoot, name));
          response.writeHead(200, { 'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' :
            name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8' }).end(body);
        } catch { response.writeHead(404).end(); }
      });
      await new Promise((resolve, reject) => {
        server.once('error', reject); server.listen(0, '127.0.0.1', resolve);
      });
      const loopback = 'http://127.0.0.1:' + server.address().port;
      context = await chromium.launchPersistentContext(path.join(temporaryRoot, 'profile'), {
        channel: 'chromium', headless: true,
        args: ['--disable-extensions-except=' + extension, '--load-extension=' + extension,
          '--disable-background-networking', '--no-proxy-server',
          '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
      });
      // ALL web requests are fulfilled with loopback bytes or aborted. There is
      // deliberately no route.continue() / route.fetch() to a Google origin.
      let host, documentPath, fixture;
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        let file;
        if (url.protocol === 'https:' && url.hostname === host &&
            !url.port && !url.search && route.request().method() === 'GET') {
          if (url.pathname === documentPath) file = fixture + '.html';
          if (url.pathname === '/page.js' || url.pathname === '/page.css') file = url.pathname.slice(1);
        }
        if (!file) { blocked.push(url.href); return route.abort('blockedbyclient'); }
        const response = await fetch(loopback + '/' + file);
        if (response.status !== 200) { blocked.push('missing fixture: ' + file); return route.abort(); }
        served.push(file);
        await route.fulfill({ status: 200, body: Buffer.from(await response.arrayBuffer()),
          contentType: response.headers.get('content-type'),
          headers: { 'Cache-Control': 'no-store',
            'Content-Security-Policy': "default-src 'self'; img-src data:; connect-src 'none'; form-action 'none'; object-src 'none'; worker-src 'none'" } });
      });
      context.on('weberror', error => errors.push(error.error().message));
      context.on('page', page => page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
      }));
      const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
      expect(worker.url()).toMatch(/^chrome-extension:\/\/[a-p]{32}\/service_worker\.js$/);
      const page = await context.newPage();
      const open = async (service, name, settings = {}) => {
        [host, documentPath] = targets[service];
        fixture = name;
        await worker.evaluate(async settings => {
          await chrome.storage.local.clear();
          await chrome.storage.local.set({ enabled: true, mode: 'shift',
            geminiEnabled: true, notebookEnabled: true, googleChatEnabled: true,
            flowEnabled: false, flowCurrentEnabled: false, googleAiModeEnabled: false,
            ...settings });
        }, settings);
        await page.goto('https://' + host + documentPath);
        await expect(page.locator('html')).toHaveAttribute('data-gec-test-settings-ready', 'true');
        await expect(page.locator('html')).toHaveAttribute('data-gemini-enter-key-control-initialized', /.+/);
        await expect(page.locator('html')).toHaveAttribute('data-fixture-ready', 'true');
        await page.bringToFront();
      };
      await use({ page, open });
      expect(errors, 'JS/console errors').toEqual([]);
      expect(blocked, 'unexpected requests').toEqual([]);
      expect(served).toContain(fixture + '.html');
      expect(await context.cookies()).toEqual([]);
      expect(await worker.evaluate(() => Promise.all(
        ['https://www.google.com/*', 'https://flow.google.com/*'].map(origin =>
          chrome.permissions.contains({ origins: [origin] })))),
      'each optional host remains ungranted').toEqual([false, false]);
    } finally {
      try { if (context) await context.close(); }
      finally {
        try { if (server) await new Promise((resolve, reject) =>
          server.close(error => error ? reject(error) : resolve())); }
        finally { await fs.rm(temporaryRoot, { recursive: true, force: true }); }
      }
    }
  },
});
module.exports = { test, expect };
