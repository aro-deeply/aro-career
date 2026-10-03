// 경험 정리 엔진 엔드포인트 (운영 설정). 진단 페이지의 "경험만 있어요" 흐름이 호출한다.
// 봇 검증은 세션 시작 때 한 번, 이후 호출은 서명된 세션 토큰과 IP 횟수 제한으로 막는다.
// 처리 로직은 api/_experience-core.js에 있다.
import Anthropic from "@anthropic-ai/sdk";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { checkRateLimit } from "./_rate-limit.js";
import { createExperienceHandler } from "./_experience-core.js";
import { createSpendGuard } from "./_experience-guard.js";

const REDIS_URL = process.env.ARO_KV_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.ARO_KV_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
let limiters = { limiterPerMinute: null, limiterPerDay: null };
// Without Redis the spending guard cannot see spend, so every AI call is refused (fail-closed).
let guard = createSpendGuard({ redis: null });
if (REDIS_URL && REDIS_TOKEN) {
  const redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
  guard = createSpendGuard({ redis });
  // 한 경험에 분석·질문·결과로 여러 번 호출하므로 진단(분당 5회)보다 넉넉하게 둔다.
  limiters = {
    limiterPerMinute: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(12, "60 s"), analytics: false, prefix: "aro:experience:1m" }),
    limiterPerDay: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(80, "1 d"), analytics: false, prefix: "aro:experience:1d" }),
  };
}

async function verifyTurnstile(token, ip) {
  const params = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
  if (ip) params.set("remoteip", ip);
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: params,
  });
  return Boolean((await r.json()).success);
}

export const config = { maxDuration: 120 };

let client = null;
const handler = createExperienceHandler({
  callModel: body => {
    // Thrown before any request is sent, so nothing was billed (401 is treated as not billed).
    if (!process.env.ANTHROPIC_API_KEY) throw Object.assign(new Error("no-key"), { status: 401 });
    client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 110_000 });
    return client.messages.create(body);
  },
  secret: process.env.EXPERIENCE_SESSION_SECRET || process.env.TURNSTILE_SECRET_KEY || null,
  verifyBot: verifyTurnstile,
  rateLimit: ip => checkRateLimit(limiters, ip),
  guard,
  // Questions with Sonnet 5.5 (many quick calls), result and fact-check with Opus 5.5 (owner decision 2026-10-04).
  // A model without a verified price in shared/experience/budget-ledger.mjs is refused before any call.
  analyzeModel: process.env.EXPERIENCE_ANALYZE_MODEL || "claude-sonnet-5-5",
  model: process.env.EXPERIENCE_MODEL || "claude-opus-5-5",
});
export default handler;
