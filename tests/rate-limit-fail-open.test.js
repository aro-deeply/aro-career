// 레이트리밋 판정 규칙 테스트.
// 2026-08-27 장애 회귀 방지: Upstash DB가 소멸(DNS ENOTFOUND)해도
// 진단 API가 죽지 않고 fail-open 해야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit } from "../api/_rate-limit.js";

const IP = "203.0.113.7";

function limiterReturning(result) {
  return { limit: async () => result };
}

const allowed = { success: true, reset: 0 };

test("limiter 미구성(환경변수 없음)이면 통과", async () => {
  const verdict = await checkRateLimit({ limiterPerMinute: null, limiterPerDay: null }, IP);
  assert.deepEqual(verdict, { ok: true });
});

test("IP를 알 수 없으면 통과", async () => {
  const limiters = {
    limiterPerMinute: limiterReturning(allowed),
    limiterPerDay: limiterReturning(allowed),
  };
  assert.deepEqual(await checkRateLimit(limiters, null), { ok: true });
});

test("분·일 한도 모두 여유면 통과", async () => {
  const limiters = {
    limiterPerMinute: limiterReturning(allowed),
    limiterPerDay: limiterReturning(allowed),
  };
  assert.deepEqual(await checkRateLimit(limiters, IP), { ok: true });
});

test("1분 한도 초과면 차단 + reset 전달", async () => {
  const limiters = {
    limiterPerMinute: limiterReturning({ success: false, reset: 1234 }),
    limiterPerDay: limiterReturning(allowed),
  };
  assert.deepEqual(await checkRateLimit(limiters, IP), { ok: false, scope: "1분", reset: 1234 });
});

test("1일 한도 초과면 차단 + reset 전달", async () => {
  const limiters = {
    limiterPerMinute: limiterReturning(allowed),
    limiterPerDay: limiterReturning({ success: false, reset: 5678 }),
  };
  assert.deepEqual(await checkRateLimit(limiters, IP), { ok: false, scope: "1일", reset: 5678 });
});

test("Redis 호출이 예외를 던지면(DB 소멸 등) fail-open으로 통과", async () => {
  const dnsFailure = () => {
    const err = new TypeError("fetch failed");
    err.cause = Object.assign(new Error("getaddrinfo ENOTFOUND national-kiwi-70429.upstash.io"), {
      code: "ENOTFOUND",
    });
    throw err;
  };
  const limiters = {
    limiterPerMinute: { limit: async () => dnsFailure() },
    limiterPerDay: { limit: async () => dnsFailure() },
  };
  assert.deepEqual(await checkRateLimit(limiters, IP), { ok: true });
});
