// 경험 정리 엔진(shared/experience)과 서버 로직(api/_experience-core.js) 검사. 모든 예시 문장은 가상이다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { verifyItems, verifyComposedLines, claimIssues } from "../shared/experience/evidence.mjs";
import { analyzeLocally, composeLocally } from "../shared/experience/local-engine.mjs";
import { acceptAnalysis, acceptComposition, checkPayload } from "../shared/experience/ai-contract.mjs";
import { createLedger, actualUsd, HARD_STOP_USD } from "../shared/experience/budget-ledger.mjs";
import {
  createNotebook, commitEntry, hasSeveralCandidates, pickCandidate, commitStory, assignEngine, answerQuestion, editAnswer,
  engineInput, analysisBasis, applyAnalysis, analysisIsCurrent, experienceById,
} from "../shared/experience/notebook.mjs";
import { createExperienceHandler, signSession, sessionIsValid } from "../api/_experience-core.js";
import { createSpendGuard, memoryStore } from "../api/_experience-guard.js";
import { proposeScopes } from "../shared/experience/scopes.mjs";

const STORY = "[가상 경험] 팀 워크숍 장소를 정하는 일을 맡았어요. 업체 견적부터 시작해서 장소 답사, 이동 수단 예약까지 모두 제가 했어요. 팀장님은 가까운 곳을 원했고 팀원 몇 명은 숙박이 되는 곳을 원해서 의견이 갈렸어요.";
const BROAD = "[가상] 영업팀에서 신규 거래처 발굴도 했었고, 면접관으로 면접도 했었고, 평가도 했었어요";

test("broad entry → candidates, nothing picked automatically; each pick keeps its own experience", () => {
  let s = commitEntry(createNotebook(), BROAD);
  assert.equal(hasSeveralCandidates(s), true);
  assert.equal(s.activeId, null);
  s = pickCandidate(s, s.scope.candidates[0].id);
  const first = s.activeId;
  s = commitStory(assignEngine(s, first, "local"), first, STORY);
  s = pickCandidate(s, s.scope.candidates[1].id);
  assert.notEqual(s.activeId, first);
  assert.equal(experienceById(s, s.activeId).story.text, "");
  s = pickCandidate(s, s.scope.candidates[0].id);
  assert.equal(s.activeId, first);
});

test("candidate names drop the sentence ending but keep the original words as evidence", () => {
  const { candidates } = proposeScopes("[가상] 팀 행사 준비, 비품 관리, 거래처 정산을 맡았어요.");
  assert.deepEqual(candidates.map(c => c.title), ["[가상] 팀 행사 준비", "비품 관리", "거래처 정산"]);
  assert.equal(candidates[2].evidence, "거래처 정산을 맡았어요.");
});

test("local engine: listed tasks become separate actions; others' reasons stay context; asks only what is missing", () => {
  const sources = [{ id: "story", kind: "story", text: STORY }];
  const r = analyzeLocally({ sources, answers: [], title: "t" });
  const actions = r.items.filter(i => i.kind === "action").map(i => i.text);
  for (const task of ["업체 견적", "장소 답사", "이동 수단 예약"]) assert.ok(actions.includes(task), task);
  assert.equal(r.nextQuestion.slot, "focus");
  const answers = [{ id: "a1", slot: "focus", status: "answered", question: r.nextQuestion.text, text: "장소 답사" }];
  const r2 = analyzeLocally({ sources: [...sources, { id: "a1", kind: "answer", text: "장소 답사" }], answers, title: "t" });
  assert.match(r2.nextQuestion.text, /‘장소 답사’/);
  assert.equal(r2.items.filter(i => i.text === "장소 답사").length, 1);
  const r3 = analyzeLocally({ sources, answers: [...answers, { id: "a2", slot: "criterion", status: "unknown", question: "q", text: "" }], title: "t" });
  assert.notEqual(r3.nextQuestion?.slot, "criterion");
  assert.ok(!r3.items.some(i => i.kind === "criterion"));
});

