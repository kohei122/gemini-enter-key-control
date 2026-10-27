const { test, expect } = require('./helpers/extension.cjs');
const state = page => page.evaluate(() => window.fixture);
async function text(editor) {
  return editor.evaluate(el => el instanceof HTMLTextAreaElement ? el.value : el.innerText);
}
async function newline(page, editor) {
  await editor.fill('first');
  await editor.press('End');
  await editor.press('Enter');
  await expect.poll(() => text(editor)).toContain('first\n');
  await page.keyboard.type('second');
  await expect.poll(() => text(editor)).toBe('first\nsecond');
  expect((await state(page)).submits).toBe(0);
  expect((await state(page)).nativeEnters).toBe(0);
}
async function noSend(page, editor) {
  await editor.fill('draft');
  await editor.press('Shift+Enter');
  expect((await state(page)).submits).toBe(0);
}

for (const [mode, shortcut] of [['shift', 'Shift+Enter'], ['ctrl', 'Control+Enter'],
  ['both', 'Shift+Enter'], ['both', 'Control+Enter'], ['combo', 'Control+Shift+Enter']]) {
  test('Gemini ' + mode + ' ' + shortcut + ': newline then exactly one send', async ({ harness }) => {
    const { page, open } = harness;
    await open('gemini', 'gemini', { mode });
    const editor = page.getByTestId('editor');
    await newline(page, editor);
    await editor.press(shortcut);
    await expect.poll(async () => (await state(page)).submits).toBe(1);
    expect(await text(editor)).toBe('first\nsecond');
  });
}

for (const name of ['gemini-no-send', 'gemini-two-send', 'gemini-unknown-root']) {
  test(name + ': keep newline and fail closed on send', async ({ harness }) => {
    const { page, open } = harness;
    await open('gemini', name);
    const editor = page.getByTestId('editor');
    await newline(page, editor);
    await editor.press('Shift+Enter');
    expect((await state(page)).submits).toBe(0);
  });
}
for (const condition of ['disabled', 'aria-disabled', 'hidden', 'feedback']) {
  test('Gemini send button ' + condition + ': no send', async ({ harness }) => {
    const { page, open } = harness;
    await open('gemini', 'gemini');
    await page.locator('#send').evaluate((button, condition) => {
      if (condition === 'disabled') button.disabled = true;
      if (condition === 'aria-disabled') button.setAttribute('aria-disabled', 'true');
      if (condition === 'hidden') button.hidden = true;
      if (condition === 'feedback') {
        button.type = 'button'; button.removeAttribute('id'); button.setAttribute('aria-label', 'Feedback');
      }
    }, condition);
    await noSend(page, page.getByTestId('editor'));
  });
}
for (const name of ['gemini-no-input', 'gemini-hidden-only']) {
  test(name + ': no focusable input and no send', async ({ harness }) => {
    const { page, open } = harness;
    await open('gemini', name);
    if (name === 'gemini-hidden-only') {
      await page.getByTestId('editor').evaluate(el => el.focus());
      await expect(page.getByTestId('editor')).not.toBeFocused();
    }
    await page.keyboard.press('Enter');
    await page.keyboard.press('Shift+Enter');
    expect((await state(page)).submits).toBe(0);
  });
}
test('Gemini stale + valid: focused valid composer receives the send', async ({ harness }) => {
  const { page, open } = harness;
  await open('gemini', 'gemini-stale-valid');
  const editor = page.getByTestId('editor');
  await newline(page, editor);
  await editor.press('Shift+Enter');
  expect((await state(page)).clicks).toEqual(['send']);
});
test('Gemini two separate composers: sends locally, not global uniqueness', async ({ harness }) => {
  const { page, open } = harness;
  await open('gemini', 'gemini-two-composers');
  for (const id of ['editor', 'other']) {
    await page.getByTestId(id).fill('draft');
    await page.getByTestId(id).press('Shift+Enter');
  }
  expect((await state(page)).clicks).toEqual(['send', 'other-send']);
});

