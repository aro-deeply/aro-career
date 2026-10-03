// 이력서 진단 엔진 규칙(api/_diagnose-core.js) 검사. 모든 예시 문장은 가상이다.
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { acceptDiagnosis, quoteIsInResume, buildDiagnoseRequest, buildUserMessage, DIAGNOSE_SCHEMA } from "../api/_diagnose-core.js";
import ResultStep from "../src/diagnosis/ResultStep.jsx";
import { FIXTURE_DIAGNOSIS } from "./_fixtures/diagnosis-fixture.js";

const RESUME = "[가상] 고객센터에서 3년간 상담을 맡았습니다. 환불 규정을 확인해 규정 안의 문의는 직접 처리했습니다. 귀사의 인재상에 부합하는 인재가 되겠습니다.";
const raw = {
  key_verdict: "'귀사'로 끝나 어느 회사에도 낼 수 있는 글이에요",
  root_diagnosis: "Pattern 05 · 회사 이해가 드러나지 않아요.",
  root_cause: "pattern_05",
  pattern_scores: { pattern_01_generic_template: 0.7, pattern_02_unsupported_claims: 1.4, pattern_03_differentiation_mishandling: -1, pattern_04_job_fit_mismatch: 0.5, pattern_05_industry_context_absence: 0.9 },
  evidence: [
    { quote: "귀사의 인재상에 부합하는 인재가 되겠습니다.", pattern: "pattern_05", why: "어느 회사에도 맞는 문장이에요.", fill: "지원 회사에서 직접 확인한 것은 무엇인가요?" },
    { quote: "고객 만족도를 30% 올렸습니다.", pattern: "pattern_02", why: "수치가 있어요.", fill: "무엇을 했나요?" },
    { quote: "  환불 규정을 확인해   규정 안의 문의는 직접 처리했습니다. ", pattern: "pattern_09", why: "범위가 보여요.", fill: "" },
  ],
  interview_questions: [{ question: "왜 우리 회사인가요?", checks: "회사 이해", answer_point: "직접 본 것만 말해 보세요." }],
  plan: { drop: "'귀사'를 지워 보세요.", keep: "환불 처리 경험을 앞세워 보세요.", rebuild: "회사 기준으로 다시 짜 보세요." },
  correctability: "교정 가능",
  next_step_recommendation: "Rewrite",
};

test("a quote must really be in the resume (spacing aside)", () => {
  assert.equal(quoteIsInResume("귀사의 인재상에 부합하는 인재가 되겠습니다.", RESUME), true);
  assert.equal(quoteIsInResume("환불 규정을   확인해", RESUME), true);
  assert.equal(quoteIsInResume("고객 만족도를 30% 올렸습니다.", RESUME), false);
  assert.equal(quoteIsInResume("귀사", RESUME), false, "too short to be a sentence");
});

test("acceptDiagnosis drops invented quotes, clamps scores and fills the fields the consult email reads", () => {
  const r = acceptDiagnosis(raw, { resume: RESUME });
  assert.deepEqual(r.evidence.map(e => e.quote), ["귀사의 인재상에 부합하는 인재가 되겠습니다.", "환불 규정을 확인해 규정 안의 문의는 직접 처리했습니다."]);
  assert.equal(r.dropped_quotes, 1);
  assert.equal(r.evidence[1].pattern, "pattern_05", "an unknown pattern falls back to the root cause");
  assert.equal(r.evidence[0].signal, "업계 맥락 부재");
  assert.equal(r.pattern_scores.pattern_02_unsupported_claims, 1);
  assert.equal(r.pattern_scores.pattern_03_differentiation_mishandling, 0);
  assert.doesNotMatch(r.root_diagnosis, /Pattern/);
  assert.deepEqual(r.self_reflection_questions, ["왜 우리 회사인가요?"]);
  assert.match(r.one_pager_summary, /\*\*버릴 표현\*\*[\s\S]*\n\n\*\*살릴 근거\*\*[\s\S]*\n\n\*\*다시 짤 방향\*\*/);
});

test("the request asks for the report schema and passes the career stage only when it is a known choice", () => {
  const body = buildDiagnoseRequest({ jobTarget: "[가상] 인사", situation: "서류에서 자주 막힘", careerStage: "1~3년차", resume: RESUME });
  assert.equal(body.output_config.format.schema, DIAGNOSE_SCHEMA);
  assert.match(body.messages[0].content, /연차: 1~3년차/);
  assert.match(buildUserMessage({ jobTarget: "x", situation: "y", careerStage: "10년", resume: "z" }), /연차: 모름/);
});

test("the result screen still renders a result in the older format", () => {
  const html = renderToString(React.createElement(ResultStep, { result: FIXTURE_DIAGNOSIS, onReset() {} }));
  assert.match(html, /평가자가 보는 5가지 패턴/);
  assert.match(html, /면접에서 이어질 질문/);
  assert.doesNotMatch(html, /다음에 할 일/, "no plan section without a plan");
});
