// 밑줄(_) 접두 파일은 Vercel이 API 엔드포인트로 배포하지 않는다 — 순수 로직 모듈.

// 정책: IP당 분·일 한도 중 하나라도 초과하면 차단.
// 인프라 장애 시(예: Upstash 무료 티어 DB 소멸로 DNS 실패) 레이트리밋은
// 부가 기능이므로 진단 자체를 막지 않는다 — fail-open. (2026-08-27 장애의 교훈)
export async function checkRateLimit({ limiterPerMinute, limiterPerDay }, ip) {
  if (!limiterPerMinute || !limiterPerDay || !ip) {
    return { ok: true };
  }
  try {
    const [minute, day] = await Promise.all([
      limiterPerMinute.limit(ip),
      limiterPerDay.limit(ip),
    ]);
    if (!minute.success) {
      return { ok: false, scope: "1분", reset: minute.reset };
    }
    if (!day.success) {
      return { ok: false, scope: "1일", reset: day.reset };
    }
    return { ok: true };
  } catch (err) {
    console.error("Rate limit check failed (fail-open):", err?.message || err);
    return { ok: true };
  }
}
