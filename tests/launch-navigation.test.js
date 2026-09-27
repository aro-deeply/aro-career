import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSampleRoute} from '../launch/flow.js';
import {createSampleNavigation, isPlainPrimaryClick} from '../launch/navigation.js';

function createBrowser(hash = '#interview', state = null) {
  const entries = [
    {url: new URL('https://previous.test/'), state: null},
    {url: new URL(`https://aro.test/launch/?preview=1${hash}`), state},
  ];
  let index = entries.length - 1;
  const location = Object.fromEntries(['hash', 'pathname', 'search'].map(key => [key, '']));
  for (const key of Object.keys(location)) {
    Object.defineProperty(location, key, {get: () => entries[index].url[key]});
  }
  const history = {
    get length() { return entries.length; },
    get state() { return entries[index].state; },
    pushState(nextState, unused, url) {
      entries.splice(index + 1, entries.length, {url: new URL(url, entries[index].url), state: structuredClone(nextState)});
      index += 1;
    },
    replaceState(nextState, unused, url) {
      entries[index] = {url: new URL(url, entries[index].url), state: structuredClone(nextState)};
    },
    back() { if (index > 0) index -= 1; },
    forward() { if (index + 1 < entries.length) index += 1; },
  };
  return {history, location, get url() { return entries[index].url.href; }};
}

function navigationFor(browser) {
  return createSampleNavigation(browser);
}

test('opening a sample adds one entry and changing steps replaces that entry', () => {
  const browser = createBrowser();
  const navigation = navigationFor(browser);
  assert.equal(navigation.open('#sample/career/direction'), true);
  assert.equal(browser.history.length, 3);
  assert.equal(browser.url, 'https://aro.test/launch/?preview=1#sample/career/direction');
  navigation.changeStep('documents');
  navigation.changeStep('interview');
  navigation.changeStep('reuse');
  assert.equal(browser.history.length, 3);
  assert.equal(browser.location.hash, '#sample/career/reuse');
});

test('browser Back closes in one step and Forward restores the last step', () => {
  const browser = createBrowser('#services');
  const navigation = navigationFor(browser);
  navigation.open('#sample/newgrad/direction');
  navigation.changeStep('interview');
  browser.history.back();
  assert.equal(browser.location.hash, '#services');
  assert.equal(parseSampleRoute(browser.location.hash), null);
  browser.history.forward();
  assert.deepEqual(parseSampleRoute(browser.location.hash), {caseId: 'newgrad', stepId: 'interview'});
});

test('closing a managed sample traverses to its original page without another entry', () => {
  const browser = createBrowser('');
  const navigation = navigationFor(browser);
  navigation.open('#sample/career/documents');
  navigation.changeStep('reuse');
  assert.equal(navigation.close(), 'back');
  assert.equal(browser.location.hash, '');
  assert.equal(browser.history.length, 3);
  browser.history.forward();
  assert.equal(browser.location.hash, '#sample/career/reuse');
});

test('a directly opened sample closes to examples without leaving the site', () => {
  const browser = createBrowser('#sample/newgrad/interview');
  const navigation = navigationFor(browser);
  navigation.changeStep('reuse');
  assert.equal(navigation.close(), 'fallback');
  assert.equal(browser.url, 'https://aro.test/launch/?preview=1#examples');
  assert.equal(browser.history.length, 2);
});

test('reloading a managed sample retains its safe same-page Back destination', () => {
  const browser = createBrowser('#top');
  navigationFor(browser).open('#sample/career/direction');
  const reloadedNavigation = navigationFor(browser);
  reloadedNavigation.changeStep('interview');
  assert.equal(reloadedNavigation.close(), 'back');
  assert.equal(browser.location.hash, '#top');
  assert.equal(browser.history.length, 3);
});

test('a copied sample URL without history context always uses the on-site fallback', () => {
  const original = createBrowser();
  navigationFor(original).open('#sample/career/direction');
  const newTab = createBrowser(original.location.hash);
  assert.equal(navigationFor(newTab).close(), 'fallback');
  assert.equal(newTab.location.hash, '#examples');
});

test('unrelated or stale history context cannot authorize Back to an external page', () => {
  const original = createBrowser();
  navigationFor(original).open('#sample/career/direction');
  const stale = createBrowser('#sample/career/reuse', original.history.state);
  assert.equal(navigationFor(stale).close(), 'fallback');
  assert.equal(stale.location.hash, '#examples');
  const unrelated = createBrowser('#sample/career/reuse', {otherFeature: 'keep'});
  assert.equal(navigationFor(unrelated).close(), 'fallback');
  assert.deepEqual(unrelated.history.state, {otherFeature: 'keep'});
});

