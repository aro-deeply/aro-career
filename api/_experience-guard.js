// 경험 정리 엔진의 운영 비용 상한과 반복 사용 제한. 밑줄(_) 파일이라 엔드포인트로 배포되지 않는다.
// 사이트 운영자 결정(2026-10-04): 월 USD 50 상한. 하루·한 사람(IP)·정리 1건 단위 제한을 함께 둔다.
//
// 모든 AI 호출은 먼저 최악의 비용을 예약한다. 월·일·IP별 합계가 상한을 넘으면 예약을 되돌리고 호출하지 않는다.
// 호출이 끝나면 실제 사용량으로 정산한다. 기록 저장소(Upstash Redis)를 읽거나 쓸 수 없으면 호출을 막는다(fail-closed).
// 돈이 걸린 상한이므로, 저장소 장애 때 허용하는 기존 IP 횟수 제한(_rate-limit.js)과 반대로 동작한다.
import { randomUUID } from "node:crypto";
import { actualUsd, BudgetError } from "../shared/experience/budget-ledger.mjs";

export const GUARD_DEFAULTS = Object.freeze({
  monthlyCapUsd: 50,      // 운영자 결정
  dailyCapUsd: 5,         // 하루에 한 달 예산을 다 쓰지 않도록
  perIpDailyUsd: 1,       // 한 사람이 하루에 쓸 수 있는 비용 (경험 약 5개)
  perIpDailySessions: 5,  // 한 사람이 하루에 새로 시작할 수 있는 정리
  perSessionCalls: 20,    // 페이지를 한 번 열어 둔 동안(세션 45분)의 AI 호출. 경험 2개 정도를 질문·결과·검수까지 정리할 수 있다
});

const micro = usd => Math.ceil(usd * 1e6);
const DAY = 86400;

// Keys are per UTC month/day, so a new period starts from zero without a reset job.
function periodKeys(now, ip) {
  const d = new Date(now), month = d.toISOString().slice(0, 7), day = d.toISOString().slice(0, 10);
  return {
    month: `aro:xp:spend:${month}`, day: `aro:xp:spend:${day}`,
    ip: ip ? `aro:xp:spend:${day}:ip:${ip}` : null, ipSessions: ip ? `aro:xp:sessions:${day}:ip:${ip}` : null,
  };
}

/**
 * @param {object} redis  @upstash/redis client (or anything with incrby/decrby/expire)
 */
export function createSpendGuard({ redis, limits = GUARD_DEFAULTS, now = () => Date.now() }) {
  const caps = { ...GUARD_DEFAULTS, ...limits };
  async function safely(work) {
    try { return await work(); } catch (error) {
      if (error instanceof BudgetError) throw error;
      // Cannot see the spend → cannot promise the cap → do not call.
      throw new BudgetError("guard-unavailable", error?.message);
    }
  }
  return {
    caps,
    async startSession(ip) {
      return safely(async () => {
        if (!redis) throw new Error("no-store");
        const { ipSessions } = periodKeys(now(), ip);
        if (!ipSessions) return;
        const count = await redis.incrby(ipSessions, 1);
        if (count === 1) await redis.expire(ipSessions, 2 * DAY);
        if (count > caps.perIpDailySessions) throw new BudgetError("ip-sessions");
      });
    },
    // reserve(op, usd, model, { ip, sessionId }) → reservation id
    async reserve(op, usd, model, { ip = null, sessionId = null } = {}) {
      return safely(async () => {
        if (!redis) throw new Error("no-store");
        if (sessionId) {
          const key = `aro:xp:session-calls:${sessionId}`;
          const calls = await redis.incrby(key, 1);
          if (calls === 1) await redis.expire(key, 2 * 3600);
          if (calls > caps.perSessionCalls) throw new BudgetError("session-calls");
        }
        const keys = periodKeys(now(), ip), amount = micro(usd);
        const checks = [[keys.month, caps.monthlyCapUsd, "monthly-cap", 40 * DAY], [keys.day, caps.dailyCapUsd, "daily-cap", 2 * DAY],
          ...(keys.ip ? [[keys.ip, caps.perIpDailyUsd, "ip-daily-cap", 2 * DAY]] : [])];
        const added = [];
        try {
          for (const [key, cap, code, ttl] of checks) {
            const total = await redis.incrby(key, amount);
            added.push(key);
            if (total === amount) await redis.expire(key, ttl);
            // Concurrent reservations each see the others' amounts, so the sum can never pass the cap.
            if (total > micro(cap)) throw new BudgetError(code);
          }
        } catch (error) {
          for (const key of added) await redis.decrby(key, amount).catch(() => {});
          throw error;
        }
        return JSON.stringify({ id: randomUUID(), keys: added, amount, model });
      });
    },
    // usage known → refund the difference; rejected before processing → refund all; otherwise the reservation stays counted.
    async settle(reservation, { usage = null, notBilled = false } = {}) {
      const r = JSON.parse(reservation);
      const refund = usage ? Math.max(0, r.amount - micro(actualUsd(usage, r.model))) : notBilled ? r.amount : 0;
      if (!refund) return;
      await safely(async () => { for (const key of r.keys) await redis.decrby(key, refund); });
    },
  };
}

// Minimal in-memory store with the same calls, for tests and local runs without Redis.
export function memoryStore() {
  const map = new Map();
  return {
    map,
    async incrby(key, n) { const v = (map.get(key) || 0) + n; map.set(key, v); return v; },
    async decrby(key, n) { const v = (map.get(key) || 0) - n; map.set(key, v); return v; },
    async expire() { return 1; },
  };
}
