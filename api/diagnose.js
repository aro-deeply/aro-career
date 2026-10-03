import Anthropic from "@anthropic-ai/sdk";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { checkRateLimit } from "./_rate-limit.js";
import { createSpendGuard } from "./_experience-guard.js";
import { buildDiagnoseRequest, acceptDiagnosis, CAREER_STAGES, DIAGNOSE_MODEL } from "./_diagnose-core.js";
import { worstCaseUsd, BudgetError } from "../shared/experience/budget-ledger.mjs";

// Model can be overridden by env var without code changes (for A/B, upgrades)
const ANTHROPIC_MODEL = process.env.DIAGNOSE_MODEL || DIAGNOSE_MODEL;

// Input length guards (server-side enforcement, mirrors client UI)
const RESUME_MIN_LENGTH = 200;
const RESUME_MAX_LENGTH = 3000;

// ─── Rate Limiting (IP 기반) ─────────────────────────────────────────────────
// Upstash Redis 무료 티어 사용. UPSTASH_REDIS_REST_* 는 수동 설정 이름,
// KV_REST_API_* 는 Vercel Marketplace Upstash 연동이 자동 생성하는 이름.
// ARO_KV_KV_REST_API_* 는 2026-10-04 재연결한 DB(옛 DB의 KV_* 값과 이름이 겹쳐 접두어를 ARO_KV로 지정).
// 환경변수가 없거나 Redis 호출이 실패하면(예: DB 소멸) rate limit는 자동
// 비활성화 — fail-open 판정 규칙은 api/_rate-limit.js 참조.
// 정책: IP당 1분 5회, 1일 20회. 둘 중 하나라도 초과하면 429.
const REDIS_URL = process.env.ARO_KV_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.ARO_KV_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
let limiterPerMinute = null;
let limiterPerDay = null;
// Diagnosis shares the experience engine's spending caps (site owner decision 2026-10-04: one USD 50 monthly cap for both tools).
// Without the store the cap cannot be checked, so the AI is not called (fail-closed), unlike the IP limit above.
let guard = createSpendGuard({ redis: null });
if (REDIS_URL && REDIS_TOKEN) {
  const redis = new Redis({
    url: REDIS_URL,
    token: REDIS_TOKEN,
  });
  guard = createSpendGuard({ redis });
  limiterPerMinute = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "60 s"),
    analytics: false,
    prefix: "aro:diagnose:1m",
  });
  limiterPerDay = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "1 d"),
    analytics: false,
    prefix: "aro:diagnose:1d",
  });
}


