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
