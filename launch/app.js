import {CASES} from './content.js';
import {parseSampleRoute, STEP_IDS, buildInquiryDraft, getTabTarget} from './flow.js';
import {createSampleNavigation, isPlainPrimaryClick} from './navigation.js';

const dialog = document.querySelector('#sample-dialog');
const panel = document.querySelector('#sample-panel');
const tabs = [...document.querySelectorAll('[data-step]')];
const sampleNavigation = createSampleNavigation({history, location});
let lastOpener = null;
let returnScrollY = 0;
let currentRoute = null;
let focusPanelAfterNavigation = false;
let closingSample = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function renderSample(route) {
  const data = CASES[route.caseId];
  const step = data.steps[route.stepId];
  const index = STEP_IDS.indexOf(route.stepId);
  document.querySelector('#sample-tag').textContent = data.tag;
  document.querySelector('#sample-scope').textContent = route.stepId === 'interview'
    ? '별도 면접 과정 · 답변 연습 예시'
    : '지원 전략·서류 완성 과정의 결과 예시';
  document.querySelector('#sample-overline').textContent = data.before;
  document.querySelector('#sample-title').textContent = step.title;
  document.querySelector('#sample-lead').textContent = step.lead;
  document.querySelector('#sample-note').textContent = step.note;
  document.querySelector('#sample-blocks').innerHTML = step.blocks.map(block =>
    `<section class="result-block"><h3>${escapeHtml(block.label)}</h3><p>${escapeHtml(block.text)}</p></section>`
  ).join('');
  for (const tab of tabs) {
    const active = tab.dataset.step === route.stepId;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
  }
  panel.setAttribute('aria-labelledby', `tab-${route.stepId}`);
  document.querySelector('#previous-step').disabled = index === 0;
  const next = document.querySelector('#next-step');
  next.textContent = index === STEP_IDS.length - 1 ? '예시 닫기' : '다음 결과물 →';
  dialog.scrollTop = 0;
}

function syncSampleWithUrl() {
  const hadSampleRoute = currentRoute !== null;
  const route = parseSampleRoute(location.hash);
  currentRoute = route;
  if (route) {
    const opening = !dialog.open;
    renderSample(route);
    if (opening) {
      rememberSampleReturnTarget();
      dialog.showModal();
    }
    if (focusPanelAfterNavigation) {
      panel.focus({preventScroll:true});
      focusPanelAfterNavigation = false;
    }
  } else {
    closingSample = false;
    focusPanelAfterNavigation = false;
    if (dialog.open) dialog.close();
    if (hadSampleRoute) restoreSampleOpener();
  }
}

function rememberSampleReturnTarget() {
  const context = sampleNavigation.getReturnContext();
  const opener = context ? document.getElementById(context.openerId) : null;
  lastOpener = opener?.matches('[data-open-sample]') && parseSampleRoute(opener.getAttribute('href')) ? opener : null;
  returnScrollY = lastOpener ? context.scrollY : 0;
}

function restoreSampleOpener() {
  const opener = lastOpener?.isConnected ? lastOpener : null;
  (opener || document.querySelector('#examples-title')).focus({preventScroll:true});
  requestAnimationFrame(() => {
    if (dialog.open) return;
    if (opener) window.scrollTo({top:returnScrollY,behavior:'instant'});
    else if (location.hash === '#examples') document.querySelector('#examples').scrollIntoView({behavior:'instant'});
  });
}

function closeSample() {
  if (closingSample) return;
  closingSample = sampleNavigation.close() === 'back';
  if (!closingSample) syncSampleWithUrl();
}

function navigateSampleStep(stepId) {
  if (!closingSample && sampleNavigation.changeStep(stepId)) syncSampleWithUrl();
}

document.addEventListener('click', event => {
  const opener = event.target.closest('[data-open-sample]');
  if (opener && isPlainPrimaryClick(event) &&
      (!opener.target || opener.target === '_self') && !opener.hasAttribute('download') &&
      parseSampleRoute(opener.getAttribute('href'))) {
    event.preventDefault();
    sampleNavigation.open(opener.getAttribute('href'), {openerId: opener.id, scrollY: window.scrollY});
    syncSampleWithUrl();
  }
  const service = event.target.closest('[data-service]');
  if (service) {
    document.querySelector('#service').value = service.dataset.service;
    clearInquiryResult();
  }
});

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => navigateSampleStep(tab.dataset.step));
  tab.addEventListener('keydown', event => {
    const target = getTabTarget(index, event.key, tabs.length);
    if (target === null) return;
    event.preventDefault();
    tabs[target].focus();
    navigateSampleStep(tabs[target].dataset.step);
  });
});

document.querySelector('#close-sample').addEventListener('click', closeSample);
dialog.addEventListener('cancel', event => {event.preventDefault();closeSample();});
dialog.addEventListener('close', () => {
  if (!dialog.open && parseSampleRoute(location.hash)) closeSample();
});
document.querySelector('#previous-step').addEventListener('click', () => {
  if (!currentRoute) return;
  const index = STEP_IDS.indexOf(currentRoute.stepId);
  if (index > 0) {
    focusPanelAfterNavigation = true;
    navigateSampleStep(STEP_IDS[index - 1]);
  }
});
document.querySelector('#next-step').addEventListener('click', () => {
  if (!currentRoute) return;
  const index = STEP_IDS.indexOf(currentRoute.stepId);
  if (index === STEP_IDS.length - 1) closeSample();
  else {
    focusPanelAfterNavigation = true;
    navigateSampleStep(STEP_IDS[index + 1]);
  }
});
window.addEventListener('hashchange', syncSampleWithUrl);
window.addEventListener('popstate', syncSampleWithUrl);
document.querySelector('#examples-title').tabIndex = -1;
syncSampleWithUrl();

const form = document.querySelector('#inquiry-form');
const draft = document.querySelector('#draft-text');
const result = document.querySelector('#draft-result');
const formStatus = document.querySelector('#form-status');
const copyStatus = document.querySelector('#copy-status');
const emailInquiry = document.querySelector('#email-inquiry');
form.hidden = false;

function clearInquiryResult() {
  result.hidden = true;
  draft.value = '';
  formStatus.textContent = '';
  copyStatus.textContent = '';
}

form.addEventListener('change', clearInquiryResult);
form.addEventListener('reset', () => {
  clearInquiryResult();
  document.querySelector('#service').focus();
});
form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    draft.value = buildInquiryDraft(Object.fromEntries(new FormData(form)));
    emailInquiry.href = `mailto:aro.deeply@gmail.com?subject=${encodeURIComponent('ARO 상담 문의')}&body=${encodeURIComponent(draft.value)}`;
    result.hidden = false;
    formStatus.textContent = '문의 내용을 정리했습니다. 메일 앱에서 내용을 확인한 뒤 보내주세요.';
    copyStatus.textContent = '';
    draft.focus();
  } catch (error) {
    clearInquiryResult();
    formStatus.textContent = error.message;
  }
});
document.querySelector('#copy-draft').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(draft.value);
    copyStatus.textContent = '복사했습니다. 이메일이나 문의 메시지에 붙여넣어 보내주세요.';
  } catch {
    draft.focus();
    draft.select();
    copyStatus.textContent = '자동 복사가 허용되지 않았습니다. 선택된 내용을 Ctrl+C 또는 기기의 복사 메뉴로 복사해 주세요.';
  }
});