async function verifyTurnstile(token, ip) {
  const params = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  if (ip) params.set("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = await r.json();
  return Boolean(data.success);
}

export const config = {
  maxDuration: 90,
  supportsResponseStreaming: true,
};

// Errors the API rejects before doing any work are not billed, so their reservation is refunded.
const NOT_BILLED = new Set([400, 401, 403, 404, 413, 422, 429]);
const LIMIT_MESSAGES = {
  "monthly-cap": "이번 달 AI 진단 사용량이 모두 찼어요. 다음 달에 다시 이용해 주세요.",
  "daily-cap": "오늘 AI 진단 사용량이 모두 찼어요. 내일 다시 이용해 주세요.",
  "ip-daily-cap": "오늘은 이 기기에서 진단을 충분히 하셨어요. 내일 다시 이용해 주세요.",
  "guard-unavailable": "지금은 AI 진단을 이용할 수 없어요. 잠시 후 다시 시도해 주세요.",
};

/**
 * Production wiring is the default export below; the local check server passes a test ledger and simulated bot check.
 * @param {object} deps
 * @param {{reserve: Function, settle: Function}} deps.guard  spending guard (or the test ledger)
 */
export function createDiagnoseHandler({
  guard,
  verifyBot = verifyTurnstile,
  rateLimit = (ip) => checkRateLimit({ limiterPerMinute, limiterPerDay }, ip),
  makeClient = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  model = ANTHROPIC_MODEL,
}) {
  return async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { jobTarget, situation, careerStage, resume, rejection, turnstileToken } = req.body || {};

  if (!jobTarget || !situation || !resume) {
    return res.status(400).json({ error: "필수 항목이 누락되었습니다." });
  }
  if (careerStage && !CAREER_STAGES.includes(careerStage)) {
    return res.status(400).json({ error: "연차 값이 올바르지 않습니다." });
  }
  if (typeof resume !== "string" || resume.length < RESUME_MIN_LENGTH) {
    return res.status(400).json({ error: `이력서 본문은 ${RESUME_MIN_LENGTH}자 이상이어야 합니다.` });
  }
  if (resume.length > RESUME_MAX_LENGTH) {
    return res.status(400).json({ error: `이력서 본문은 ${RESUME_MAX_LENGTH}자를 초과할 수 없습니다.` });
  }
  if (!turnstileToken) {
    return res.status(400).json({ error: "봇 검증 토큰이 누락되었습니다." });
  }

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || null;

  // Rate limit는 Turnstile 검증 이전에 — 외부 API 호출 비용 절약
  const rl = await rateLimit(ip);
  if (!rl.ok) {
    const seconds = rl.reset ? Math.max(0, Math.ceil((rl.reset - Date.now()) / 1000)) : null;
    const wait = seconds ? `약 ${seconds}초 후 다시 시도해주세요.` : "잠시 후 다시 시도해주세요.";
    return res.status(429).json({ error: `요청이 너무 많습니다 (${rl.scope} 한도 초과). ${wait}` });
  }

  const turnstileOk = await verifyBot(turnstileToken, ip);
  if (!turnstileOk) {
    return res.status(403).json({ error: "봇 검증에 실패했습니다. 다시 시도해주세요." });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "서버 설정 오류: ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다." });
  }

  const body = buildDiagnoseRequest({ jobTarget, situation, careerStage, resume, rejection }, model);
  let reservation;
  try {
    reservation = await guard.reserve("diagnose", worstCaseUsd(body, body.max_tokens), body.model, { ip });
  } catch (error) {
    const code = error instanceof BudgetError ? error.code : "guard-unavailable";
    console.error("Diagnosis spend guard refused:", code);
    return res.status(code === "guard-unavailable" ? 503 : 429).json({ error: LIMIT_MESSAGES[code] || LIMIT_MESSAGES["guard-unavailable"], code });
  }

  const client = makeClient();

  // 응답은 NDJSON 스트리밍: {"t":"delta","text":...} 이벤트가 생성 즉시 흘러가고(로딩 화면 미리보기용),
  // 끝에 검사를 마친 결과 {"t":"result","result":...}와 {"t":"done"}, 또는 {"t":"error","message":...}가 온다.
  // 첫 delta 이전의 실패는 JSON 상태 응답으로 처리한다.
  let settled = false;
  const settle = async (outcome) => {
    if (settled) return;
    settled = true;
    await guard.settle(reservation, outcome).catch((e) => console.error("Diagnosis spend settle failed:", e?.message || e));
  };
  try {
    const stream = client.messages.stream(body);

    stream.on("text", (delta) => {
      if (!res.headersSent) {
        res.writeHead(200, {
          "content-type": "application/x-ndjson; charset=utf-8",
          "cache-control": "no-cache",
        });
      }
      res.write(JSON.stringify({ t: "delta", text: delta }) + "\n");
    });

    const finalMessage = await stream.finalMessage();
    await settle({ usage: finalMessage.usage });
    const text = (finalMessage.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    let result;
    try {
      result = acceptDiagnosis(JSON.parse(text), { resume });
    } catch (e) {
      console.error("Diagnosis JSON parse fail. stop_reason:", finalMessage.stop_reason);
      const hint =
        finalMessage.stop_reason === "max_tokens"
          ? "AI 응답이 한도를 넘겨 끊겼습니다. 입력 길이를 줄이고 다시 시도해주세요."
          : "AI 응답 형식이 잘못되었습니다. 잠시 후 다시 시도해주세요.";
      if (!res.headersSent) return res.status(502).json({ error: hint });
      res.write(JSON.stringify({ t: "error", message: hint }) + "\n");
      return res.end();
    }
    if (result.dropped_quotes) console.warn("Diagnosis quotes not found in resume:", result.dropped_quotes);
    if (!res.headersSent) {
      res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-cache" });
    }
    res.write(JSON.stringify({ t: "result", result }) + "\n");
    res.write(JSON.stringify({ t: "done" }) + "\n");
    return res.end();
  } catch (err) {
    console.error("Anthropic call failed:", err?.status || "", err?.message || err);
    await settle({ notBilled: NOT_BILLED.has(err?.status) });
    if (!res.headersSent) {
      return res.status(502).json({ error: "일시적 오류입니다. 잠시 후 다시 시도해주세요." });
    }
    res.write(JSON.stringify({ t: "error", message: "일시적 오류입니다. 잠시 후 다시 시도해주세요." }) + "\n");
    return res.end();
  }
  };
}

export default createDiagnoseHandler({ guard });
