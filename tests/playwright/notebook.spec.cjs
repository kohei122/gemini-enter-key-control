const { test, expect } = require('./helpers/extension.cjs');
const clicks = page => page.evaluate(() => window.fixture.clicks);

for (const service of ['notebook', 'notebooklm']) {
  for (const [mode, shortcut] of [['shift', 'Shift+Enter'], ['ctrl', 'Control+Enter'],
    ['both', 'Shift+Enter'], ['both', 'Control+Enter'], ['combo', 'Control+Shift+Enter']]) {
    test(`${service} menu + send: ${mode} ${shortcut}`, async ({ harness }) => {
      const { page, open } = harness;
      await open(service, 'notebook-menu', { mode });
      const editor = page.getByTestId('editor');
      const menu = page.locator('#menu');
      const menuBefore = await menu.evaluate(el => el.outerHTML);
      await editor.fill('first');
      await editor.press('End');
      await editor.press('Enter');
      await expect(editor).toHaveValue('first\n');
      expect(await clicks(page)).toEqual([]);
      await editor.press(shortcut);
      expect(await clicks(page)).toEqual(['send']);
      await expect(editor).toHaveValue('first\n');
      expect(await menu.evaluate(el => el.outerHTML)).toBe(menuBefore);
      await expect(menu).toBeVisible();
      await expect(menu).toBeEnabled();
      await menu.click();
      expect(await clicks(page)).toEqual(['send', 'menu']);
    });
  }
}

for (const condition of ['menu-only', 'duplicate', 'unknown-button', 'disabled',
  'aria-disabled', 'hidden', 'other-form', 'actions-enter-button', 'two-inputs',
  'source-discovery', 'query-box-textarea', 'discoverSourcesQuery', 'missing-container',
  'missing-form', 'unknown-popup', 'class-only-menu']) {
  test(`Notebook menu + send ${condition}: fail closed`, async ({ harness }) => {
    const { page, open } = harness;
    await open('notebook', 'notebook-menu');
    await page.locator('#send').evaluate((button, condition) => {
      const container = button.closest('.message-container');
      const editor = container.querySelector('textarea');
      if (condition === 'menu-only') button.remove();
      if (condition === 'duplicate') button.after(button.cloneNode(true));
      if (condition === 'unknown-button') {
        const unknown = document.createElement('button');
        unknown.disabled = true; // An unusable unknown button still makes this ambiguous.
        container.append(unknown);
      }
      if (condition === 'disabled') button.disabled = true;
      if (condition === 'aria-disabled') button.setAttribute('aria-disabled', 'true');
      if (condition === 'hidden') button.hidden = true;
      if (condition === 'other-form') {
        const other = document.createElement('form');
        container.append(other);
        other.append(button);
      }
      if (condition === 'actions-enter-button') button.classList.add('actions-enter-button');
      if (condition === 'two-inputs') container.append(document.createElement('textarea'));
      if (condition === 'source-discovery') {
        const discovery = document.createElement('source-discovery-query-box');
        container.before(discovery);
        discovery.append(container);
      }
      if (condition === 'query-box-textarea') editor.classList.add('query-box-textarea');
      if (condition === 'discoverSourcesQuery') editor.setAttribute('formcontrolname', condition);
      if (condition === 'missing-container') container.className = 'unknown';
      if (condition === 'missing-form') document.body.append(container);
      if (condition === 'unknown-popup') container.querySelector('#menu').setAttribute('aria-haspopup', 'dialog');
      if (condition === 'class-only-menu') container.querySelector('#menu').removeAttribute('aria-haspopup');
    }, condition);
    const editor = page.getByTestId('editor');
    await editor.fill('draft');
    await editor.press('Shift+Enter');
    expect(await clicks(page)).toEqual([]);
    if (['source-discovery', 'query-box-textarea', 'discoverSourcesQuery'].includes(condition)) {
      expect(await page.evaluate(() => window.fixture.trustedShift)).toBe(1);
    }
  });
}

test('Notebook menu attribute alone: independent of class, icon and label', async ({ harness }) => {
  const { page, open } = harness;
  await open('notebook', 'notebook-menu');
  await page.locator('#menu').evaluate(menu => {
    menu.className = '';
    menu.textContent = 'Send';
    menu.setAttribute('aria-label', 'Send');
    menu.setAttribute('aria-expanded', 'true');
  });
  await page.locator('#send').evaluate(button => {
    button.textContent = 'untranslated';
    button.setAttribute('aria-label', 'Menu');
  });
  await page.getByTestId('editor').fill('draft');
  await page.getByTestId('editor').press('Shift+Enter');
  expect(await clicks(page)).toEqual(['send']);
});

test('Notebook menu + send: holding shortcut sends only once', async ({ harness }) => {
  const { page, open } = harness;
  await open('notebook', 'notebook-menu');
  await page.getByTestId('editor').fill('draft');
  await page.keyboard.down('Shift');
  await page.keyboard.down('Enter');
  await page.keyboard.down('Enter');
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  await page.keyboard.up('Shift');
  expect(await clicks(page)).toEqual(['send']);
  await expect(page.getByTestId('editor')).toHaveValue('draft');
});

test('Notebook menu + send: composition is untouched (not a native IME test)', async ({ harness }) => {
  const { page, open } = harness;
  await open('notebook', 'notebook-menu');
  const editor = page.getByTestId('editor');
  await editor.fill('composing');
  await editor.dispatchEvent('compositionstart', { data: '' });
  await editor.press('Enter');
  await editor.press('Shift+Enter');
  expect(await clicks(page)).toEqual([]);
  expect(await page.evaluate(() => window.fixture.compositionKeys)).toEqual([
    { trusted: true, prevented: false }, { trusted: true, prevented: false },
  ]);
  await editor.dispatchEvent('compositionend', { data: '' });
});
