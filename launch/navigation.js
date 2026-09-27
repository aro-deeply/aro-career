import {getSectionHash, parseSampleRoute, sampleHash} from './flow.js';

const STATE_KEY = 'aroSample';
const OPENER_IDS = new Set([
  'open-newgrad-direction', 'open-newgrad-documents', 'open-newgrad-interview',
  'open-newgrad-card', 'open-career-card', 'open-career-interview',
]);

function validatedReturnContext(context) {
  if (!OPENER_IDS.has(context?.openerId) || !Number.isFinite(context.scrollY) || context.scrollY < 0) return null;
  return {openerId: context.openerId, scrollY: context.scrollY};
}

export function isPlainPrimaryClick(event) {
  return event.button === 0 && !event.defaultPrevented &&
    !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}

export function createSampleNavigation({history, location}) {
  function pageUrl(hash) {
    return `${location.pathname}${location.search}${hash}`;
  }

  function getManagedContext() {
    const context = history.state?.[STATE_KEY];
    return context?.version === 1 && context.page === location.pathname &&
      context.sample === location.hash && parseSampleRoute(context.sample) &&
      typeof context.returnHash === 'string' && getSectionHash(context.returnHash) === context.returnHash
      ? context : null;
  }

  function stateWithoutSampleContext() {
    const {[STATE_KEY]: ignored, ...state} = history.state ?? {};
    return Object.keys(state).length ? state : null;
  }

  function getReturnContext() {
    return validatedReturnContext(getManagedContext());
  }

  function replaceSample(hash) {
    const context = getManagedContext();
    const state = context
      ? {...stateWithoutSampleContext(), [STATE_KEY]: {...context, sample: hash}}
      : stateWithoutSampleContext();
    history.replaceState(state, '', pageUrl(hash));
  }

  function open(hash, returnContext) {
    const route = parseSampleRoute(hash);
    if (!route) return false;
    const targetHash = sampleHash(route.caseId, route.stepId);
    if (parseSampleRoute(location.hash)) {
      replaceSample(targetHash);
    } else {
      const context = {
        version: 1,
        page: location.pathname,
        returnHash: getSectionHash(location.hash),
        sample: targetHash,
        ...validatedReturnContext(returnContext),
      };
      history.pushState({...stateWithoutSampleContext(), [STATE_KEY]: context}, '', pageUrl(targetHash));
    }
    return true;
  }

  function changeStep(stepId) {
    const route = parseSampleRoute(location.hash);
    if (!route) return false;
    replaceSample(sampleHash(route.caseId, stepId));
    return true;
  }

  function close() {
    if (!parseSampleRoute(location.hash)) return null;
    if (getManagedContext() && history.length > 1) {
      history.back();
      return 'back';
    }
    history.replaceState(stateWithoutSampleContext(), '', pageUrl('#examples'));
    return 'fallback';
  }

  return {open, changeStep, close, getReturnContext};
}
