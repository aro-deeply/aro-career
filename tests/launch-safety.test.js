import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../launch/'+path,import.meta.url),'utf8');
const html=read('index.html');
const app=read('app.js');
const content=read('content.js');
test('운영 중인 서비스로 오인시키는 공개 전·미접수 문구 없이 가상 사례를 고지한다',()=>{
 assert.doesNotMatch(html,/noindex, nofollow/);
 assert.match(html,/인물·공고·답변은 서비스 설명을 위한 가상/);
 assert.doesNotMatch(html,/공개 전 검토본|서비스 제안안|공개 전 검토 화면|실제 접수 없음|실제 접수·예약·결제는 진행하지 않습니다/);
 assert.doesNotMatch(html,/기존 AI 진단|기존 엔진/);
});
test('문의 화면은 필요한 세 가지 선택만 받고 파일·자유 입력은 받지 않는다',()=>{
 assert.doesNotMatch(html,/<input\b/i);
 assert.match(html,/<textarea[^>]+readonly/);
 assert.equal([...html.matchAll(/<select\b/g)].length,3);
 assert.match(html,/<form[^>]+id="inquiry-form"/);
});
test('선택한 문의를 메일 앱으로 전달하며 브라우저에 저장·추적하지 않는다',()=>{
 assert.doesNotMatch(app,/\b(fetch|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|indexedDB)\b/);
 assert.match(html,/mailto:aro\.deeply@gmail\.com/);
 assert.match(app,/mailto:aro\.deeply@gmail\.com\?subject=/);
 assert.match(app,/encodeURIComponent\(draft\.value\)/);
 const externalLinks=[...html.matchAll(/href="(https?:\/\/[^" ]+)"/g)].map(match=>match[1]);
 assert.ok(externalLinks.length>0);
 assert.ok(externalLinks.every(url=>url==='https://aro-career.vercel.app/diagnosis'));
 assert.doesNotMatch(html,/<(?:script|iframe)[^>]+src="https?:/);
 assert.doesNotMatch(html,/\baction="/);
});
test('전체 가상 샘플은 신입·경력 PDF만 연결하고 내부 사업 문서는 제외한다',()=>{
 const sampleLinks=[...html.matchAll(/href="(\.\/samples\/[^" ]+)"/g)].map(match=>match[1]);
 assert.deepEqual(sampleLinks,['./samples/newgrad.pdf','./samples/career.pdf']);
 assert.doesNotMatch(html,/business\.pdf|a-z-blueprint|delivery-pilot/);
});
test('승인 전 가격·검증되지 않은 실적을 고객 화면에 넣지 않는다',()=>{
 assert.doesNotMatch(html+content,/36만|21만|150건|1,000회|1000회|상담심리학|15년/);
 assert.match(html,/약 16년간 기업 HR/);
});

test('전체 샘플과 서비스 경계를 구분하고 사람이 직접 하는 상담임을 첫 화면에 설명한다',()=>{
 const hero=html.slice(html.indexOf('class="hero-copy"'),html.indexOf('class="hero-sample"'));
 assert.match(hero,/취업·면접 컨설팅/);
 assert.match(hero,/직접/);
 assert.match(html,/서류 준비와 별도 면접 연습을 함께 담은 샘플/);
 assert.match(html,/모의면접·재연습은 별도/);
 assert.doesNotMatch(html,/초안이나 일반적인 피드백만/);
 assert.match(html,/class="hero-sample" role="group"/);
});

test('최종 문서의 본인 확인과 직접 제출을 안내한다',()=>{
 assert.match(html,/본인이 사실·표현/);
 assert.match(html,/작성·AI 이용 규정/);
 assert.match(html,/직접 제출/);
 assert.match(html,/<span lang="en">deeply human<\/span>/);
});

test('정적 화면의 세 원진술도 데이터 원진술과 동일하다',async()=>{
 const {CASES}=await import('../launch/content.js');
 const quotes=[...html.matchAll(/<(?:p|h3)[^>]*data-case-quote="(newgrad|career)"[^>]*>(.*?)<\/(?:p|h3)>/g)];
 assert.equal(quotes.length,3);
 for(const [,id,text] of quotes) assert.equal(text.replace(/<br\s*\/?>/g,' '),CASES[id].before);
});

test('공공 대안·공고 미정·AI 보조 범위를 정확히 안내한다',()=>{
 assert.match(html,/자기소개서 첨삭과 모의면접/);
 assert.match(html,/공고가 아직 없다면.*진행 가능 여부/);
 assert.match(html,/상담에서 자료 처리나 도구 활용이 필요한 경우에는 진행 전에 목적과 방식을 안내/);
 assert.doesNotMatch(html,/자료 정리와 초안 작성/);
});

test('화면 높이가 작을 때 고정 머리글이 본문을 가리지 않는다',()=>{
 const css=read('style.css');
 assert.match(css,/@media\(max-height:500px\)\{\.dialog-sticky\{position:static\}/);
});
test('모션 감소와 명시적 키보드 초점을 지원한다',()=>{
 const css=read('style.css');
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/:focus-visible/);
 assert.match(html,/role="tablist"/);
 assert.match(html,/role="tabpanel"/);
});
