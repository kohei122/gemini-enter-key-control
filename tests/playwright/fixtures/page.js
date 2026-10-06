// Minimal host editor behavior; no extension mode, service or candidate logic.
window.fixture = { submits: 0, clicks: [], nativeEnters: 0, newlines: 0, trustedShift: 0, compositionKeys: [] };
let composing = false;
document.addEventListener('compositionstart', () => { composing = true; });
document.addEventListener('compositionend', () => { composing = false; });
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  event.preventDefault();
  window.fixture.submits++;
  window.fixture.clicks.push(button.id);
}, true);
document.querySelectorAll('form').forEach(form =>
  form.addEventListener('submit', event => event.preventDefault()));
document.addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  const input = event.target;
  if (!input.isContentEditable && !(input instanceof HTMLTextAreaElement)) return;
  if (composing || event.isComposing || event.keyCode === 229) {
    window.fixture.compositionKeys.push({ trusted: event.isTrusted, prevented: event.defaultPrevented });
    return;
  }
  if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    window.fixture.nativeEnters++; // Observe host default handling without an alternate send implementation.
  } else if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (event.isTrusted) window.fixture.trustedShift++;
    if (input.isContentEditable) {
      event.preventDefault();
      document.execCommand('insertLineBreak'); // Page editor's handling of synthetic Shift+Enter.
      window.fixture.newlines++;
    }
  }
});
document.documentElement.setAttribute('data-fixture-ready', 'true');