test("evidence rules: quotes must exist; invented outcomes and numbers are held back", () => {
  const sources = [{ id: "story", text: "[가상] 자주 묻는 내용을 메모로 만들어 붙였어요. 질문이 줄었는지는 세보지 않았어요." }];
  const { accepted } = verifyItems([
    { id: "i1", kind: "action", text: "메모 작성", basis: "stated", evidence: [{ sourceId: "story", quote: "자주 묻는 내용을 메모로 만들어" }] },
    { id: "i2", kind: "result", text: "문의 감소", basis: "stated", evidence: [{ sourceId: "story", quote: "문의가 줄었어요" }] },
  ], sources);
  assert.deepEqual(accepted.map(i => i.id), ["i1"]);
  const unknownResult = { id: "i3", kind: "result", text: "모름", evidence: [{ sourceId: "story", quote: "질문이 줄었는지는 세보지 않았어요" }] };
  const { kept, held } = verifyComposedLines([
    { text: "자주 묻는 내용을 메모로 정리해 공유", itemIds: ["i1"] },
    { text: "메모로 신입 질문을 30% 줄임", itemIds: ["i1", "i3"] },
  ], [...accepted, unknownResult]);
  assert.deepEqual(kept.map(l => l.text), ["자주 묻는 내용을 메모로 정리해 공유"]);
  assert.equal(held.length, 1);
  assert.deepEqual(claimIssues("후보지 3곳 조사", [{ kind: "action", text: "x", evidence: [{ quote: "후보 세 곳을 알아보고" }] }]), []);
});

test("an edited answer invalidates the analysis; a late answer for an old version is discarded", () => {
  let s = commitEntry(createNotebook(), "[가상] 행사 준비");
  s = pickCandidate(s, s.scope.candidates[0].id);
  const id = s.activeId;
  s = commitStory(assignEngine(s, id, "local"), id, STORY);
  const staleBasis = analysisBasis(experienceById(s, id));
  s = applyAnalysis(s, id, analyzeLocally(engineInput(experienceById(s, id))), staleBasis);
  const q = experienceById(s, id).analysis.nextQuestion;
  s = answerQuestion(s, id, q, { text: "장소 답사" });
  assert.equal(answerQuestion(s, id, q, { text: "장소 답사" }), s, "a repeated click adds nothing");
  s = editAnswer(s, id, experienceById(s, id).answers[0].id, "업체 견적");
  assert.equal(analysisIsCurrent(experienceById(s, id)), false);
  assert.equal(applyAnalysis(s, id, { items: [] }, staleBasis), s, "an answer computed for an older version is ignored");
  assert.deepEqual(experienceById(s, id).answers[0].versions.map(v => v.text), ["장소 답사"]);
});

test("AI output is re-checked: unquoted items dropped, closed questions refused, presupposing interview question replaced", () => {
  const payload = { sources: [{ id: "story", kind: "story", text: STORY }], asked: [], unanswered: [{ slot: "result", status: "unknown", question: "q" }] };
  const a = acceptAnalysis({ title: "워크숍", items: [
    { id: "i1", kind: "action", text: "장소 답사", basis: "stated", evidence: [{ sourceId: "story", quote: "장소 답사" }] },
    { id: "i2", kind: "result", text: "만족도 향상", basis: "stated", evidence: [{ sourceId: "story", quote: "모두 만족했어요" }] }],
    nextQuestion: { ask: true, slot: "result", aboutItemId: "i1", text: "반응은 어땠나요?", why: "", choices: [] } }, payload);
  assert.deepEqual(a.items.map(i => i.id), ["i1"]);
  assert.notEqual(a.nextQuestion?.slot, "result", "the closed question is not asked again; another missing part is asked instead");
  const c = acceptComposition({ resume: [{ text: "장소 답사 진행", itemIds: ["i1"] }], interview: { question: "업무를 개선한 경험을 말씀해 주세요.", lines: [] } }, { items: a.items, sources: payload.sources });
  assert.equal(c.interview.question, "이 경험에서 어떤 일을 했고, 어떻게 판단했는지 말씀해 주세요.");
});

// ---------- server ----------
function fakeRes() {
  const res = { statusCode: 200, body: null };
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.body = body; return res; };
  return res;
}
const call = async (handler, body, headers = {}) => { const res = fakeRes(); await handler({ method: "POST", body, headers }, res); return res; };
const modelReply = { stop_reason: "end_turn", usage: { input_tokens: 2000, output_tokens: 800 }, content: [{ type: "text", text: JSON.stringify({ title: "워크숍",
  items: [{ id: "i1", kind: "action", text: "장소 답사", basis: "stated", evidence: [{ sourceId: "story", quote: "장소 답사" }] }],
  nextQuestion: { ask: true, slot: "criterion", aboutItemId: "i1", text: "답사할 장소는 어떤 기준으로 골랐나요?", why: "기준을 남겨요", choices: [] } }) }] };
const payload = { sources: [{ id: "story", kind: "story", text: STORY }], asked: [], unanswered: [], excluded: [], previousItems: [] };