for (const service of ['notebook', 'notebooklm', 'chat']) {
  test(service + ': Enter newline then exactly one send', async ({ harness }) => {
    const { page, open } = harness;
    await open(service, service === 'chat' ? 'chat' : 'notebook');
    const editor = page.getByTestId('editor');
    await newline(page, editor);
    await editor.press('Shift+Enter');
    expect((await state(page)).clicks).toEqual(['send']);
  });
}
for (const [service, key] of [['gemini', 'geminiEnabled'], ['notebook', 'notebookEnabled'],
  ['chat', 'googleChatEnabled']]) {
  test(service + ' service OFF: plain Enter and shortcut pass through', async ({ harness }) => {
    const { page, open } = harness;
    await open(service, service, { [key]: false });
    const editor = page.getByTestId('editor');
    await editor.fill('draft');
    await editor.press('Enter');
    await editor.press('Shift+Enter');
    const value = await state(page);
    expect(value.nativeEnters).toBe(1);
    expect(value.trustedShift).toBe(1);
    expect(value.submits).toBe(0);
  });
}
test('master OFF: no Gemini intervention', async ({ harness }) => {
  const { page, open } = harness;
  await open('gemini', 'gemini', { enabled: false });
  const editor = page.getByTestId('editor');
  await editor.fill('draft');
  await editor.press('Enter');
  await editor.press('Shift+Enter');
  const value = await state(page);
  expect(value.nativeEnters).toBe(1);
  expect(value.trustedShift).toBe(1);
  expect(value.submits).toBe(0);
});
test('unknown service: loaded script does not intervene', async ({ harness }) => {
  const { page, open } = harness;
  await open('unknown', 'gemini');
  const editor = page.getByTestId('editor');
  await editor.fill('draft');
  await editor.press('Enter');
  await editor.press('Shift+Enter');
  expect((await state(page)).nativeEnters).toBe(1);
  expect((await state(page)).trustedShift).toBe(1);
  expect((await state(page)).submits).toBe(0);
});

test('Notebook multiple input candidates inside container: no send', async ({ harness }) => {
  const { page, open } = harness;
  await open('notebook', 'notebook-two-inputs');
  await noSend(page, page.getByTestId('editor'));
});
for (const service of ['notebook', 'chat']) {
  for (const condition of ['missing', 'duplicate', 'disabled']) {
    test(service + ' send ' + condition + ': fail closed', async ({ harness }) => {
      const { page, open } = harness;
      await open(service, service);
      await page.locator('#send').evaluate((button, condition) => {
        if (condition === 'missing') button.remove();
        if (condition === 'duplicate') button.after(button.cloneNode(true));
        if (condition === 'disabled') button.disabled = true;
      }, condition);
      await noSend(page, page.getByTestId('editor'));
    });
  }
}
for (const [service, name] of [['notebook', 'notebook-source'], ['chat', 'chat-unknown-root']]) {
  test(name + ': excluded structure passes Enter through', async ({ harness }) => {
    const { page, open } = harness;
    await open(service, name);
    const editor = page.getByTestId('editor');
    await editor.fill('draft');
    await editor.press('Enter');
    await editor.press('Shift+Enter');
    expect((await state(page)).nativeEnters).toBe(1);
    expect((await state(page)).submits).toBe(0);
  });
}
test('Google Chat active candidate list: extension abstains', async ({ harness }) => {
  const { page, open } = harness;
  await open('chat', 'chat');
  const editor = page.getByTestId('editor');
  await editor.evaluate(el => el.setAttribute('aria-activedescendant', 'candidate'));
  await editor.fill('draft');
  await editor.press('Enter');
  await editor.press('Shift+Enter');
  expect((await state(page)).nativeEnters).toBe(1);
  expect((await state(page)).submits).toBe(0);
});
test('Gemini composition state: no extension send, not a native IME test', async ({ harness }) => {
  const { page, open } = harness;
  await open('gemini', 'gemini');
  const editor = page.getByTestId('editor');
  await editor.fill('composing');
  await editor.dispatchEvent('compositionstart', { data: '' });
  await editor.press('Enter');
  await editor.press('Shift+Enter');
  expect((await state(page)).submits).toBe(0);
  expect((await state(page)).compositionKeys).toEqual([
    { trusted: true, prevented: false }, { trusted: true, prevented: false },
  ]);
  await editor.dispatchEvent('compositionend', { data: '' });
});

