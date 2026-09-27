export const CASE_IDS = ['newgrad', 'career'];
export const STEP_IDS = ['direction', 'documents', 'interview', 'reuse'];

export function parseSampleRoute(hash) {
  if (typeof hash !== 'string') return null;
  const parts = hash.split('/');
  if (parts.length !== 3 || parts[0] !== '#sample') return null;
  const [, caseId, stepId] = parts;
  return CASE_IDS.includes(caseId) && STEP_IDS.includes(stepId) ? {caseId, stepId} : null;
}

export function sampleHash(caseId, stepId) {
  if (!CASE_IDS.includes(caseId) || !STEP_IDS.includes(stepId)) throw new Error('알 수 없는 예시입니다.');
  return `#sample/${caseId}/${stepId}`;
}

const SERVICES = {strategy:'지원 전략·서류 완성', interview:'면접 연습', unsure:'필요한 상담 범위부터 확인'};
const STAGES = {search:'지원할 공고를 찾고 있습니다', documents:'지원 공고가 있고 서류를 준비 중입니다', interview:'면접을 앞두고 있습니다'};
const TIMINGS = {soon:'1주 이내', weeks:'2~3주 이내', flexible:'일정 협의 가능'};

export function buildInquiryDraft({service, stage, timing} = {}) {
  if (![ [SERVICES,service],[STAGES,stage],[TIMINGS,timing] ].every(([map,key])=>Object.hasOwn(map,key))) {
    throw new Error('세 가지 항목을 모두 선택해 주세요.');
  }
  return `ARO 상담 문의\n\n필요한 도움: ${SERVICES[service]}\n현재 상황: ${STAGES[stage]}\n희망 준비 시점: ${TIMINGS[timing]}\n\n평일 저녁 또는 주말 상담을 희망합니다. 가능한 일정과 진행 범위, 비용을 안내받고 싶습니다.`;
}

export function getTabTarget(index, key, count) {
  if (key === 'ArrowRight') return (index + 1) % count;
  if (key === 'ArrowLeft') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

export function getSectionHash(hash) {
  return ['', '#top', '#examples', '#interview', '#services', '#about', '#prepare', '#preview-note', '#main'].includes(hash) ? hash : '#examples';
}