test('changing samples while the dialog is already open does not add entries', () => {
  const browser = createBrowser();
  const navigation = navigationFor(browser);
  navigation.open('#sample/newgrad/direction');
  navigation.open('#sample/career/documents');
  assert.equal(browser.history.length, 3);
  assert.equal(navigation.close(), 'back');
  assert.equal(browser.location.hash, '#interview');
});

test('invalid routes are rejected without altering browser history', () => {
  const browser = createBrowser();
  const navigation = navigationFor(browser);
  for (const hash of ['#sample/fake/direction', '#sample/career/missing', '#sample/career/reuse/extra', '#untrusted']) {
    assert.equal(navigation.open(hash), false);
  }
  assert.equal(navigation.changeStep('documents'), false);
  assert.equal(navigation.close(), null);
  assert.equal(browser.history.length, 2);
  assert.equal(browser.location.hash, '#interview');
  navigation.open('#sample/career/direction');
  assert.throws(() => navigation.changeStep('missing'));
  assert.equal(browser.location.hash, '#sample/career/direction');
});

test('only unmodified primary clicks are handled in the current tab', () => {
  const normal = {button: 0, defaultPrevented: false, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false};
  assert.equal(isPlainPrimaryClick(normal), true);
  for (const key of ['defaultPrevented', 'ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
    assert.equal(isPlainPrimaryClick({...normal, [key]: true}), false);
  }
  for (const button of [1, 2]) assert.equal(isPlainPrimaryClick({...normal, button}), false);
});

test('reload preserves the original opener and scroll through step changes and Forward', () => {
  const browser = createBrowser('');
  const returnContext = {openerId: 'open-career-interview', scrollY: 1834.5};
  navigationFor(browser).open('#sample/career/interview', returnContext);
  const reloadedNavigation = navigationFor(browser);
  assert.deepEqual(reloadedNavigation.getReturnContext?.(), returnContext);
  reloadedNavigation.changeStep('reuse');
  assert.deepEqual(reloadedNavigation.getReturnContext(), returnContext);
  assert.equal(reloadedNavigation.close(), 'back');
  assert.equal(browser.location.hash, '');
  assert.equal(reloadedNavigation.getReturnContext(), null);
  browser.history.forward();
  assert.deepEqual(reloadedNavigation.getReturnContext(), returnContext);
  assert.equal(browser.location.hash, '#sample/career/reuse');
  assert.equal(browser.history.length, 3);
});

test('all six known opener IDs allow a zero scroll position', () => {
  const openerRoutes = {
    'open-newgrad-direction': '#sample/newgrad/direction',
    'open-newgrad-documents': '#sample/newgrad/documents',
    'open-newgrad-interview': '#sample/newgrad/interview',
    'open-newgrad-card': '#sample/newgrad/direction',
    'open-career-card': '#sample/career/direction',
    'open-career-interview': '#sample/career/interview',
  };
  for (const [openerId, route] of Object.entries(openerRoutes)) {
    const browser = createBrowser('');
    const navigation = navigationFor(browser);
    navigation.open(route, {openerId, scrollY: 0});
    assert.deepEqual(navigation.getReturnContext?.(), {openerId, scrollY: 0});
  }
});

test('unknown opener IDs and invalid scroll values are not stored or restored', () => {
  const invalidContexts = [
    {openerId: 'customer-name', scrollY: 10},
    {openerId: '#open-career-card', scrollY: 10},
    ...[-1, Infinity, NaN, '100', null, undefined].map(scrollY => ({openerId: 'open-career-card', scrollY})),
  ];
  for (const context of invalidContexts) {
    const browser = createBrowser('');
    const navigation = navigationFor(browser);
    navigation.open('#sample/career/direction', context);
    assert.equal(navigation.getReturnContext?.(), null);
    assert.equal(Object.hasOwn(browser.history.state.aroSample, 'openerId'), false);
    assert.equal(Object.hasOwn(browser.history.state.aroSample, 'scrollY'), false);
    assert.equal(navigation.close(), 'back');
  }
});

test('restoring history revalidates opener metadata and exposes no other state fields', () => {
  const browser = createBrowser('');
  const navigation = navigationFor(browser);
  navigation.open('#sample/career/direction', {openerId: 'open-career-card', scrollY: 210, name: 'not stored'});
  assert.deepEqual(navigation.getReturnContext?.(), {openerId: 'open-career-card', scrollY: 210});
  assert.equal(Object.hasOwn(browser.history.state.aroSample, 'name'), false);
  browser.history.state.aroSample.openerId = 'not-an-opener';
  assert.equal(navigationFor(browser).getReturnContext(), null);
  browser.history.state.aroSample.openerId = 'open-career-card';
  browser.history.state.aroSample.scrollY = -5;
  assert.equal(navigationFor(browser).getReturnContext(), null);
  const direct = navigationFor(createBrowser('#sample/career/direction'));
  assert.equal(direct.getReturnContext(), null);
});
