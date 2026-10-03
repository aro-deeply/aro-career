// 경험 정리 엔진 호출. 서버(/api/experience)가 있으면 AI 엔진, 없으면(로컬 개발 화면 등) 규칙 기반 엔진.
// 어느 엔진을 쓸지는 세션을 시작할 때 한 번 정하고, 한 경험 안에서 엔진을 섞지 않는다.
import { analyzeLocally, composeLocally } from "../../../shared/experience/local-engine.mjs";

let session = null; // { token, engine: 'ai' | 'local', testMode }

export class EngineError extends Error {
  constructor(code, message) { super(message || code); this.code = code; this.userMessage = message; }
}

async function post(body) {
  let response;
  try {
    response = await fetch("/api/experience", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new EngineError("network", "연결이 끊겼습니다. 잠시 후 다시 시도해 주세요.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // No experience endpoint here (static preview or local dev): the rule-based engine takes over.
    if (response.status === 404 || response.status === 405 || !data) throw new EngineError("no-endpoint");
    throw new EngineError(data.code || "error", data.error);
  }
  return data;
}

// Decides the engine once per page session. Consent is required before any text leaves the browser.
export async function startSession({ consent, turnstileToken }) {
  if (session) return session;
  try {
    const data = await post({ op: "session", consent, turnstileToken });
    session = { token: data.session, engine: "ai", testMode: Boolean(data.testMode) };
  } catch (error) {
    if (error.code !== "no-endpoint") throw error;
    session = { token: null, engine: "local", testMode: false };
  }
  return session;
}
export const currentEngine = () => session?.engine || null;

async function callAi(op, payload) {
  try {
    return (await post({ op, payload: { ...payload, fictional: session.testMode ? true : undefined }, session: session.token })).result;
  } catch (error) {
    if (error.code === "session") session = null; // expired: the next call starts a new one
    throw error;
  }
}

export async function analyze(engine, input) {
  if (engine === "local") return analyzeLocally(input);
  return callAi("analyze", { title: input.title, scopeTitle: input.scopeTitle, sources: input.sources, asked: input.asked,
    unanswered: input.unanswered, excluded: input.excluded, previousItems: input.previousItems });
}

export async function compose(engine, { title, scopeTitle, items, reviews, sources, answers, usable, angle, unanswered }) {
  if (engine === "local") return composeLocally({ title, items, reviews, sources, answers });
  return callAi("compose", { title, scopeTitle, sources, items: usable, angle, unanswered });
}