test("production: consent and bot check before a session; calls need a valid session", async () => {
  let calls = 0;
  const handler = createExperienceHandler({ secret: "s3cret", callModel: async () => { calls++; return modelReply; },
    verifyBot: async token => token === "ok", rateLimit: async () => ({ ok: true }), guard: createSpendGuard({ redis: memoryStore() }) });
  assert.equal((await call(handler, { op: "session", consent: false, turnstileToken: "ok" })).statusCode, 400);
  assert.equal((await call(handler, { op: "session", consent: true })).body.code, "bot");
  assert.equal((await call(handler, { op: "session", consent: true, turnstileToken: "bad" })).statusCode, 403);
  const { session } = (await call(handler, { op: "session", consent: true, turnstileToken: "ok" })).body;
  assert.equal(sessionIsValid("s3cret", session), true);
  assert.equal(sessionIsValid("s3cret", signSession("s3cret", Date.now() - 46 * 60_000)), false, "sessions expire");
  assert.equal((await call(handler, { op: "analyze", payload, session: "forged.token" })).statusCode, 401);
  assert.equal(calls, 0, "nothing reaches the model before a valid session");
  const ok = await call(handler, { op: "analyze", payload, session });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.result.nextQuestion.slot, "criterion");
  assert.equal(calls, 1);
});

test("test mode: only fictional stories, every call reserved in the shared ledger, blocked before the cap", async () => {
  const ledger = createLedger(path.join(await mkdtemp(path.join(tmpdir(), "aro-xp-")), "ledger.json"));
  await ledger.init();
  let calls = 0;
  const handler = createExperienceHandler({ ledger, callModel: async () => { calls++; return modelReply; }, verifyBot: async () => false, rateLimit: async () => ({ ok: true }) });
  assert.equal((await call(handler, { op: "session", consent: true })).body.testMode, true);
  const real = await call(handler, { op: "analyze", payload: { ...payload, sources: [{ id: "story", kind: "story", text: "실제 경력 원문" }] } });
  assert.equal(real.statusCode, 403);
  assert.equal((await call(handler, { op: "analyze", payload })).statusCode, 403, "fictional flag is required too");
  assert.equal(calls, 0);
  const ok = await call(handler, { op: "analyze", payload: { ...payload, fictional: true } });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body.budget.committedUsd, actualUsd(modelReply.usage));
  await ledger.reserve("analyze", HARD_STOP_USD - ok.body.budget.committedUsd - 0.001);
  const blocked = await call(handler, { op: "analyze", payload: { ...payload, fictional: true } });
  assert.equal(blocked.statusCode, 402);
  assert.equal(calls, 1, "the blocked call never reached the model");
});

test("payload checks apply in every mode", () => {
  assert.equal(checkPayload("analyze", { sources: [] }), "no-story");
  assert.equal(checkPayload("delete", payload), "unknown-op");
  assert.equal(checkPayload("analyze", payload), null);
  assert.equal(checkPayload("analyze", payload, { requireFictional: true }), "not-fictional");
});

test("experience card: statements must rest on items; a caution must quote real words; advice stays advice", () => {
  const items = [
    { id: "i1", kind: "action", text: "장소 답사", evidence: [{ sourceId: "story", quote: "장소 답사" }] },
    { id: "i2", kind: "situation", text: "의견 갈림", evidence: [{ sourceId: "story", quote: "숙박이 되는 곳을 원해서 의견이 갈렸어요" }] },
  ];
  const card = acceptComposition({
    headline: { text: "의견이 갈린 상황에서 직접 답사해 비교함", itemIds: ["i1", "i2"] },
    use_for: ["의견이 다를 때 어떻게 했나요?"],
    resume: [{ text: "후보 장소를 직접 답사해 비교", itemIds: ["i1"] }, { text: "참석률 30% 향상", itemIds: ["i1"] }],
    interview: { question: "장소를 어떻게 정했나요?", script: [{ text: "후보 장소를 직접 답사했습니다.", itemIds: ["i1"] }] },
    follow_ups: [{ question: "결과는 어땠나요?", point: "확인한 것만 말하세요." }],
    cautions: [{ quote: "의견이 갈렸어요", why: "갈등만 부각될 수 있음", instead: "의견을 모아 비교했다고 말하기" }, { quote: "팀장 탓", why: "x", instead: "y" }],
    strengthen: ["최종 장소가 어디였는지"],
  }, { items, sources: [] });
  assert.equal(card.headline.text, "의견이 갈린 상황에서 직접 답사해 비교함");
  assert.deepEqual(card.resume.map(l => l.text), ["후보 장소를 직접 답사해 비교"]);
  assert.equal(card.held.length, 1, "an invented outcome is held back");
  assert.deepEqual(card.cautions.map(c => c.quote), ["의견이 갈렸어요"], "a caution about words the person never wrote is dropped");
  assert.equal(card.followUps.length, 1);
  assert.deepEqual(card.strengthen, ["최종 장소가 어디였는지"]);
});

