// Evidence rules shared by the browser, the local AI server and tests.
// An item may be shown or used only while its quoted words still exist in the user's current text.

export const ITEM_KINDS = ['role', 'action', 'judgment', 'criterion', 'situation', 'result'];
export const KIND_LABELS = {
  role: '맡은 범위', action: '직접 한 일', judgment: '판단·이유', criterion: '기준',
  situation: '상황·제약', result: '확인한 결과',
};

export const normalizeText = value => typeof value === 'string' ? value.replace(/\r\n?/g, '\n').replace(/\s+/g, ' ').trim() : '';
export const hasText = value => Boolean(normalizeText(value));

export function sourceById(sources, id) { return sources.find(source => source.id === id) || null; }

export function quoteExists(sources, sourceId, quote) {
  const source = sourceById(sources, sourceId), needle = normalizeText(quote);
  return Boolean(source && needle.length >= 2 && normalizeText(source.text).includes(needle));
}

// Stable identity across re-analysis: the kind plus the exact words it rests on, not an engine-chosen id.
export function itemKey(item) {
  const quotes = (item.evidence || []).map(e => e.sourceId + ':' + normalizeText(e.quote)).sort();
  return item.kind + '|' + quotes.join('|');
}

export function verifyItems(items, sources) {
  const accepted = [], rejected = [];
  for (const raw of Array.isArray(items) ? items : []) {
    if (!ITEM_KINDS.includes(raw?.kind) || !hasText(raw?.text)) { rejected.push({ item: raw, reason: 'invalid-shape' }); continue; }
    const evidence = (raw.evidence || []).filter(e => quoteExists(sources, e?.sourceId, e?.quote))
      .map(e => ({ sourceId: e.sourceId, quote: normalizeText(e.quote) }));
    if (!evidence.length) { rejected.push({ item: raw, reason: 'quote-not-in-source' }); continue; }
    const item = { id: raw.id, kind: raw.kind, text: normalizeText(raw.text), evidence,
      basis: raw.basis === 'interpretation' ? 'interpretation' : 'stated', origin: raw.origin || 'engine' };
    item.key = itemKey(item);
    if (accepted.some(other => other.key === item.key)) continue;
    accepted.push(item);
  }
  return { accepted, rejected };
}

// What the user decided about an item. Interpretations need an explicit yes before they are used.
export function itemDecision(item, reviews = {}) { return reviews[item.key]?.decision || null; }
export function isUsableItem(item, reviews = {}) {
  const decision = itemDecision(item, reviews);
  if (decision === 'excluded' || decision === 'replaced') return false;
  return item.basis === 'stated' || decision === 'confirmed';
}
export function needsConfirmation(item, reviews = {}) {
  return item.basis === 'interpretation' && !itemDecision(item, reviews);
}

// Outcome wording. A composed line may use it only when a cited item carries the same wording:
// a result the user says they saw, or an intention they stated (judgment). A negated or unchecked
// remark ("줄었는지는 세보지 않았어요") never licenses an outcome claim.
const OUTCOME_PATTERNS = [/줄(?:었|여|이|임|어|인)/u, /감소/u, /늘(?:었|려|림|어)/u, /증가/u, /향상/u, /개선/u, /단축/u, /절감/u, /효율/u,
  /성과/u, /성공/u, /달성/u, /만족/u, /호평/u, /칭찬/u, /인정받/u, /기여/u, /매출/u, /이익/u, /%|퍼센트/u, /최적/u, /극대화/u];
const UNCONFIRMED = /않았|않아|모르|몰라|모름|없었|없어|못 했|못했|확인 ?못|세보지|기억(?:이)? ?안|기억나지/u;

// "세 곳" in the user's words licenses "3곳" in a composed line, and the other way round.
const NATIVE = { 1: ['한', '하나', '일'], 2: ['두', '둘', '이'], 3: ['세', '셋', '삼'], 4: ['네', '넷', '사'], 5: ['다섯', '오'], 6: ['여섯', '육'], 7: ['일곱', '칠'], 8: ['여덟', '팔'], 9: ['아홉', '구'], 10: ['열', '십'] };
const COUNTERS = '(?:곳|명|개|번|가지|차례|건|회|달|시간|주|일|년|개월|분|군데|장|권|팀)';
function numberInQuotes(number, quotes) {
  if (quotes.includes(number)) return true;
  return (NATIVE[number] || []).some(word => new RegExp('(?:^|[^가-힣])' + word + ' ?' + COUNTERS, 'u').test(quotes));
}

export function claimIssues(line, citedItems) {
  let rest = normalizeText(line);
  for (const item of citedItems) for (const text of [item.text, ...item.evidence.map(e => e.quote)]) if (text) rest = rest.split(normalizeText(text)).join(' ');
  const issues = [];
  const quotes = citedItems.flatMap(item => item.evidence.map(e => e.quote)).join(' ');
  for (const number of rest.match(/\d+(?:[.,]\d+)?/g) || []) if (!numberInQuotes(number, quotes)) issues.push('숫자 ' + number);
  for (const pattern of OUTCOME_PATTERNS) {
    const found = rest.match(pattern);
    if (!found) continue;
    const licensed = citedItems.some(item => ['result', 'judgment'].includes(item.kind)
      && item.evidence.some(e => pattern.test(e.quote) && !(item.kind === 'result' && UNCONFIRMED.test(e.quote))));
    if (!licensed) issues.push('표현 ‘' + found[0] + '’');
  }
  return issues;
}

// Every composed line must rest on usable items and must not introduce numbers or outcome words.
export function verifyComposedLines(lines, usableItems) {
  const byId = new Map(usableItems.map(item => [item.id, item]));
  const kept = [], held = [];
  for (const line of Array.isArray(lines) ? lines : []) {
    const text = normalizeText(line?.text);
    const ids = [...new Set((line?.itemIds || []).filter(id => byId.has(id)))];
    if (!text) continue;
    if (!ids.length) { held.push({ text, reason: '연결된 근거가 없어요' }); continue; }
    const issues = claimIssues(text, ids.map(id => byId.get(id)));
    if (issues.length) { held.push({ text, reason: '근거 문장에 없는 ' + issues.join(', ') }); continue; }
    kept.push({ text, itemIds: ids });
  }
  return { kept, held };
}

// Questions are compared by their character pairs, so rewording a question that was already asked is caught too.
function bigrams(value) {
  const text = normalizeText(value).replace(/[\s?.!,·'"‘’“”]/g, '');
  const set = new Set();
  for (let i = 0; i < text.length - 1; i++) set.add(text.slice(i, i + 2));
  return set;
}
export function questionSimilarity(a, b) {
  const x = bigrams(a), y = bigrams(b);
  if (!x.size || !y.size) return 0;
  let shared = 0; for (const pair of x) if (y.has(pair)) shared++;
  return shared / (x.size + y.size - shared);
}
export function repeatsAskedQuestion(question, asked) {
  return asked.some(previous => (question.slot && previous.slot === question.slot && previous.aboutKey === question.aboutKey)
    || questionSimilarity(previous.text, question.text) >= 0.55);
}

export function hashState(value) {
  const text = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36) + '-' + text.length.toString(36);
}
