// 하루 한 번 Upstash DB에 기록을 남겨, 무료 DB가 "오래 안 씀"으로 보관 처리되지 않게 한다.
// 2026-10-04 실제로 보관 처리돼 레이트리밋과 경험 정리 비용 상한이 멈췄다. 호출은 vercel.json의 crons가 한다.
// CRON_SECRET 환경변수가 있으면 Vercel이 보내는 Authorization 헤더가 맞을 때만 실행한다.
import { Redis } from "@upstash/redis";

const REDIS_URL = process.env.ARO_KV_KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.ARO_KV_KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const redis = REDIS_URL && REDIS_TOKEN ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN }) : null;

export function isCronCaller(req, secret = process.env.CRON_SECRET) {
  return !secret || req.headers?.authorization === `Bearer ${secret}`;
}

// One write per call; the key expires on its own, so nothing accumulates.
export async function touchStore(store, now = Date.now()) {
  await store.set("aro:keepalive", new Date(now).toISOString(), { ex: 3 * 86400 });
}

export function createKeepAliveHandler({ store, secret = process.env.CRON_SECRET }) {
  return async function handler(req, res) {
    if (!isCronCaller(req, secret)) return res.status(401).json({ ok: false });
    if (!store) return res.status(503).json({ ok: false, error: "no-store" });
    try {
      await touchStore(store);
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("Keep-alive failed:", error?.message || error);
      return res.status(502).json({ ok: false, error: "store-unreachable" });
    }
  };
}

export default createKeepAliveHandler({ store: redis });