test("the working angle survives only with verified items behind it", () => {
  const payload = { sources: [{ id: "story", kind: "story", text: STORY }], asked: [], unanswered: [] };
  const raw = { title: "t", items: [{ id: "i1", kind: "action", text: "장소 답사", basis: "stated", evidence: [{ sourceId: "story", quote: "장소 답사" }] }],
    nextQuestion: { ask: false, slot: "other", aboutItemId: "", text: "", why: "", choices: [] } };
  assert.equal(acceptAnalysis({ ...raw, angle: { text: "직접 답사해 비교함", itemIds: ["i1"] } }, payload).angle.text, "직접 답사해 비교함");
  assert.equal(acceptAnalysis({ ...raw, angle: { text: "근거 없는 해석", itemIds: ["zz"] } }, payload).angle, null);
});

test("when the AI stops after too few questions, the rule-based plan asks what is still missing", () => {
  const payload = { sources: [{ id: "story", kind: "story", text: STORY }], asked: [{ slot: "other", aboutKey: "", text: "제안은 어떤 점을 보고 하셨나요?" }],
    unanswered: [{ slot: "other", status: "unknown", question: "제안은 어떤 점을 보고 하셨나요?" }] };
  const raw = { title: "t", angle: { text: "직접 답사함", itemIds: ["i1"] }, nextQuestion: { ask: false, slot: "other", aboutItemId: "", text: "", why: "", choices: [] },
    items: [{ id: "i1", kind: "action", text: "장소 답사", basis: "stated", evidence: [{ sourceId: "story", quote: "장소 답사" }] },
      { id: "i2", kind: "action", text: "업체 견적", basis: "stated", evidence: [{ sourceId: "story", quote: "업체 견적" }] }] };
  const a = acceptAnalysis(raw, payload);
  assert.equal(a.questionNote, "rule-fallback");
  assert.ok(["focus", "criterion"].includes(a.nextQuestion.slot));
});

test("a headline with an unsupported outcome word falls back to the confirmed core message", () => {
  const items = [{ id: "i1", kind: "action", text: "새 양식 제안", evidence: [{ sourceId: "story", quote: "접수 양식을 바꾸자고 제안해서" }] }];
  const card = acceptComposition({ headline: { text: "접수를 맡아 개선안까지 제안함", itemIds: ["i1"] }, use_for: [], resume: [],
    interview: { question: "q", script: [] }, follow_ups: [], cautions: [], strengthen: [] }, { items, sources: [], angle: "처음 맡은 접수에서 새 양식을 제안함" });
  assert.equal(card.headline.text, "처음 맡은 접수에서 새 양식을 제안함");
});

test("a question pointing at the same quoted words as an earlier one is treated as a repeat", () => {
  const payload = { sources: [{ id: "story", kind: "story", text: STORY }], unanswered: [],
    asked: [{ slot: "action", text: "‘모두 제가 했어요’라고 하셨는데, 가장 먼저 하신 일은 무엇이었나요?" }, { slot: "criterion", text: "a" }, { slot: "alignment", text: "b" }] };
  const raw = { title: "t", angle: { text: "x", itemIds: [] }, items: [],
    nextQuestion: { ask: true, slot: "role", aboutItemId: "", text: "‘모두 제가 했어요’라고 하셨는데, 맡은 업무는 무엇이었나요?", why: "", choices: [] } };
  const a = acceptAnalysis(raw, payload);
  assert.equal(a.questionNote, "question-repeated");
  assert.equal(a.nextQuestion, null);
});