// EKC-001: safety contracts, not snapshots of the resolver's present choices.
// The unchanged harness loads production code and blocks external requests.
// These probes count button activations and simulated recipients, NOT Gemini sends.
const ekcEditor = id => `<div id="${id}" role="textbox" contenteditable="true">draft ${id}</div>`;
const ekcButton = (id, attrs = 'aria-label="Send message"') =>
  `<button id="${id}" type="button" ${attrs}>${id}</button>`;

async function ekcOpen(harness, markup, operations = {}) {
  const { page, open } = harness;
  await open('gemini', 'gemini');
  await page.evaluate(({ markup, operations }) => {
    document.body.innerHTML = markup;
    window.ekcProbe = { clicks: [], operations: [], order: [] };
    // Separate from fixture.submits, which counts every button as a submission.
    window.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      window.ekcProbe.clicks.push(button.id);
      window.ekcProbe.order.push('click:' + button.id);
      if (operations[button.id]) window.ekcProbe.operations.push(operations[button.id]);
    }, true);
  }, { markup, operations });
}

async function ekcExpect(page, clicks, operations = []) {
  const observed = await page.evaluate(() => window.ekcProbe);
  // Emit evidence even when the safety assertion fails. No xfail/skip/retry.
  console.log('EKC-001 observation', JSON.stringify(observed));
  expect(observed.clicks, 'only the unambiguously intended control may activate').toEqual(clicks);
  expect(observed.operations, 'simulated actions, not real service deliveries').toEqual(operations);
}

for (const shape of ['form', 'section', 'footer']) {
  for (const focused of ['a', 'b']) {
    test(`EKC-001 shared ${shape}, focus ${focused}: ambiguous recipient must abstain`, async ({ harness }) => {
      const { page } = harness;
      const editors = ekcEditor('a') + ekcEditor('b');
      const control = ekcButton('primary');
      const markup = shape === 'footer'
        ? `<section><div>${editors}</div><footer>${control}</footer></section>`
        : `<${shape}>${editors}${control}</${shape}>`;
      await ekcOpen(harness, markup, { primary: 'unresolved recipient' });
      await page.locator('#' + focused).focus();
      await page.keyboard.press('Shift+Enter');
      await ekcExpect(page, []);
    });
  }
}

for (const [kind, attrs, expected] of [
  ['unknown', 'aria-label="Unclassified action"', []],
  ['export', 'aria-label="Export draft"', []],
  ['known', 'aria-label="Send message"', ['primary']],
  ['excluded', 'aria-label="Feedback"', []],
]) {
  test(`EKC-001 single ${kind} button: require a send identity`, async ({ harness }) => {
    const { page } = harness;
    await ekcOpen(harness, `<section>${ekcEditor('a')}${ekcButton('primary', attrs)}</section>`,
      { primary: kind === 'known' ? 'A' : kind });
    await page.locator('#a').focus();
    await page.keyboard.press('Shift+Enter');
    await ekcExpect(page, expected, kind === 'known' ? ['A'] : []);
  });
}

for (const kind of ['close', 'wide', 'misleading']) {
  test(`EKC-001 ${kind} candidate scores: score dominance cannot establish ownership`, async ({ harness }) => {
    const { page } = harness;
    const high = kind === 'close' ? 'aria-label="Send message"'
      : kind === 'wide' ? 'aria-label="Send message" jslog="173899;track:generic_click"'
      // A UI migration leaves telemetry/action metadata on a repurposed control.
      : 'aria-label="Export draft" jslog="173899;track:generic_click" data-action="send-export"';
    const markup = `<section>${ekcEditor('a')}${ekcButton('primary', high)}${ekcButton('secondary')}</section>`;
    await ekcOpen(harness, markup, { primary: kind === 'misleading' ? 'export' : 'B', secondary: 'A' });
    // Equal geometry removes accidental layout differences from the close case.
    await page.locator('button').evaluateAll(buttons => buttons.forEach(button => {
      button.style.cssText = 'position:absolute;left:24px;top:160px;width:140px;height:30px';
    }));
    await page.locator('#a').focus();
    await page.keyboard.press('Shift+Enter');
    // For misleading metadata, either a verified A action or abstention is safe;
    // this shared, unlabeled ownership structure supplies no such verification.
    await ekcExpect(page, []);
  });
}

