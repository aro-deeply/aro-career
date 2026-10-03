// 경험 정리 엔진의 서버 로직. 밑줄(_) 접두 파일이라 Vercel이 엔드포인트로 배포하지 않는다.
// api/experience.js가 운영 설정으로, 로컬 시험 서버가 시험 설정으로 이 핸들러를 만든다.
//
// 요청 순서: { op: "session" } 으로 봇 검증 1회 → 서명된 세션 토큰(45분) → 같은 세션으로 analyze / compose 여러 번.
// 시험 모드(ledger 지정): 가상 경험만 허용하고, 모든 호출을 공유 비용 원장에 먼저 예약한다. 봇 검증은 건너뛴다.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import {
  MODEL, checkPayload, buildAnalyzeRequest, buildComposeRequest, buildVerifyRequest, acceptAnalysis, acceptComposition, applyVerification, statementsOf,
} from "../shared/experience/ai-contract.mjs";
import { worstCaseUsd, BudgetError, MODEL_PRICES } from "../shared/experience/budget-ledger.mjs";

const SESSION_MINUTES = 45;
// Status codes Anthropic returns before running the model; these requests are not billed.
const NOT_BILLED = new Set([400, 401, 403, 404, 413, 422, 429]);

export function signSession(secret, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ exp: now + SESSION_MINUTES * 60_000, n: randomUUID() })).toString("base64url");
  return body + "." + createHmac("sha256", secret).update(body).digest("base64url");
}
export function sessionNonce(token) {
  try { return JSON.parse(Buffer.from(String(token).split(".")[0], "base64url").toString()).n || null; } catch { return null; }
}
export function sessionIsValid(secret, token, now = Date.now()) {
  if (typeof token !== "string" || !token.includes(".")) return false;
  const [body, mac] = token.split(".");
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;
  try { return JSON.parse(Buffer.from(body, "base64url").toString()).exp > now; } catch { return false; }
}

const USER_ERRORS = {
  "unknown-op": "알 수 없는 요청입니다.", "bad-payload": "요청 형식이 올바르지 않습니다.", "no-story": "경험 이야기가 비어 있습니다.",
  "too-many-parts": "내용이 너무 많습니다. 일부를 줄여 주세요.", "bad-source": "요청 형식이 올바르지 않습니다.",
  "too-long": "내용이 너무 깁니다. 일부를 줄여 주세요.", "not-fictional": "시험 모드에서는 가상 경험만 보낼 수 있습니다.",
};
// Spending and repeat-use limits: what the person sees, and the HTTP status.
const LIMIT_ERRORS = {
  "monthly-cap": [429, "이번 달 AI 정리 이용량이 모두 찼습니다. 다음 달에 다시 열립니다."],
  "daily-cap": [429, "오늘 AI 정리 이용량이 모두 찼습니다. 내일 다시 이용해 주세요."],
  "ip-daily-cap": [429, "오늘 이용할 수 있는 양을 모두 쓰셨습니다. 내일 다시 이용해 주세요."],
  "ip-sessions": [429, "오늘 새로 시작할 수 있는 정리 횟수를 모두 쓰셨습니다. 내일 다시 이용해 주세요."],
  "session-calls": [429, "이번 이용에서 쓸 수 있는 횟수를 모두 썼습니다. 잠시 후 페이지를 새로 열면 이어서 정리할 수 있습니다."],
  "guard-unavailable": [503, "지금은 AI 정리를 이용할 수 없습니다. 잠시 후 다시 시도해 주세요."],
  "budget-exhausted": [402, "시험 예산 상한에 닿기 전에 멈췄습니다."],
};
const limitResponse = (res, error) => {
  const [status, message] = LIMIT_ERRORS[error.code] || [503, "지금은 AI 정리를 이용할 수 없습니다."];
  return res.status(status).json({ error: message, code: error.code });
};

/**
 * @param {object} deps
 * @param {(body: object) => Promise<object>} deps.callModel   Anthropic messages.create 호출
 * @param {object|null} deps.ledger      시험 모드 비용 원장. 있으면 시험 모드.
 * @param {string|null} deps.secret      세션 서명 키 (운영)
 * @param {(token: string, ip: string|null) => Promise<boolean>} deps.verifyBot
 * @param {(ip: string|null) => Promise<{ok: boolean, scope?: string}>} deps.rateLimit
 * @param {string} [deps.model]
 */