test("verification: unsupported details are fixed or dropped, and fixes still pass the outcome rules", async () => {
  const { applyVerification, statementsOf } = await import("../shared/experience/ai-contract.mjs");
  const items = [{ id: "i1", kind: "action", text: "분할 납품 일정 재수립", evidence: [{ sourceId: "story", quote: "생산팀과 회의해 분할 납품 일정을 다시 잡았다" }] }];
  const card = { headline: { text: "분할 납품안을 직접 결정해 위기를 해결함", itemIds: ["i1"] }, resume: [{ text: "분할 납품으로 계약 유지", itemIds: ["i1"] }],
    interview: { question: "q", lines: [{ text: "생산팀과 회의해 일정을 다시 잡았습니다.", itemIds: ["i1"] }] }, held: [] };
  assert.deepEqual(statementsOf(card, items).map(s => s.id), ["h", "r0", "s0"]);
  const out = applyVerification(card, { checks: [
    { id: "h", verdict: "fix", text: "생산팀과 회의해 분할 납품 일정을 다시 잡음", reason: "혼자 결정했다는 말이 없음" },
    { id: "r0", verdict: "drop", text: "", reason: "계약 유지와의 인과 근거 없음" },
    { id: "s0", verdict: "fix", text: "생산팀과 회의해 일정을 다시 잡아 성과를 냈습니다.", reason: "" },
  ] }, items);
  assert.equal(out.headline.text, "생산팀과 회의해 분할 납품 일정을 다시 잡음");
  assert.equal(out.resume.length, 0);
  assert.equal(out.interview.lines.length, 0, "a 'fix' that adds an outcome word is dropped");
  assert.deepEqual(out.verification, { fixed: 1, dropped: 2 });
});

test("a resume line or spoken sentence that repeats an earlier one is dropped", async () => {
  const { withoutRepeats } = await import("../shared/experience/ai-contract.mjs");
  const { kept, held } = withoutRepeats([{ text: "생산팀과 회의해 분할 납품 일정을 다시 수립", itemIds: ["i1"] },
    { text: "생산팀과 회의해 분할 납품 일정을 다시 잡고 승인 받음", itemIds: ["i1"] }, { text: "매주 월요일 메일로 진행 공유", itemIds: ["i2"] }]);
  assert.deepEqual(kept.map(l => l.text), ["생산팀과 회의해 분할 납품 일정을 다시 수립", "매주 월요일 메일로 진행 공유"]);
  assert.equal(held.length, 1);
});

test("wording an evaluator minds is flagged even when the model's cautions miss it", async () => {
  const { wordingRisks, withoutRepeats } = await import("../shared/experience/ai-contract.mjs");
  const sources = [{ id: "story", text: "[가상] 거래처가 화가 났는데, 제가 다 해결해서 결국 계약을 지켰어요. 그들이 바빠서 안 해서 넘어왔고 회계는 하나도 모르는 상태였어요." }];
  const risks = wordingRisks(sources, []);
  assert.equal(risks.length, 3);
  assert.match(risks[0].quote, /제가 다 해결/);
  assert.equal(wordingRisks(sources, [{ quote: "제가 다 해결해서" }]).length, 2, "a phrase the model already covered is not repeated");
  assert.equal(withoutRepeats([{ text: "신입 교육 자료 제작 및 교육 진행" }, { text: "신입 교육 자료 제작" }]).kept.length, 1);
});

test("production refuses every AI call when the spending guard cannot see spend", async () => {
  let calls = 0;
  const noStore = createExperienceHandler({ secret: "s", callModel: async () => { calls++; return modelReply; }, verifyBot: async () => true,
    rateLimit: async () => ({ ok: true }), guard: createSpendGuard({ redis: null }) });
  const start = await call(noStore, { op: "session", consent: true, turnstileToken: "ok" });
  assert.equal(start.statusCode, 503);
  assert.equal(start.body.code, "guard-unavailable");
  const failing = { incrby: async () => { throw new Error("ENOTFOUND upstash"); }, decrby: async () => 0, expire: async () => 1 };
  const broken = createExperienceHandler({ secret: "s", callModel: async () => { calls++; return modelReply; }, verifyBot: async () => true,
    rateLimit: async () => ({ ok: true }), guard: createSpendGuard({ redis: failing }) });
  assert.equal((await call(broken, { op: "analyze", payload, session: signSession("s") })).body.code, "guard-unavailable");
  assert.equal(calls, 0);
});