for (const condition of ['visible', 'hidden', 'disabled', 'replaced']) {
  test(`EKC-001 independent composers, old input ${condition}: focus B sends only B once`, async ({ harness }) => {
    const { page } = harness;
    await ekcOpen(harness,
      `<form>${ekcEditor('a')}${ekcButton('primary')}</form><form>${ekcEditor('b')}${ekcButton('secondary')}</form>`,
      { primary: 'A', secondary: 'B' });
    await page.locator('#a').focus();
    await page.evaluate(condition => {
      const old = document.querySelector('#a');
      if (condition === 'hidden') old.hidden = true;
      if (condition === 'disabled') {
        old.setAttribute('contenteditable', 'false'); old.setAttribute('aria-disabled', 'true');
      }
      if (condition === 'replaced') old.replaceWith(old.cloneNode(true));
      document.querySelector('#b').focus();
    }, condition);
    await page.keyboard.press('Shift+Enter');
    await ekcExpect(page, ['secondary'], ['B']);
  });
}

for (const condition of ['hidden', 'disabled']) {
  test(`EKC-001 shared form, stale input ${condition}: remaining unique input can send`, async ({ harness }) => {
    const { page } = harness;
    await ekcOpen(harness, `<form>${ekcEditor('a')}${ekcEditor('b')}${ekcButton('primary')}</form>`, { primary: 'B' });
    await page.evaluate(condition => {
      const old = document.querySelector('#a');
      if (condition === 'hidden') old.hidden = true;
      else { old.setAttribute('contenteditable', 'false'); old.setAttribute('aria-disabled', 'true'); }
      document.querySelector('#b').focus();
    }, condition);
    await page.keyboard.press('Shift+Enter');
    await ekcExpect(page, ['primary'], ['B']);
  });
}

for (const change of ['focus', 'hide-input', 'disable-input', 'detach-input', 'replace-input',
  'disable-button', 'hide-button', 'unknown-button', 'duplicate-button']) {
  test(`EKC-001 window capture ${change}: revalidate before the send`, async ({ harness }) => {
    const { page } = harness;
    await ekcOpen(harness,
      `<form>${ekcEditor('a')}${ekcButton('primary')}</form><form>${ekcEditor('b')}${ekcButton('secondary')}</form>`,
      { primary: 'A', secondary: 'B', auxiliary: 'export' });
    await page.locator('#a').focus();
    await page.evaluate(change => {
      window.addEventListener('keydown', event => {
        if (event.key !== 'Enter' || !event.isTrusted) return;
        window.ekcProbe.order.push('window:' + change);
        const editor = document.querySelector('#a');
        const button = document.querySelector('#primary');
        if (change === 'focus') document.querySelector('#b').focus();
        if (change === 'hide-input') editor.hidden = true;
        if (change === 'disable-input') editor.setAttribute('aria-disabled', 'true');
        if (change === 'detach-input') editor.remove();
        if (change === 'replace-input') editor.replaceWith(editor.cloneNode(true));
        if (change === 'disable-button') button.disabled = true;
        if (change === 'hide-button') button.hidden = true;
        if (change === 'unknown-button') {
          const replacement = document.createElement('button');
          replacement.id = 'auxiliary'; replacement.type = 'button';
          replacement.textContent = 'Export draft'; replacement.setAttribute('aria-label', 'Export draft');
          button.replaceWith(replacement);
        }
        if (change === 'duplicate-button') {
          const duplicate = button.cloneNode(true); duplicate.id = 'auxiliary';
          button.after(duplicate);
        }
      }, { capture: true });
    }, change);
    await page.keyboard.press('Shift+Enter');
    const order = await page.evaluate(() => window.ekcProbe.order);
    expect(order[0]).toBe('window:' + change);
    await ekcExpect(page, []);
  });
}

test('EKC-001 click then microtask focus change: synchronous send completes before queued work', async ({ harness }) => {
  const { page } = harness;
  await ekcOpen(harness,
    `<form>${ekcEditor('a')}${ekcButton('primary')}</form><form>${ekcEditor('b')}${ekcButton('secondary')}</form>`,
    { primary: 'A', secondary: 'B' });
  await page.evaluate(() => {
    document.querySelector('#primary').addEventListener('click', () => {
      queueMicrotask(() => {
        document.querySelector('#b').focus();
        window.ekcProbe.order.push('microtask:focus-b');
      });
    });
  });
  await page.locator('#a').focus();
  await page.keyboard.press('Shift+Enter');
  await expect(page.locator('#b')).toBeFocused();
  await ekcExpect(page, ['primary'], ['A']);
  expect(await page.evaluate(() => window.ekcProbe.order)).toEqual(['click:primary', 'microtask:focus-b']);
});

