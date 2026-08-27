// 스트리밍 미리보기 추출 테스트.
// 스트리밍 중 도착한 미완성 JSON 텍스트에서 "완성된" 문자열 필드만 추출해야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractStreamPreview } from "../src/diagnosis/stream-preview.js";

test("빈 텍스트면 아무 필드도 없음", () => {
  assert.deepEqual(extractStreamPreview(""), { keyVerdict: null, rootDiagnosis: null });
});

test("필드가 아직 안 나왔으면 null", () => {
  const partial = '{"root_cause":"pattern_02","dominant_pattern":"pattern_02","key_verd';
  assert.deepEqual(extractStreamPreview(partial), { keyVerdict: null, rootDiagnosis: null });
});

test("값이 절반만 도착한 필드는 추출하지 않는다", () => {
  const partial = '{"root_cause":"pattern_02","key_verdict":"근거 없는 주장이 반복되';
  assert.equal(extractStreamPreview(partial).keyVerdict, null);
});

test("닫는 따옴표까지 도착한 필드는 추출한다", () => {
  const partial =
    '{"root_cause":"pattern_02","key_verdict":"근거 없는 주장이 서류 탈락의 핵심 원인입니다.","root_diag';
  const p = extractStreamPreview(partial);
  assert.equal(p.keyVerdict, "근거 없는 주장이 서류 탈락의 핵심 원인입니다.");
  assert.equal(p.rootDiagnosis, null);
});

test("이스케이프된 따옴표·줄바꿈을 올바르게 해석한다", () => {
  const partial =
    '{"key_verdict":"\\"귀사\\" 호칭이 문제입니다.","root_diagnosis":"첫째 줄.\\n둘째 줄."}';
  const p = extractStreamPreview(partial);
  assert.equal(p.keyVerdict, '"귀사" 호칭이 문제입니다.');
  assert.equal(p.rootDiagnosis, "첫째 줄.\n둘째 줄.");
});

test("root_diagnosis의 볼드 마커(**)는 제거된다", () => {
  const partial = '{"root_diagnosis":"**핵심 구문**이 강조된 진단입니다."}';
  assert.equal(extractStreamPreview(partial).rootDiagnosis, "핵심 구문이 강조된 진단입니다.");
});

test("```json 코드펜스로 감싸인 출력도 처리한다", () => {
  const partial = '```json\n{"key_verdict":"판정 문장입니다."';
  assert.equal(extractStreamPreview(partial).keyVerdict, "판정 문장입니다.");
});