test("spending guard: monthly, daily, per-person and per-session limits; refunds after actual usage", async () => {
  const store = memoryStore();
  const guard = createSpendGuard({ redis: store, limits: { monthlyCapUsd: 1, dailyCapUsd: 0.6, perIpDailyUsd: 0.3, perIpDailySessions: 2, perSessionCalls: 3 },
    now: () => Date.parse("2026-10-04T10:00:00Z") });
  await guard.startSession("1.1.1.1"); await guard.startSession("1.1.1.1");
  await assert.rejects(guard.startSession("1.1.1.1"), { code: "ip-sessions" });
  const a = await guard.reserve("analyze", 0.2, "claude-sonnet-5-5", { ip: "1.1.1.1", sessionId: "s1" });
  await assert.rejects(guard.reserve("analyze", 0.2, "claude-sonnet-5-5", { ip: "1.1.1.1", sessionId: "s1" }), { code: "ip-daily-cap" });
  assert.equal(store.map.get("aro:xp:spend:2026-10-04"), 200000, "a refused reservation is rolled back everywhere");
  await guard.settle(a, { usage: { input_tokens: 1000, output_tokens: 1000 } });
  assert.ok(store.map.get("aro:xp:spend:2026-10") < 200000, "the actual cost replaces the reservation");
  await guard.reserve("analyze", 0.25, "claude-sonnet-5-5", { ip: "2.2.2.2", sessionId: "s2" });
  await guard.reserve("analyze", 0.25, "claude-sonnet-5-5", { ip: "3.3.3.3", sessionId: "s3" });
  await assert.rejects(guard.reserve("analyze", 0.2, "claude-sonnet-5-5", { ip: "4.4.4.4", sessionId: "s4" }), { code: "daily-cap" });
  for (let i = 0; i < 3; i++) await guard.reserve("analyze", 0.01, "claude-sonnet-5-5", { ip: "5.5.5.5", sessionId: "s5" });
  await assert.rejects(guard.reserve("analyze", 0.01, "claude-sonnet-5-5", { ip: "5.5.5.5", sessionId: "s5" }), { code: "session-calls" });
  await assert.rejects(guard.reserve("analyze", 0.01, "claude-unknown", { ip: "6.6.6.6" }).then(() => guard.settle(JSON.stringify({ amount: 1, keys: [], model: "claude-unknown" }), { usage: {} })), { code: "unknown-model-price" });
});

test("concurrent reservations can never pass the monthly cap together", async () => {
  const guard = createSpendGuard({ redis: memoryStore(), limits: { monthlyCapUsd: 1, dailyCapUsd: 10, perIpDailyUsd: 10, perSessionCalls: 100 } });
  const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => guard.reserve("compose", 0.15, "claude-opus-5-5", { ip: "ip" + i })));
  assert.equal(results.filter(r => r.status === "fulfilled").length, 6);
});

test("styleIssues flags resume lines that cannot be pasted as-is", async () => {
  const { styleIssues, statementsOf } = await import("../shared/experience/ai-contract.mjs");
  assert.deepEqual(styleIssues("[가상] 접수 누락을 막기 위해 담당 부서와 필수 정보를 정해 신청 양식 제작", "resume"), []);
  assert.ok(styleIssues("[가상] 내가 보낸 메일을 다시 찾아 빠진 정보를 확인", "resume").some(x => x.includes("주어")));
  assert.ok(styleIssues("[가상] 초안을 몇 건에 써보고 담당 부서에 확인받음", "resume").length >= 2);
  assert.ok(styleIssues("[가상] 공유했고, 결국 계약 유지", "resume").some(x => x.includes("연결어")));
  assert.ok(styleIssues("가".repeat(51), "headline").some(x => x.includes("50자")));
  const items = [{ id: "i1", evidence: [{ quote: "[가상] 양식을 만들었어요" }] }];
  const card = { headline: null, resume: [{ text: "[가상] 양식을 만들었음", itemIds: ["i1"] }, { text: "[가상] 신청 양식 제작", itemIds: ["i1"] }], interview: { lines: [] } };
  const rows = statementsOf(card, items);
  assert.ok(rows[0].style_issues.length);
  assert.equal(rows[1].style_issues, undefined);
});

test("fitHeadline swaps a long headline for the confirmed core message", async () => {
  const { fitHeadline } = await import("../shared/experience/ai-contract.mjs");
  const long = { text: "[가상] " + "담당 부서와 필요한 정보를 확인하고 기준을 정해 ".repeat(3), itemIds: ["i1"] };
  assert.deepEqual(fitHeadline(long, "[가상] 기준을 정해 신청 양식을 만듦", []), { text: "[가상] 기준을 정해 신청 양식을 만듦", itemIds: [] });
  assert.equal(fitHeadline(long, "", []), long);
  const short = { text: "[가상] 신청 양식을 만듦", itemIds: ["i1"] };
  assert.equal(fitHeadline(short, "[가상] 다른 문장", []), short);
});