export function createExperienceHandler({ callModel, ledger = null, guard = null, secret = null, verifyBot, rateLimit, model = MODEL, analyzeModel = model, requireFictional = true, onRaw = null }) {
  const testMode = Boolean(ledger);
  // Every model call is reserved first: the shared test ledger in test mode, the spending guard in production.
  const budget = ledger || guard;
  let busy = Promise.resolve();
  // In test mode calls run one at a time so two reservations never race the same remaining budget.
  const queue = work => { const run = busy.then(work, work); busy = run.catch(() => {}); return run; };

  // One structured-output call. Haiku 4.5 takes no effort setting.
  async function callStructured(op, spec, useModel, ctx) {
    const body = { model: useModel, max_tokens: spec.maxTokens, system: spec.system, messages: spec.messages,
      output_config: { ...(useModel.startsWith("claude-haiku") ? {} : { effort: "medium" }), format: { type: "json_schema", schema: spec.schema } } };
    if (!budget) throw new BudgetError("guard-unavailable");
    const entryId = await budget.reserve(op, worstCaseUsd(body, spec.maxTokens), useModel, ctx);
    let message;
    try { message = await callModel(body); } catch (error) {
      await budget.settle(entryId, { notBilled: NOT_BILLED.has(error?.status), reason: "api-error-" + (error?.status || "network") });
      throw Object.assign(new Error("upstream"), { code: error?.status === 429 ? "rate-limited" : "upstream" });
    }
    await budget.settle(entryId, { usage: message.usage });
    if (message.stop_reason === "refusal") throw Object.assign(new Error("refusal"), { code: "refusal" });
    if (message.stop_reason === "max_tokens") throw Object.assign(new Error("truncated"), { code: "truncated" });
    const text = (message.content || []).filter(block => block.type === "text").map(block => block.text).join("");
    if (testMode && onRaw) await onRaw(op, text);
    try { return { raw: JSON.parse(text), usage: message.usage }; } catch { throw Object.assign(new Error("invalid-json"), { code: "invalid-json" }); }
  }

  async function runModel(op, payload, ctx) {
    // Test mode may compare models that have a verified price; production always uses the configured model.
    const useModel = testMode && payload.testModel && MODEL_PRICES[payload.testModel] ? payload.testModel : (op === "analyze" ? analyzeModel : model);
    if (op === "analyze") return acceptAnalysis((await callStructured(op, buildAnalyzeRequest(payload), useModel, ctx)).raw, payload);
    const card = acceptComposition((await callStructured(op, buildComposeRequest(payload), useModel, ctx)).raw, payload);
    if (!statementsOf(card, payload.items || []).length) return { ...card, verification: null };
    // Second reading: every statement is checked against the person's own words before it is shown.
    try {
      const { raw } = await callStructured("verify", buildVerifyRequest(card, payload.items || []), useModel, ctx);
      return applyVerification(card, raw, payload.items || [], { angle: payload.angle });
    } catch (error) {
      if (error instanceof BudgetError) throw error;
      return { ...card, verification: null };
    }
  }

  return async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const { op, payload, session, turnstileToken, consent } = req.body || {};
    const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || null;

    const limited = await rateLimit(ip);
    if (!limited.ok) return res.status(429).json({ error: `요청이 너무 많습니다 (${limited.scope} 한도). 잠시 후 다시 시도해 주세요.`, code: "rate-limited" });

    if (op === "session") {
      if (consent !== true) return res.status(400).json({ error: "개인정보 처리에 동의해야 시작할 수 있습니다.", code: "consent" });
      if (testMode) return res.status(200).json({ session: "test-mode", testMode: true });
      if (!secret) return res.status(500).json({ error: "서버 설정 오류입니다.", code: "config" });
      if (!turnstileToken) return res.status(400).json({ error: "봇 검증을 완료해 주세요.", code: "bot" });
      if (!(await verifyBot(turnstileToken, ip))) return res.status(403).json({ error: "봇 검증에 실패했습니다. 다시 시도해 주세요.", code: "bot" });
      if (!guard) return limitResponse(res, new BudgetError("guard-unavailable"));
      try { await guard.startSession(ip); } catch (error) { return limitResponse(res, error); }
      return res.status(200).json({ session: signSession(secret) });
    }

    if (!testMode && !(secret && sessionIsValid(secret, session))) return res.status(401).json({ error: "세션이 끝났습니다. 다시 시작해 주세요.", code: "session" });
    const refusal = checkPayload(op, payload, { requireFictional: testMode && requireFictional });
    if (refusal) return res.status(refusal === "not-fictional" ? 403 : 400).json({ error: USER_ERRORS[refusal], code: refusal });

    try {
      const ctx = { ip, sessionId: testMode ? null : sessionNonce(session) };
      const result = await (testMode ? queue(() => runModel(op, payload, ctx)) : runModel(op, payload, ctx));
      const budget = testMode ? await ledger.summary() : undefined;
      if (testMode) console.log(`[experience] ${op} ok · test budget $${budget.committedUsd.toFixed(4)} / stop $${budget.hardStopUsd}`);
      return res.status(200).json({ result, ...(budget ? { budget } : {}) });
    } catch (error) {
      if (error instanceof BudgetError) return limitResponse(res, error);
      // Only the error code is logged; user text and model output never reach the logs.
      console.error("[experience] failed:", error.code || "error");
      const message = error.code === "rate-limited" ? "요청이 많아 잠시 거절됐습니다. 잠시 후 다시 시도해 주세요." : "AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.";
      return res.status(502).json({ error: message, code: error.code || "upstream" });
    }
  };
}
