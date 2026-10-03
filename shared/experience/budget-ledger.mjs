// One shared ledger for every AI test call. A call may start only after its worst-case cost is reserved
// and the total stays under the hard stop. Unknown or unreadable ledger state blocks the call.
import { mkdir, readFile, rename, rmdir, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

// Shared AI test budget. Used only when the server runs in test mode.
// Prices verified 2026-10-03 at https://platform.claude.com/docs/en/about-claude/pricing (USD per million tokens).
// US-only inference costs 1.1x. Applied always, so an account-level setting can never push spend above the estimate.
const MULTIPLIER = 1.1;
export const MODEL_PRICES = Object.freeze({
  'claude-opus-5-5': { input: 4, cacheWrite1h: 8, cacheRead: 0.2, output: 20 },
  'claude-sonnet-5-5': { input: 2, cacheWrite1h: 4, cacheRead: 0.2, output: 10 },
  'claude-haiku-4-5': { input: 1, cacheWrite1h: 2, cacheRead: 0.1, output: 5 },
});
export const PRICES = Object.freeze({ model: 'claude-opus-5-5', ...MODEL_PRICES['claude-opus-5-5'], multiplier: MULTIPLIER, verifiedAt: '2026-10-03',
  source: 'https://platform.claude.com/docs/en/about-claude/pricing' });
// Approved by the site owner: USD 2 (fictional only) → +1 (own experience) → 5 ("예산 신경쓰지 말고")
// → 15 ("돈을 더 써서라도 비교해보고 맞춰놔야지", model comparison and quality fixes), all 2026-10-03.
export const CAP_USD = 15;
export const HARD_STOP_USD = 14.9;
// A model without a verified price cannot be budgeted, so it cannot be called.
export function pricesFor(model = 'claude-opus-5-5') {
  const prices = MODEL_PRICES[model];
  if (!prices) throw new BudgetError('unknown-model-price', model);
  return prices;
}
// Fixed allowance for tokens the API adds around the request (system scaffolding, structured-output grammar).
const OVERHEAD_TOKENS = 3000;

export class BudgetError extends Error { constructor(code, detail) { super(code); this.code = code; this.detail = detail; } }

// Byte-level tokenizers never emit more tokens than UTF-8 bytes, so bytes + overhead is an upper bound.
export function worstCaseUsd(requestBody, maxTokens) {
  const p = pricesFor(requestBody.model);
  const inputTokens = Buffer.byteLength(JSON.stringify(requestBody), 'utf8') + OVERHEAD_TOKENS;
  // Price all input at the most expensive input rate (1h cache write) in case caching is ever applied.
  return round((inputTokens * p.cacheWrite1h + maxTokens * p.output) / 1e6 * MULTIPLIER);
}

export function actualUsd(usage, model = 'claude-opus-5-5') {
  const u = usage || {}, p = pricesFor(model);
  return round(((u.input_tokens || 0) * p.input + (u.cache_creation_input_tokens || 0) * p.cacheWrite1h
    + (u.cache_read_input_tokens || 0) * p.cacheRead + (u.output_tokens || 0) * p.output) / 1e6 * MULTIPLIER);
}
const round = value => Math.ceil(value * 1e6) / 1e6;

export function committedUsd(ledger) {
  return round(ledger.entries.reduce((sum, entry) => sum + (entry.status === 'settled' ? entry.actualUsd : entry.status === 'released' ? 0 : entry.reservedUsd), 0));
}

export function createLedger(file) {
  const lockDir = file + '.lock';
  async function withLock(work) {
    for (let attempt = 0; attempt < 100; attempt++) {
      try { await mkdir(lockDir); break; } catch (error) {
        if (error.code !== 'EEXIST') throw new BudgetError('ledger-unavailable', error.code);
        if (attempt === 99) {
          const age = Date.now() - (await stat(lockDir)).mtimeMs;
          // Never steal a lock: a crashed holder may have spent money we cannot see.
          throw new BudgetError('ledger-locked', Math.round(age / 1000) + 's');
        }
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    }
    try { return await work(); } finally { await rmdir(lockDir).catch(() => {}); }
  }
  async function read() {
    let text;
    try { text = await readFile(file, 'utf8'); } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw new BudgetError('ledger-unavailable', error.code);
    }
    let ledger;
    try { ledger = JSON.parse(text); } catch { throw new BudgetError('ledger-corrupt'); }
    if (ledger?.capUsd !== CAP_USD || !Array.isArray(ledger.entries)) throw new BudgetError('ledger-corrupt');
    return ledger;
  }
  async function write(ledger) {
    const temp = file + '.' + randomUUID() + '.tmp';
    await writeFile(temp, JSON.stringify(ledger, null, 2));
    await rename(temp, file);
  }
  return {
    file,
    async init() {
      return withLock(async () => {
        const existing = await read();
        if (existing) return existing;
        const ledger = { capUsd: CAP_USD, hardStopUsd: HARD_STOP_USD, prices: PRICES, createdAt: new Date().toISOString(),
          note: '가상 경험 AI 시험 전체의 공유 비용 원장. 삭제하거나 새로 만들지 말 것.', entries: [] };
        await write(ledger); return ledger;
      });
    },
    async summary() {
      const ledger = await read();
      if (!ledger) throw new BudgetError('ledger-missing');
      const committed = committedUsd(ledger);
      return { capUsd: CAP_USD, hardStopUsd: HARD_STOP_USD, committedUsd: committed, remainingUsd: round(Math.max(0, HARD_STOP_USD - committed)),
        calls: ledger.entries.length, settledUsd: round(ledger.entries.filter(e => e.status === 'settled').reduce((s, e) => s + e.actualUsd, 0)),
        openReservations: ledger.entries.filter(e => e.status === 'reserved').length };
    },
    async reserve(op, usd, model = 'claude-opus-5-5') {
      if (!(usd > 0)) throw new BudgetError('bad-estimate');
      return withLock(async () => {
        const ledger = await read();
        if (!ledger) throw new BudgetError('ledger-missing');
        const committed = committedUsd(ledger);
        if (committed + usd > HARD_STOP_USD) throw new BudgetError('budget-exhausted', { committedUsd: committed, neededUsd: usd });
        const entry = { id: randomUUID(), op, model, at: new Date().toISOString(), reservedUsd: usd, status: 'reserved' };
        ledger.entries.push(entry); await write(ledger); return entry.id;
      });
    },
    // usage present → bill what the API reported. Rejected before processing → nothing billed.
    // Anything else (timeout, network) → the reservation stays counted.
    async settle(id, { usage = null, notBilled = false, reason = '' } = {}) {
      return withLock(async () => {
        const ledger = await read();
        const entry = ledger?.entries.find(e => e.id === id);
        if (!entry) throw new BudgetError('ledger-entry-missing');
        if (usage) Object.assign(entry, { status: 'settled', actualUsd: actualUsd(usage, entry.model || 'claude-opus-5-5'), usage: pickUsage(usage) });
        else if (notBilled) Object.assign(entry, { status: 'released', reason });
        else Object.assign(entry, { status: 'kept', reason });
        entry.settledAt = new Date().toISOString();
        await write(ledger); return entry;
      });
    },
  };
}
const pickUsage = u => ({ input_tokens: u.input_tokens || 0, output_tokens: u.output_tokens || 0,
  cache_creation_input_tokens: u.cache_creation_input_tokens || 0, cache_read_input_tokens: u.cache_read_input_tokens || 0 });
