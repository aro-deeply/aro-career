// Splits a broad description of work into candidate tasks the user can pick from.
// Surface cues only: punctuation, ordering words and a short list of work nouns. Never a semantic claim.
const hasText = value => typeof value === 'string' && Boolean(value.trim());

// Surface cues suggest editable scopes; they never assert semantic task boundaries.
const WORK_CUES = [
  ['people', /팀장\s*대행|팀원(?:들)?\s*관리|인력\s*관리|팀\s*관리/gu],
  ['recruiting', /채용(?:\s*(?:운영|관리))?/gu],
  ['interview', /면접관|면접(?:\s*(?:일정\s*조율|준비|진행|운영))?/gu],
  ['executive', /(?:대표님|임원)[^.,\n]{0,35}?(?:하달|지시)[^.,\n]{0,10}?(?:업무|일들?)/gu],
  ['evaluation', /(?:인사\s*)?평가(?:\s*(?:운영|관리))?/gu],
  ['payroll', /인건비(?:\s*관리)?|급여(?:\s*(?:정산|관리))?/gu],
  ['ordering', /발주(?:\s*(?:관리|처리))?/gu],
  ['inventory', /재고\s*(?:확인|관리|조사)/gu],
  ['settlement', /거래처\s*정산|대금\s*정산/gu],
];
const clean = text => text.replace(/^\s*(?:[-*•]|\d+[.)])\s*/u, '').trim();
// A candidate name drops the sentence ending around it: "거래처 정산을 맡았어요." → "거래처 정산".
const taskName = text => clean(text).replace(/\s*(?:을|를)?\s*(?:맡았|담당했|진행했|했었|했)[가-힣]*[.!]?$/u, '').replace(/[.!]+$/u, '').trim() || clean(text);
export function hasSequenceCues(text) { return /→|->|먼저|그다음|다음으로|마지막으로|한\s*뒤|한\s*후|확인해|받아.*(?:안내|조율)/u.test(text); }
export function hasEpisodeCues(text) { return /지난(?:주|달|번)|어느\s*날|한\s*번은|한번은|당시|그때|\d{1,2}월\s*\d{1,2}일/u.test(text); }
function cueMatches(text) {
  const found = WORK_CUES.flatMap(([kind, pattern]) => [...text.matchAll(pattern)].map(m => ({kind, text:m[0], start:m.index, end:m.index+m[0].length})));
  const sorted=found.sort((a,b)=>a.start-b.start);
  return sorted.filter((item,index,list)=>list.findIndex(other=>other.kind===item.kind)===index).map(item=>{
    const same=sorted.filter(other=>other.kind===item.kind);
    const titles=[...new Set(same.map(other=>other.text))];
    const title=item.kind==='interview'&&titles.includes('면접관')?'면접관 참여':titles.join(' · ');
    return {...item,text:title};
  });
}
function literalParts(text) { return text.split(/[\n,，;；·]+/u).map(clean).filter(Boolean); }
function candidatesFromCues(text, matches) {
  const starts=matches.map(match=>{
    const prefix=text.slice(0,match.start), boundary=Math.max(prefix.lastIndexOf(','),prefix.lastIndexOf('.'),prefix.lastIndexOf('\n'))+1;
    return match.start-boundary<9?boundary:match.start;
  });
  return matches.map((match,index) => ({id:'candidate-'+(index+1),title:match.text,
    evidence:text.slice(starts[index],starts[index+1]??text.length).replace(/[\s,，;；·]+$/u,'').trim(),origin:'surface-cue'}));
}
export function proposeScopes(text) {
  const value = text.trim(), matches=cueMatches(value), parts=literalParts(value);
  const sequence=hasSequenceCues(value), episode=hasEpisodeCues(value);
  // Explicit ordering may describe one workflow, even if it mentions several activities.
  if (sequence) return {kind:'process',reason:'순서를 나타내는 표현이 있어 한 업무의 과정으로 먼저 이어가요. 범위는 바꿀 수 있어요.',candidates:[{id:'whole',title:value,evidence:value,origin:'whole'}]};
  if(matches.length>1) return {kind:'candidates',reason:'입력에 있는 업무 표현으로 만든 잠정 후보예요. 한 업무의 과정이면 묶어주세요.',candidates:candidatesFromCues(value,matches)};
  if(episode) return {kind:'episode',reason:'특정한 때를 적은 원문을 먼저 보관해요. 사건이나 업무의 의미를 분석한 결과는 아니에요.',candidates:[{id:'whole',title:value,evidence:value,origin:'whole'}]};
  if(parts.length>1) {
    const taskEnds=/관리|운영|조율|정리|작성|안내|확인|대응|정산|준비|게시|발주|교육|면접|평가|계획|검토|분석|설계|개발|발송|접수|판매|상담/u;
    return {kind:parts.every(p=>taskEnds.test(p))?'candidates':'uncertain',reason:'구분 표시로 나눈 잠정 후보예요. 서로 다른 업무인지, 한 업무의 순서인지 확인해 주세요.',candidates:parts.map((p,i)=>({id:'candidate-'+(i+1),title:taskName(p),evidence:p,origin:'delimiter'}))};
  }
  if(/하고|했고|했으며|하며|여러\s*(?:업무|일)|이것저것|전반적인|^(?:인사|운영|관리|총무)\s*(?:업무|일)[.!]?$/u.test(value)) {
    return {kind:'uncertain',reason:'업무 경계를 확실히 나누기 어려워 원문을 그대로 두었어요. 이대로 한 업무로 다루거나 이름만 좁혀주세요.',candidates:[{id:'whole',title:value,evidence:value,origin:'whole'}]};
  }
  return {kind:'single',reason:'',candidates:[{id:'whole',title:value,evidence:value,origin:'whole'}]};
}
export function processParts(text) {
  const parts=text.split(/\n|→|->|(?:그다음|다음으로|마지막으로)\s*/u).map(clean).filter(Boolean);
  return [...new Set(parts.length>1?parts:[text.trim()])];
}
