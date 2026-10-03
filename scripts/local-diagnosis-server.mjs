// 로컬 통합 검증 서버. 실제 빌드 결과(dist/)를 Vercel처럼(cleanUrls) 띄운다.
//   node scripts/local-diagnosis-server.mjs                → 경험 정리 API 없음: 화면이 규칙 기반 엔진으로 동작 (실제 원문 검증용)
//   node --env-file=.env.local scripts/local-diagnosis-server.mjs --ai
//                                                          → 경험 정리 API를 시험 모드로 연결: 가상 경험만, 공유 비용 원장으로 차단
// 운영 API(/api/lead, /api/feedback)는 어떤 모드에서도 호출하지 않고 503으로 막는다. /api/diagnose는 --prod-sim에서만 시험 원장으로 돈다.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = fileURLToPath(new URL("../dist/", import.meta.url));
const PORT = Number(process.env.ARO_SITE_PORT || 52481);
const AI = process.argv.includes("--ai");
// The site owner approved testing with their own experience (2026-10-03). Without this flag only fictional stories are sent.
const OWN_EXPERIENCE = process.argv.includes("--allow-own-experience");
// --prod-sim: the production code path (session, spending guard, mixed models) with Turnstile treated as passed and
// an in-memory store instead of Upstash. Every call is still reserved in the shared test ledger as well.
const PROD_SIM = process.argv.includes("--prod-sim");
const LEDGER_FILE = fileURLToPath(new URL("../prototypes/experience-card-20261003/ai-budget/ledger.json", import.meta.url));
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".json": "application/json", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8" };

let experienceHandler = null;
let diagnoseHandler = null;
if (AI) {
  const { createExperienceHandler } = await import("../api/_experience-core.js");
  const { createLedger } = await import("../shared/experience/budget-ledger.mjs");
  const { MODEL } = await import("../shared/experience/ai-contract.mjs");
  if (process.env.ANTHROPIC_BASE_URL) throw new Error("ANTHROPIC_BASE_URL is set; test pricing assumes the first-party API.");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const ledger = createLedger(LEDGER_FILE);
  await ledger.summary(); // the shared ledger must already exist; never start a fresh budget here
  const client = new Anthropic({ maxRetries: 0, timeout: 150_000 });
  if (PROD_SIM) {
    const { createSpendGuard, memoryStore, GUARD_DEFAULTS } = await import("../api/_experience-guard.js");
    const limits = { ...GUARD_DEFAULTS, ...(process.env.ARO_GUARD_SESSION_CALLS ? { perSessionCalls: Number(process.env.ARO_GUARD_SESSION_CALLS) } : {}) };
    const guard = createSpendGuard({ redis: memoryStore(), limits });
    const both = {
      startSession: ip => guard.startSession(ip),
      async reserve(op, usd, model, ctx) {
        const a = await ledger.reserve(op, usd, model);
        try { return JSON.stringify({ a, b: await guard.reserve(op, usd, model, ctx) }); }
        catch (error) { await ledger.settle(a, { notBilled: true, reason: "guard-refused" }); throw error; }
      },
      async settle(id, result) { const { a, b } = JSON.parse(id); await ledger.settle(a, result); await guard.settle(b, result); },
    };
    experienceHandler = createExperienceHandler({ guard: both, secret: "local-prod-sim", verifyBot: async () => true, rateLimit: async () => ({ ok: true }),
      callModel: body => client.messages.create(body), analyzeModel: "claude-sonnet-5-5", model: "claude-opus-5-5" });
    // The resume diagnosis runs its production handler too, reserving in the same ledger and in-memory guard.
    const { createDiagnoseHandler } = await import("../api/diagnose.js");
    diagnoseHandler = createDiagnoseHandler({ guard: both, verifyBot: async () => true, rateLimit: async () => ({ ok: true }), makeClient: () => client });
  } else experienceHandler = createExperienceHandler({ ledger, model: MODEL, callModel: body => client.messages.create(body),
    verifyBot: async () => false, rateLimit: async () => ({ ok: true }), requireFictional: !OWN_EXPERIENCE,
    // ARO_DEBUG_DIR keeps raw model answers of test calls for diagnosis. Off unless set.
    onRaw: process.env.ARO_DEBUG_DIR ? async (op, text) => { const { writeFile } = await import("node:fs/promises");
      await writeFile(path.join(process.env.ARO_DEBUG_DIR, `${Date.now()}-${op}.json`), text); } : null });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    request.on("data", c => { size += c.length; if (size > 64 * 1024) { reject(new Error("too-large")); request.destroy(); } else chunks.push(c); });
    request.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(e); } });
  });
}
// Minimal Vercel-style res helpers for the shared handler.
function vercelRes(res) {
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(body)); return res; };
  return res;
}

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  if (clean.includes("..")) return null;
  for (const candidate of [clean, clean + ".html", path.posix.join(clean, "index.html")]) {
    const file = path.join(ROOT, candidate);
    if (!file.startsWith(ROOT)) return null;
    try { if ((await stat(file)).isFile()) return file; } catch { /* next */ }
  }
  return null;
}

http.createServer(async (req, res) => {
  const url = req.url || "/";
  if (url.startsWith("/api/")) {
    if (url.split("?")[0] === "/api/experience" && experienceHandler) {
      try { req.body = await readJson(req); } catch { return vercelRes(res).status(400).json({ error: "bad-json" }); }
      return experienceHandler(req, vercelRes(res));
    }
    if (url.split("?")[0] === "/api/diagnose" && diagnoseHandler) {
      try { req.body = await readJson(req); } catch { return vercelRes(res).status(400).json({ error: "bad-json" }); }
      return diagnoseHandler(req, vercelRes(res));
    }
    if (url.startsWith("/api/experience")) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(503, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "로컬 검증 서버는 운영 API를 호출하지 않습니다." }));
    return;
  }
  const file = await resolveFile(url === "/" ? "/index.html" : url);
  if (!file) { res.writeHead(404).end("Not found"); return; }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(await readFile(file));
}).listen(PORT, "127.0.0.1", () => console.log(`ARO local site: http://127.0.0.1:${PORT}/ · experience API ${PROD_SIM ? "PRODUCTION PATH (simulated Turnstile/Redis, mixed models, shared ledger)" : AI ? `TEST MODE (${OWN_EXPERIENCE ? "owner's own experience allowed" : "fictional only"}, shared ledger)` : "off (rule-based engine)"}`));
