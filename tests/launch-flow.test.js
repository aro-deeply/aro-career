import test from 'node:test';
import assert from 'node:assert/strict';
import {parseSampleRoute, sampleHash, buildInquiryDraft, getTabTarget, getSectionHash} from '../launch/flow.js';

test('예시 URL은 사례와 단계로 복원된다',()=>{
 assert.deepEqual(parseSampleRoute('#sample/newgrad/documents'),{caseId:'newgrad',stepId:'documents'});
 assert.deepEqual(parseSampleRoute('#sample/career/interview'),{caseId:'career',stepId:'interview'});
});
test('없는 사례·단계·추가 경로·인코딩 입력은 거절한다',()=>{
 for(const hash of ['', '#examples','#sample/fake/direction','#sample/newgrad/fake','#sample/newgrad/direction/extra','#sample/%3Cscript%3E/documents',null])assert.equal(parseSampleRoute(hash),null);
});
test('예시 경로 생성도 허용목록을 사용한다',()=>{
 assert.equal(sampleHash('career','reuse'),'#sample/career/reuse');
 assert.throws(()=>sampleHash('fake','reuse'));
});
test('문의 준비문은 선택한 서비스·상태·일정만 담는다',()=>{
 const text=buildInquiryDraft({service:'interview',stage:'interview',timing:'flexible'});
 assert.match(text,/면접 연습/);assert.match(text,/면접을 앞두고 있습니다/);
 assert.match(text,/일정 협의 가능/);assert.match(text,/ARO 상담 문의/);
 assert.doesNotMatch(text,/서류 완성 요청/);
});
test('문의 필수값 누락과 임의값은 조용히 수용하지 않는다',()=>{
 for(const values of [{},{service:'interview'},{service:'<script>',stage:'search',timing:'flexible'},{service:'strategy',stage:'fake',timing:'soon'}])assert.throws(()=>buildInquiryDraft(values));
});
test('상담 종류를 모르는 고객도 문의 준비를 할 수 있다',()=>{
 assert.match(buildInquiryDraft({service:'unsure',stage:'search',timing:'flexible'}),/필요한 상담 범위부터/);
});
test('탭 키보드 순환은 양 끝과 Home End를 지원한다',()=>{
 assert.equal(getTabTarget(0,'ArrowLeft',4),3);
 assert.equal(getTabTarget(3,'ArrowRight',4),0);
 assert.equal(getTabTarget(2,'Home',4),0);
 assert.equal(getTabTarget(0,'End',4),3);
 assert.equal(getTabTarget(1,'Tab',4),null);
});
test('예시를 열기 전 첫 화면 주소와 섹션 주소를 보존한다',()=>{
 assert.equal(getSectionHash(''),'');
 assert.equal(getSectionHash('#top'),'#top');
 assert.equal(getSectionHash('#interview'),'#interview');
 assert.equal(getSectionHash('#sample/career/documents'),'#examples');
 assert.equal(getSectionHash('#untrusted'),'#examples');
});

test('문의 메모에서 운영시간은 ARO의 시간이며 고객의 가용시간을 단정하지 않는다',()=>{
 const text=buildInquiryDraft({service:'strategy',stage:'search',timing:'soon'});
 assert.match(text,/평일 저녁 또는 주말 상담을 희망/);
 assert.match(text,/가능한 일정/);
});
