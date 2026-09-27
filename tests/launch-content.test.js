import test from 'node:test';
import assert from 'node:assert/strict';
import {CASES} from '../launch/content.js';
import {CASE_IDS, STEP_IDS} from '../launch/flow.js';

test('신입·경력 모두 지원 판단부터 다른 공고에 적용까지 제공한다',()=>{
 assert.deepEqual(Object.keys(CASES),CASE_IDS);
 for(const data of Object.values(CASES)) {
  assert.equal(data.fictional,true);
  assert.deepEqual(Object.keys(data.steps),STEP_IDS);
  for(const step of Object.values(data.steps)) {
   assert.ok(step.title && step.lead && step.blocks.length>=2);
   for(const block of step.blocks) assert.ok(block.label && block.text && block.sources?.length);
  }
 }
});
test('신입은 실제 자소서 본문, 경력은 경력기술서 본문을 제시한다',()=>{
 assert.match(CASES.newgrad.steps.documents.blocks.map(x=>x.label).join(' '),/자기소개서/);
 assert.match(CASES.career.steps.documents.blocks.map(x=>x.label).join(' '),/경력기술서/);
 for(const data of Object.values(CASES))assert.ok(data.steps.documents.blocks.some(x=>x.text.length>200));
});
test('면접 재연습을 성공 실적으로 제시하지 않고 남은 과제를 명시한다',()=>{
 for(const data of Object.values(CASES)) {
  assert.match(data.steps.interview.note,/가상/);
  assert.ok(data.steps.interview.blocks.some(x=>x.label.includes('남은 과제')));
 }
});
test('다음 공고의 미확인 요건은 갖춘 능력처럼 쓰지 않는다',()=>{
 assert.match(JSON.stringify(CASES.newgrad.steps.reuse),/조회함수/);
 assert.match(JSON.stringify(CASES.career.steps.reuse),/SQL/);
 assert.match(JSON.stringify(CASES.career.steps.reuse),/확인/);
});

test('신입은 자료 정리 공고의 비교표 중심에서 행사 공고의 신청 관리 중심으로 바뀐다',()=>{
 const first=CASES.newgrad.steps.direction.blocks;
 assert.match(first[0].text,/수업.*비교표/);
 assert.ok(first[0].sources.includes('N1'));
 assert.match(first[1].text,/동아리/);
 const next=CASES.newgrad.steps.reuse.blocks;
 assert.match(next[0].text,/동아리/);
 assert.match(next[0].text,/비교표.*뒤/);
 assert.ok(next[0].sources.includes('N8'));
});

test('경력의 다음 지원은 행사 운영용 요약을 제시하면서 SQL 필수요건을 따로 확인한다',()=>{
 const reuse=CASES.career.steps.reuse;
 assert.match(reuse.blocks[0].text,/행사.*먼저/);
 const rewritten=reuse.blocks.find(block=>block.label.includes('바꾼 경력 요약'));
 assert.ok(rewritten);
 assert.match(rewritten.text,/신청.*입금 확인.*참여 확정/);
 assert.match(rewritten.text,/현장 접수 명단/);
 assert.ok(rewritten.sources.includes('E2'));
 assert.match(JSON.stringify(reuse),/SQL.*확인/);
});

test('가상 사례라도 무누락 성과·권한·팀 성과의 개인 독점을 덧붙이지 않는다',()=>{
 assert.doesNotMatch(JSON.stringify(CASES),/빠뜨리지 않고|담당자의 권한으로 두고|주의할 점을 함께 담았습니다/);
 assert.match(JSON.stringify(CASES.newgrad.steps.documents),/발표자료에.*반영됐습니다/);
});

test('원진술 인용은 실제 가상 원자료에 있는 문장만 사용한다',()=>{
 const originals={
  newgrad:'인턴이나 수상 경력은 없습니다. 수업 발표 자료를 만들고 동아리 신청 명단을 정리한 정도예요. 카페 아르바이트도 했습니다.',
  career:'고객 문의 답변, 공지 수정, 행사 접수, 주간 진행표 취합을 했습니다. 반복 업무라 특별한 성과는 없습니다.',
 };
 for(const [id,data] of Object.entries(CASES)) {
  assert.ok(originals[id].includes(data.before.replace(/[“”]/g,'')),id+' 원진술 대조');
  for(const step of Object.values(data.steps)) for(const block of step.blocks) {
   for(const source of block.sources) assert.match(source,id==='newgrad'?/^N[0-9]$/:/^E[0-9]$/);
  }
 }
});

test('다음 지원의 작성 예시와 실제 제공 범위를 구분한다',()=>{
 for(const data of Object.values(CASES)) assert.match(data.steps.reuse.note,/다른 공고의 문서 작성까지 포함.*아닙니다/);
 const newgrad=CASES.newgrad.steps.reuse.blocks;
 assert.match(newgrad[1].text,/보람/);
 assert.doesNotMatch(newgrad[1].text,/입금 상태만/);
 assert.match(newgrad[2].text,/없더라도 지원.*불가.*단정하지/);
 assert.doesNotMatch(CASES.career.steps.documents.blocks[1].text,/정책 결정.*담당자가/);
});
