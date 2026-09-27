import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync(new URL('../launch/index.html', import.meta.url), 'utf8');
let appInstance = 0;

async function loadApp(t, initialHash = '') {
  const closeEvents = [];
  const historyTasks = [];
  const animationFrames = [];
  const elements = new Map();
  const document = new EventTarget();
  const window = new EventTarget();
  const scrollCalls = [];
  window.scrollY = 1800;
  window.scrollTo = options => { scrollCalls.push(options); window.scrollY = options.top; };

  class ElementPort extends EventTarget {
    constructor(tag) {
      super();
      this.attributes = new Map([...tag.matchAll(/\s([\w-]+)(?:="([^"]*)")?/g)].map(match => [match[1], match[2] ?? '']));
      this.id = this.getAttribute('id');
      this.dataset = this.hasAttribute('data-step') ? {step: this.getAttribute('data-step')} : {};
      this.open = false;
      this.isConnected = true;
      this.focusCount = 0;
      this.scrollIntoViewCount = 0;
    }
    get target() { return this.getAttribute('target'); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    matches(selector) { return selector === '[data-open-sample]' && this.hasAttribute('data-open-sample'); }
    closest(selector) { return this.matches(selector) ? this : null; }
    focus() { document.activeElement = this; this.focusCount += 1; }
    scrollIntoView() { this.scrollIntoViewCount += 1; }
    showModal() { this.open = true; }
    close() {
      if (!this.open) return;
      this.open = false;
      // Native dialog closing queues its close event separately from history traversal.
      closeEvents.push(() => this.dispatchEvent(new Event('close')));
    }
  }

  for (const match of html.matchAll(/<[^>]*\bid="[^"]+"[^>]*>/g)) {
    const element = new ElementPort(match[0]);
    elements.set(element.id, element);
  }
  document.querySelector = selector => elements.get(selector.slice(1));
  document.getElementById = id => elements.get(id);
  document.querySelectorAll = selector => {
    assert.equal(selector, '[data-step]');
    return [...elements.values()].filter(element => element.hasAttribute('data-step'));
  };

  const entries = [
    {url: new URL('https://previous.test/'), state: null},
    {url: new URL(`https://aro.test/${initialHash}`), state: null},
  ];
  let index = 1;
  const location = {};
  for (const key of ['hash', 'pathname', 'search']) Object.defineProperty(location, key, {get: () => entries[index].url[key]});
  const history = {
    get state() { return entries[index].state; },
    get length() { return entries.length; },
    pushState(state, unused, href) {
      const url = new URL(href, entries[index].url);
      entries.splice(index + 1, entries.length, {url, state: structuredClone(state)});
      index += 1;
    },
    replaceState(state, unused, href) {
      entries[index] = {url: new URL(href, entries[index].url), state: structuredClone(state)};
    },
    back() {
      historyTasks.push(() => {
        if (index > 0) index -= 1;
        window.dispatchEvent(new Event('popstate'));
        window.dispatchEvent(new Event('hashchange'));
      });
    },
  };

  const globals = {document, window, history, location, requestAnimationFrame: fn => animationFrames.push(fn)};
  const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, globals);
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  await import(`../launch/app.js?lifecycle-test=${++appInstance}`);

  function flush(queue) { while (queue.length) queue.shift()(); }
  function click(id) {
    const element = elements.get(id);
    const event = new Event('click', {cancelable: true});
    Object.defineProperties(event, {target: {value: element}, button: {value: 0}});
    (element.hasAttribute('data-open-sample') ? document : element).dispatchEvent(event);
  }
  const dialog = elements.get('sample-dialog');
  return {
    document, window, history, location, elements, dialog, click, scrollCalls,
    get pendingBacks() { return historyTasks.length; },
    flushHistory() { flush(historyTasks); },
    flushCloseEvents() { flush(closeEvents); },
    flushFrames() { flush(animationFrames); },
    cancel(cancelable) {
      const event = new Event('cancel', {cancelable});
      dialog.dispatchEvent(event);
      if (!event.defaultPrevented) dialog.close();
      return event;
    },
  };
}

function assertOpenerRestoredOnce(app, id = 'open-career-interview') {
  app.flushFrames();
  assert.equal(app.document.activeElement, app.elements.get(id));
  assert.equal(app.elements.get(id).focusCount, 1);
  assert.deepEqual(app.scrollCalls, [{top: 1800, behavior: 'instant'}]);
}

function assertReopenedDialogWorks(app) {
  app.click('open-career-interview');
  assert.equal(app.dialog.open, true);
  app.click('tab-reuse');
  assert.equal(app.location.hash, '#sample/career/reuse');
  app.click('close-sample');
  assert.equal(app.pendingBacks, 1);
  app.flushHistory();
  assert.equal(app.dialog.open, false);
  assert.equal(app.location.hash, '');
}

test('initial page and duplicate navigation events do not move focus or scroll', async t => {
  const app = await loadApp(t);
  app.window.dispatchEvent(new Event('popstate'));
  app.window.dispatchEvent(new Event('hashchange'));
  app.flushFrames();
  assert.equal(app.document.activeElement, undefined);
  assert.deepEqual(app.scrollCalls, []);
});

test('a noncancelable cancel restores once and leaves the next dialog usable', async t => {
  const app = await loadApp(t);
  app.click('open-career-interview');
  assert.equal(app.cancel(false).defaultPrevented, false);
  assert.equal(app.dialog.open, false);
  app.flushCloseEvents();
  assert.equal(app.pendingBacks, 1);
  app.flushHistory();
  assert.equal(app.location.hash, '');
  assertOpenerRestoredOnce(app);
  assertReopenedDialogWorks(app);
});

test('native close without cancel synchronizes the URL and restores once', async t => {
  const app = await loadApp(t);
  app.click('open-career-interview');
  app.dialog.close();
  app.flushCloseEvents();
  assert.equal(app.pendingBacks, 1);
  app.flushHistory();
  assert.equal(app.location.hash, '');
  assertOpenerRestoredOnce(app);
  assertReopenedDialogWorks(app);
});

test('repeated cancel requests issue only one Back and reset the closing state', async t => {
  const app = await loadApp(t);
  app.click('open-career-interview');
  assert.equal(app.cancel(true).defaultPrevented, true);
  assert.equal(app.dialog.open, true);
  app.cancel(false);
  app.flushCloseEvents();
  assert.equal(app.pendingBacks, 1);
  app.flushHistory();
  assertOpenerRestoredOnce(app);
  assertReopenedDialogWorks(app);
});

test('an old queued close event cannot close a newly reopened dialog', async t => {
  const app = await loadApp(t);
  app.click('open-career-interview');
  app.click('close-sample');
  app.flushHistory();
  assertOpenerRestoredOnce(app);
  app.click('open-newgrad-card');
  app.flushCloseEvents();
  assert.equal(app.dialog.open, true);
  assert.equal(app.location.hash, '#sample/newgrad/direction');
  assert.equal(app.pendingBacks, 0);
  app.click('tab-documents');
  assert.equal(app.location.hash, '#sample/newgrad/documents');
});

test('native close on a direct sample URL uses the on-site fallback once', async t => {
  const app = await loadApp(t, '#sample/career/interview');
  app.dialog.close();
  app.flushCloseEvents();
  app.flushFrames();
  assert.equal(app.location.hash, '#examples');
  assert.equal(app.pendingBacks, 0);
  assert.equal(app.history.length, 2);
  assert.equal(app.document.activeElement, app.elements.get('examples-title'));
  assert.equal(app.elements.get('examples-title').focusCount, 1);
  assert.equal(app.elements.get('examples').scrollIntoViewCount, 1);
});

test('noncancelable cancel on a direct sample URL stays on-site and restores once', async t => {
  const app = await loadApp(t, '#sample/newgrad/documents');
  assert.equal(app.cancel(false).defaultPrevented, false);
  app.flushCloseEvents();
  app.flushFrames();
  assert.equal(app.dialog.open, false);
  assert.equal(app.location.hash, '#examples');
  assert.equal(app.pendingBacks, 0);
  assert.equal(app.history.length, 2);
  assert.equal(app.document.activeElement, app.elements.get('examples-title'));
  assert.equal(app.elements.get('examples-title').focusCount, 1);
  assert.equal(app.elements.get('examples').scrollIntoViewCount, 1);
});