test('EKC-001 CSS visibility hidden button: no activation despite retained layout box', async ({ harness }) => {
  const { page } = harness;
  await ekcOpen(harness, `<form>${ekcEditor('a')}${ekcButton('primary')}</form>`, { primary: 'A' });
  await page.locator('#primary').evaluate(button => { button.style.visibility = 'hidden'; });
  await expect(page.locator('#primary')).toBeHidden();
  await page.locator('#a').focus();
  await page.keyboard.press('Shift+Enter');
  await ekcExpect(page, []);
});

// Compatibility controls for the tightened resolver, including language-independent identities.
for (const [identity, button] of [
  ['localized jslog', ekcButton('primary', 'aria-label="Skicka meddelande" jslog="173899;track:generic_click"')],
  ['submit type', '<button id="primary" type="submit">Go</button>'],
  ['send metadata', ekcButton('primary', 'data-action="send"')],
  ['known label with unrelated neighbor', ekcButton('primary') + ekcButton('other', 'aria-label="Unclassified action"')],
]) {
  test(`EKC-001 compatibility ${identity}: one intended activation`, async ({ harness }) => {
    const { page } = harness;
    await ekcOpen(harness, `<form>${ekcEditor('a')}${button}</form>`, { primary: 'A', other: 'other' });
    await page.locator('#a').focus();
    await page.keyboard.press('Shift+Enter');
    await ekcExpect(page, ['primary'], ['A']);
  });
}

for (const label of ['Feedback', 'More options', 'Export draft', 'Download']) {
  test(`EKC-001 conflicting jslog and ${label}: no action`, async ({ harness }) => {
    const { page } = harness;
    await ekcOpen(harness, `<form>${ekcEditor('a')}${ekcButton('primary',
      `aria-label="${label}" jslog="173899;track:generic_click"`)}</form>`, { primary: 'other' });
    await page.locator('#a').focus();
    await page.keyboard.press('Shift+Enter');
    await ekcExpect(page, []);
  });
}

for (const condition of ['display-none', 'collapse', 'ancestor-display', 'ancestor-hidden',
  'ancestor-collapse', 'visible-override']) {
  test(`EKC-001 CSS ${condition}: respect computed visibility`, async ({ harness }) => {
    const { page } = harness;
    await ekcOpen(harness, `<form>${ekcEditor('a')}<div id="wrapper">${ekcButton('primary')}</div></form>`,
      { primary: 'A' });
    await page.evaluate(condition => {
      const button = document.querySelector('#primary');
      const wrapper = document.querySelector('#wrapper');
      if (condition === 'display-none') button.style.display = 'none';
      if (condition === 'collapse') button.style.visibility = 'collapse';
      if (condition === 'ancestor-display') wrapper.style.display = 'none';
      if (condition === 'ancestor-hidden' || condition === 'visible-override') wrapper.style.visibility = 'hidden';
      if (condition === 'ancestor-collapse') wrapper.style.visibility = 'collapse';
      if (condition === 'visible-override') button.style.visibility = 'visible';
    }, condition);
    const visible = condition === 'visible-override';
    if (visible) await expect(page.locator('#primary')).toBeVisible();
    else await expect(page.locator('#primary')).toBeHidden();
    await page.locator('#a').focus();
    await page.keyboard.press('Shift+Enter');
    await ekcExpect(page, visible ? ['primary'] : [], visible ? ['A'] : []);
  });
}

for (const extra of ['<input aria-label="Search">', '<div role="textbox" contenteditable="false">Old draft</div>']) {
  test(`EKC-001 unrelated input ${extra}: does not block the unique composer`, async ({ harness }) => {
    const { page } = harness;
    await ekcOpen(harness, `<form>${extra}${ekcEditor('a')}${ekcButton('primary')}</form>`, { primary: 'A' });
    await page.locator('#a').focus();
    await page.keyboard.press('Shift+Enter');
    await ekcExpect(page, ['primary'], ['A']);
  });
}
