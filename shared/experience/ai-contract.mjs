// Request/response contract for the AI engine. The server builds prompts only from these structured fields,
// and every model answer is re-checked here before the browser sees it.
import { ITEM_KINDS, normalizeText, verifyItems, verifyComposedLines, repeatsAskedQuestion, claimIssues, questionSimilarity } from './evidence.mjs';
import { plannedNextQuestion } from './local-engine.mjs';

export const MODEL = 'claude-opus-5-5';
export const MAX_QUESTIONS = 6;
// Fewer questions than this rarely reach the decision, its standard and what was confirmed.
export const MIN_QUESTIONS = 3;
export const NEUTRAL_QUESTION = '이 경험에서 어떤 일을 했고, 어떻게 판단했는지 말씀해 주세요.';
export const LIMITS = { totalChars: 12000, sources: 20, items: 40 };
export const FICTIONAL_MARKER = '[가상';
const SLOTS = ['action', 'focus', 'criterion', 'alignment', 'result', 'role', 'situation', 'other'];

const ANALYZE_SYSTEM = `You help a Korean job seeker understand one work experience in their own words, so they can later use it in a resume and an interview. You read only the sources given in the user message (the story, their answers, and their own corrections). You are not evaluating the person.

Extract items:
- kinds: role (scope I was responsible for), action (what I did myself), judgment (why I chose or what I weighed), criterion (a standard or rule I applied when deciding), situation (context, constraints, what others did), result (an outcome the user says they actually saw or heard).
- Each item needs at least one evidence quote copied character-for-character from one source: contiguous, 2–80 characters, no ellipses, no edits. Give that source's id.
- text: a short, neutral Korean restatement (명사형 or 개조식) that adds nothing beyond the quotes.
- basis "stated" only when the source says it directly. Use "interpretation" when you infer it (for example an unspoken criterion); interpretations still need supporting quotes and the user will confirm them.
- What other people did is situation, not the user's action. Effort or feelings ("최선을 다했다", "힘들었다") are not results. Intentions ("~하기 위해") are judgment, not results.
- Answers marked unknown or skipped are not facts. Never create items from them.
- Do not output items listed in excluded_by_user. Reuse previous_items ids when the same item persists; otherwise use new ids like "i12".
- Aim for 4–14 items. Prefer the specific experience over general background.

Form a working angle (how a careful hiring evaluator would read this experience):
- angle.text: one Korean sentence (≤ 50 characters) naming what this experience shows about how the person works — the decision, standard or approach that stands out. Describe behaviour, not a trait label ("처음 맡은 행사에서 예산 기준을 정해 부서별 요청을 조정함", not "문제해결력"). Use only what the sources support; list the itemIds it rests on.
- The angle is a hypothesis. The questions exist to confirm, correct or sharpen it.
- Outcome words (개선, 향상, 효율화, 최적화, 성공, 성과, 달성, 절감, 기여, 만족, 단축, 극대화) only if the person's own words contain them; "제안함" is not "개선함".

Choose the next question (at most one):
- Ask what an experienced evaluator would ask next to trust the angle. Usually: the criterion behind the key decision → how the person handled the other people involved → what they actually confirmed afterwards (result or reaction) → why this was theirs to do, if that is unclear.
- Never ask something already in already_asked, already answered in the sources, or marked unknown/skipped. A "don't remember" closes only that one question; keep going with the next most useful one.
- Do not anchor a question on the same quoted words as an earlier question. Ask only what would change the resume line or the interview answer.
- If the latest answer mostly repeated facts already known, set ask=false.
- Quote the user's own words with ‘…’ when pointing at something. One question about ONE thing (never two asks joined by “and” or “,”), at most 70 characters, plain polite Korean (존댓말), no jargon such as STAR or 역량.
- why: one Korean sentence (≤ 80 characters) saying why an evaluator cares about this.
- choices: up to 7 short options copied from the user's words when the answer is a pick among their own items; otherwise [].
- Set ask=false when the angle is supported by a decision with its criterion and by what the person did, and results are known or marked unknown; or when further questions would mostly repeat. Three or four good questions are usually enough.

title: a short name for this experience (≤ 20 characters) using the user's words.`;

const COMPOSE_SYSTEM = `You are an experienced Korean hiring evaluator and career consultant. From verified items about one work experience, write the sheet a consultant hands over at the end: what the experience shows, where to use it, ready-to-paste resume lines, a spoken interview answer, what evaluators will ask next, wording risks, and what is still missing. Use only the given items (each has an id, kind, text and the user's original quote). Write in natural, professional Korean.

- headline: one sentence (≤ 50 characters) — what this experience shows about how the person works, from an evaluator's view. Describe behaviour and judgment, not trait labels. itemIds it rests on. If a confirmed_angle is given, follow it.
  Plain 개조식 ending in ~함; no comparative particles such as "도" or "까지" (Bad: "처음 맡은 행사도 …", Good: "처음 맡은 행사에서 …").
- use_for: 2–3 short items: interview questions or situations where this experience is the right answer (e.g. "낯선 업무를 맡았을 때 어떻게 했나요?"). Do not judge fit for any specific job or company.
- resume: 2–3 bullet lines of polished Korean 개조식 that the person can paste into the 경력 section of a resume without editing. At most 70 characters per line. Write the way a Korean HR evaluator wants to read: plain verbs, no stacked nominalisations.
  Each line stands alone as one contribution: the problem or purpose (only as the items state it) → what the person did (and the result, only if an item states it). Never split one story into chronological steps (trigger → step 1 → step 2); merge the steps into the contribution they served. The first line carries the core contribution, not the event that started it.
  No subject words: never 내, 내가, 제가, 나는, 저는 — a resume line has no subject.
  All lines end the same way: a plain action noun (제작, 정리, 수립, 공유, 처리). Never end with 받음, 함, 했음, or a mix of forms.
  Join clauses with written connectors (~하고, ~해, ~한 뒤), never spoken past-tense ones (~했고, ~했는데, ~해서 결국). No spoken adverbs (결국, 그래서, 바로, 다).
  Spoken or vague wording from the quotes (몇 건, 좀, 다시 찾아) becomes neutral written wording without adding facts (Bad: "초안을 몇 건에 써보고", Good: "초안을 실제 요청에 시범 적용"). Never turn a vague amount into a number.
  Bad: "규정에 대한 판단의 적정성 여부를 확인하고 의견을 정리해 처리"
  Good: "규정 해석이 맞는지 담당 부서에 재확인한 뒤 처리"
  Bad (steps of one story, mixed endings): "접수 누락이 생기자 지난 신청서를 다시 찾아 빠진 정보를 확인" / "담당 부서에 필요한 정보를 묻고 양식 제작" / "초안을 몇 건에 써보고 확인받음"
  Good: "접수 누락을 막기 위해 담당 부서와 필수 정보·기한을 정해 신청 양식 제작" / "새 양식을 실제 신청에 시범 적용하고 담당 부서와 함께 점검"
  Never write "~여부"; say what was checked as a clause ("~하는지", "~맞는지").
  Every line says what the person did; the situation goes inside a line, never as a line of its own (Bad: "납품이 2주 지연될 상황에 처함").
  Bad: "일정 준수 여부와 비용 적정 여부를 기준으로 강사 섭외"
  Good: "일정을 지킬 수 있는지, 비용이 예산 안인지를 기준으로 강사 섭외"
  Each line lists its itemIds.
- interview.question: a neutral likely question. interview.script: 3–4 spoken sentences in first person, 존댓말, 250–320 Korean characters in total (about 40 seconds): situation → the standard I used → how I handled others → what I confirmed. Keep only what answers the question; the full task list belongs in the resume lines. Each sentence lists its itemIds.
- follow_ups: 2 questions an evaluator would likely ask next, aimed at the weakest point. Each question asks ONE thing in one sentence (never two questions in one). Each has point: how to answer using only the person's facts. If the needed fact is missing, say to answer honestly with what is known.
- cautions: 0–2 places where the person's own wording would actually make an evaluator hesitate (blaming others, sounding like a complaint, claiming sole credit, exaggeration). A plain factual description (e.g. "사람마다 확인 방식이 달랐다") is not a risk. Returning none is fine. quote: the exact words from an item's quote; why: the risk; instead: a fact-only way to say it, in first person 존댓말.
  The instead line may restate only facts in the items. Do not supply a reason, motive or circumstance the person never gave (no "총무 업무라서", "제 역할이라서"). When the real reason is unknown, say only what happened.
  Bad instead: "제 담당 업무라서 제가 맡게 되었습니다." (adds a reason)
  Good instead: "관련 부서가 여럿 있었지만, 이 업무는 제가 맡아 진행했습니다." 
- strengthen: 1–3 concrete facts that are still missing and would make this stronger (e.g. whether it finished on budget), written as short prompts the person can answer later. Include unknown_or_skipped questions here when relevant.
- Never add numbers, outcomes, quality judgments (성공적, 효과적, 탁월한) or facts that are not in the items. In headline, resume and script, do not use these words unless an item's quote contains them: 개선, 향상, 효율화, 최적화, 성공, 성과, 달성, 절감, 기여, 만족, 단축, 극대화. "제안함" is not "개선함". Words such as 주도 or 총괄 only if the user's quotes say so. If no result item exists, do not imply one.
- Do not add details the quotes do not contain: whose, where, how many, for whom, how often.
- Keep who decided. When the sources say a plan was made with others or approved by someone else, say so; never write 제가 택했/결정했/주도/맡아 해결 unless the person's quotes say exactly that.
- Keep the person's meaning. Professional restatement is fine; changing facts is not.
- Every advice text (point, why, strengthen) speaks to the person directly in polite Korean (~세요). Never mention internal words such as 항목, item, source, 데이터, 입력; say "적어 주신 내용", "아직 적지 않은 부분" instead.`;

const VERIFY_SYSTEM = `You are a strict fact-checker for a Korean resume and interview sheet written about one person's work experience. Each statement comes with the person's own quotes it is based on.

A statement may restate the quotes in professional Korean. It must not add anything the quotes do not say:
- who decided or owned something (e.g. "제가 택했다", "주도", "맡아 해결") when the quotes show others decided, approved or did it together, or do not say;
- quantities, scope words ("모두", "직접", "전부") or details (whose, where, how many) that are not in the quotes;
- causes or effects ("분할 납품으로 계약 유지", "그래서 줄었다") that the quotes do not state as cause and effect;
- a specific fact widened into a general method or principle (quote "자주 묻는 질문을 마지막 장에 모았다" → statement "자주 묻는 질문을 기준으로 교육 내용을 구성함" is unsupported; "자주 묻는 질문을 자료 마지막 장에 따로 정리함" is faithful);
- motives, results, evaluations or praise.

Some statements also carry style_issues: wording problems found by rules (a subject word, a spoken or mixed ending, a vague amount, "여부", too long). For those, return "fix" with a sentence that keeps exactly the same facts and resolves every listed issue; never add facts to do so. A resume line ends with a plain action noun (제작, 정리, 확인, 공유); a vague amount (몇 건) becomes neutral wording without a number (실제 요청에 시범 적용).

For each statement return verdict "ok" (faithful), "fix" (give the minimally corrected sentence in the same style and length, removing only what is unsupported), or "drop" (nothing faithful remains). reason: a short Korean note on what was unsupported ("" when ok).`;

export const VERIFY_SCHEMA = { type: 'object', additionalProperties: false, required: ['checks'],
  properties: { checks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'verdict', 'text', 'reason'],
    properties: { id: { type: 'string' }, verdict: { type: 'string', enum: ['ok', 'fix', 'drop'] }, text: { type: 'string' }, reason: { type: 'string' } } } } } };

// Rule-checkable wording problems that keep a line from being pasted as-is. The verify pass rewrites lines that have them.
const STYLE_RULES = [
  { pattern: /(?:^|\s)(?:내가|제가|나는|저는|내|제)(?=\s)/u, issue: '주어(내가·제가)가 들어 있음', on: ['resume'] },
  { pattern: /(?:받음|했음|하였음|였음|됨|만듦|함|음|요|다)[.。]?$/u, issue: '끝맺음이 행동 명사(제작·정리·확인)가 아님', on: ['resume'] },
  { pattern: /몇\s*(?:건|번|개|명|군데)/u, issue: '"몇 건"처럼 모호한 양', on: ['resume', 'headline'] },
  { pattern: /여부/u, issue: '"여부" 사용', on: ['resume', 'headline'] },
  { pattern: /했고|했는데|결국|그래서/u, issue: '말투 연결어', on: ['resume', 'headline'] },
];
export function styleIssues(text, kind) {
  const t = normalizeText(text);
  const found = STYLE_RULES.filter(r => r.on.includes(kind) && r.pattern.test(t)).map(r => r.issue);
  if (kind === 'headline' && t.length > 50) found.push('50자를 넘음');
  return found;
}

// The statements of a sheet that speak about the person, each with the quotes behind it.
export function statementsOf(card, items) {
  const quotesFor = ids => [...new Set(ids.map(id => items.find(i => i.id === id)).filter(Boolean).flatMap(i => i.evidence.map(e => e.quote)))];
  const rows = [];
  const withStyle = (row, kind) => { const issues = styleIssues(row.text, kind); return issues.length ? { ...row, style_issues: issues } : row; };
  if (card.headline?.itemIds?.length) rows.push(withStyle({ id: 'h', text: card.headline.text, quotes: quotesFor(card.headline.itemIds) }, 'headline'));
  card.resume.forEach((l, i) => rows.push(withStyle({ id: 'r' + i, text: l.text, quotes: quotesFor(l.itemIds) }, 'resume')));
  card.interview.lines.forEach((l, i) => rows.push({ id: 's' + i, text: l.text, quotes: quotesFor(l.itemIds) }));
  return rows;
}

export function buildVerifyRequest(card, items) {
  const content = JSON.stringify({ statements: statementsOf(card, items) }, null, 1);
  return { system: VERIFY_SYSTEM, messages: [{ role: 'user', content }], schema: VERIFY_SCHEMA, maxTokens: 4000 };
}

// Apply the checks: fixed lines must still pass the outcome/number rules; dropped lines are kept aside with the reason.
export function applyVerification(card, raw, items) {
  const byId = new Map((raw?.checks || []).map(c => [c.id, c]));
  const usable = new Map(items.map(i => [i.id, i]));
  const held = [...(card.held || [])];
  let fixed = 0, dropped = 0;
  const review = (line, id) => {
    const check = byId.get(id);
    if (!check || check.verdict === 'ok') return line;
    if (check.verdict === 'drop' || !normalizeText(check.text)) { dropped++; held.push({ text: line.text, reason: '검수: ' + (normalizeText(check.reason) || '원문에 없는 내용') }); return null; }
    const text = normalizeText(check.text);
    const issues = claimIssues(text, line.itemIds.map(x => usable.get(x)).filter(Boolean));
    if (issues.length) { dropped++; held.push({ text, reason: '검수 후에도 ' + issues.join(', ') }); return null; }
    fixed++;
    return { ...line, text, checked: normalizeText(check.reason) };
  };
  const headline = card.headline?.itemIds?.length ? review(card.headline, 'h') : card.headline;
  const resume = card.resume.map((l, i) => review(l, 'r' + i)).filter(Boolean);
  const lines = card.interview.lines.map((l, i) => review(l, 's' + i)).filter(Boolean);
  return { ...card, headline: headline || null, resume, interview: { ...card.interview, lines }, held, verification: { fixed, dropped } };
}

const evidenceSchema = { type: 'object', additionalProperties: false, required: ['sourceId', 'quote'],
  properties: { sourceId: { type: 'string' }, quote: { type: 'string' } } };
const refSchema = { type: 'object', additionalProperties: false, required: ['text', 'itemIds'],
  properties: { text: { type: 'string' }, itemIds: { type: 'array', items: { type: 'string' } } } };
export const ANALYZE_SCHEMA = { type: 'object', additionalProperties: false, required: ['title', 'items', 'angle', 'nextQuestion'],
  properties: {
    title: { type: 'string' },
    items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'kind', 'text', 'basis', 'evidence'],
      properties: { id: { type: 'string' }, kind: { type: 'string', enum: ITEM_KINDS }, text: { type: 'string' },
        basis: { type: 'string', enum: ['stated', 'interpretation'] }, evidence: { type: 'array', items: evidenceSchema } } } },
    angle: refSchema,
    nextQuestion: { type: 'object', additionalProperties: false, required: ['ask', 'slot', 'aboutItemId', 'text', 'why', 'choices'],
      properties: { ask: { type: 'boolean' }, slot: { type: 'string', enum: SLOTS }, aboutItemId: { type: 'string' },
        text: { type: 'string' }, why: { type: 'string' }, choices: { type: 'array', items: { type: 'string' } } } },
  } };
const strings = { type: 'array', items: { type: 'string' } };
export const COMPOSE_SCHEMA = { type: 'object', additionalProperties: false,
  required: ['headline', 'use_for', 'resume', 'interview', 'follow_ups', 'cautions', 'strengthen'],
  properties: {
    headline: refSchema, use_for: strings, resume: { type: 'array', items: refSchema },
    interview: { type: 'object', additionalProperties: false, required: ['question', 'script'],
      properties: { question: { type: 'string' }, script: { type: 'array', items: refSchema } } },
    follow_ups: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['question', 'point'],
      properties: { question: { type: 'string' }, point: { type: 'string' } } } },
    cautions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['quote', 'why', 'instead'],
      properties: { quote: { type: 'string' }, why: { type: 'string' }, instead: { type: 'string' } } } },
    strengthen: strings,
  } };

// Shape and size checks for every request. In test mode only explicitly fictional stories may leave the machine
// (the approved AI test covers fictional experiences only).
export function checkPayload(op, payload, { requireFictional = false } = {}) {
  if (!['analyze', 'compose'].includes(op)) return 'unknown-op';
  if (!payload || typeof payload !== 'object') return 'bad-payload';
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  const story = sources.find(source => source.kind === 'story');
  if (!story) return 'no-story';
  if (sources.length > LIMITS.sources || (payload.items || []).length > LIMITS.items) return 'too-many-parts';
  if (sources.some(source => typeof source.id !== 'string' || typeof source.text !== 'string')) return 'bad-source';
  if (JSON.stringify(payload).length > LIMITS.totalChars * 2) return 'too-long';
  if (requireFictional && (payload.fictional !== true || !normalizeText(story.text).startsWith(FICTIONAL_MARKER))) return 'not-fictional';
  return null;
}

function experienceBlock(payload) {
  return {
    selected_work: normalizeText(payload.scopeTitle || ''),
    sources: payload.sources.map(source => ({ id: source.id, kind: source.kind, ...(source.question ? { question: source.question } : {}),
      ...(source.itemKind ? { correction_for_kind: source.itemKind } : {}), text: source.text })),
    unknown_or_skipped: (payload.unanswered || []).map(row => ({ slot: row.slot, question: row.question, status: row.status })),
  };
}

export function buildAnalyzeRequest(payload) {
  const content = JSON.stringify({ ...experienceBlock(payload),
    already_asked: (payload.asked || []).map(row => row.text),
    excluded_by_user: (payload.excluded || []).map(row => ({ kind: row.kind, text: row.text })),
    previous_items: (payload.previousItems || []).map(row => ({ id: row.id, kind: row.kind, text: row.text })),
    questions_left: Math.max(0, MAX_QUESTIONS - (payload.asked || []).length) }, null, 1);
  return { system: ANALYZE_SYSTEM, messages: [{ role: 'user', content }], schema: ANALYZE_SCHEMA, maxTokens: 6000 };
}

export function buildComposeRequest(payload) {
  const content = JSON.stringify({ selected_work: normalizeText(payload.scopeTitle || ''), experience_title: normalizeText(payload.title || ''),
    ...(normalizeText(payload.angle) ? { confirmed_angle: normalizeText(payload.angle) } : {}),
    items: (payload.items || []).map(item => ({ id: item.id, kind: item.kind, text: item.text, quote: item.evidence?.map(e => e.quote).join(' / ') })),
    unknown_or_skipped: (payload.unanswered || []).map(row => ({ question: row.question, status: row.status })) }, null, 1);
  return { system: COMPOSE_SYSTEM, messages: [{ role: 'user', content }], schema: COMPOSE_SCHEMA, maxTokens: 7000 };
}

// The words a question points at with ‘…’. Two questions on the same words usually ask the same thing twice.
const anchorsOf = text => [...String(text).matchAll(/‘([^’]{2,40})’/gu)].map(match => normalizeText(match[1]));
export function reusesAnchor(text, asked) {
  const anchors = anchorsOf(text);
  return anchors.length > 0 && asked.some(row => anchorsOf(row.text).some(a => anchors.includes(a)));
}

export function acceptAnalysis(raw, payload) {
  const sources = payload.sources;
  const { accepted, rejected } = verifyItems((raw.items || []).map(item => ({ ...item, origin: 'ai' })), sources);
  const asked = payload.asked || [];
  const closedSlots = new Set((payload.unanswered || []).map(row => row.slot));
  let nextQuestion = null, questionNote = null;
  const q = raw.nextQuestion;
  if (q?.ask && normalizeText(q.text)) {
    const about = accepted.find(item => item.id === q.aboutItemId);
    const candidate = { slot: q.slot, aboutKey: about?.key || '', text: normalizeText(q.text), why: normalizeText(q.why),
      choices: (q.choices || []).map(normalizeText).filter(Boolean).slice(0, 7) };
    if (asked.length >= MAX_QUESTIONS) questionNote = 'question-limit';
    else if (repeatsAskedQuestion(candidate, asked) || reusesAnchor(candidate.text, asked)) questionNote = 'question-repeated';
    else if (q.slot !== 'other' && closedSlots.has(q.slot)) questionNote = 'question-about-unknown';
    else nextQuestion = candidate;
  }
  // The model sometimes stops after one or two questions; the rule-based plan asks for what is still missing.
  if (!nextQuestion && asked.length < MIN_QUESTIONS) {
    const fallback = plannedNextQuestion({ items: accepted, askedSlots: new Set(asked.map(row => row.slot)), sources });
    if (fallback && !repeatsAskedQuestion(fallback, asked)) {
      nextQuestion = { slot: fallback.slot, aboutKey: fallback.aboutKey || '', text: fallback.text, why: fallback.why, choices: fallback.choices || [] };
      questionNote = 'rule-fallback';
    }
  }
  // The working angle is shown only while it rests on items that survived verification.
  const angleIds = (raw.angle?.itemIds || []).filter(id => accepted.some(item => item.id === id));
  const angle = normalizeText(raw.angle?.text) && angleIds.length ? { text: normalizeText(raw.angle.text).slice(0, 80), itemIds: angleIds } : null;
  return { engine: 'ai', items: accepted, rejected: rejected.map(row => ({ reason: row.reason, text: normalizeText(row.item?.text) })),
    angle, nextQuestion, done: !nextQuestion, questionNote, suggestedTitle: normalizeText(raw.title).slice(0, 30) || null };
}

const short = (value, max) => normalizeText(value).slice(0, max);

// Statements about the person (headline, resume, script) must rest on items and add no outcome or number.
// Advice (use_for, follow_ups, strengthen) is shown as advice; a caution must quote the person's real words.
// Wording an evaluator reliably minds. Found in the person's own text; added when the model's cautions missed it.
const RISKY_WORDING = [
  { pattern: /(?:제가|내가)\s*(?:다|전부|혼자\s*다)\s*(?:해결|했|처리|맡)[가-힣]*|(?:모두|전부)\s*(?:제가|내가)\s*(?:다\s*)?(?:했|해결|처리|맡)[가-힣]*|혼자(?:서)?\s*다\s*[가-힣]+/u,
    why: '함께한 사람이 있는 일을 혼자 해낸 것처럼 들려 과장으로 읽힐 수 있어요.', instead: '함께한 사람과 내가 맡은 부분을 나눠서 말해 보세요.' },
  { pattern: /(?:그들|걔네|저들)[이가은는도]?[^.!?\n]{0,30}(?:싫어|안\s*해|바빠|바쁘|떠넘|탓)[가-힣]*/u,
    why: '다른 사람이나 부서를 탓하는 불만처럼 들릴 수 있어요.', instead: '다른 사람의 사정 대신, 내가 맡게 된 사실만 말해 보세요.' },
  { pattern: /1도\s*모르[가-힣]*|하나도\s*모르[가-힣]*|개(?:빡|고생)|빡세|미친듯/u,
    why: '면접에서는 가볍게 들릴 수 있는 구어 표현이에요.', instead: '경험이 없어 하나씩 배워 가며 진행했다고 말해 보세요.' },
];
export function wordingRisks(sources, cautions) {
  const found = [];
  for (const source of sources) for (const rule of RISKY_WORDING) {
    const match = normalizeText(source.text).match(rule.pattern);
    if (!match) continue;
    const quote = match[0];
    const covered = [...cautions, ...found].some(c => normalizeText(c.quote).includes(quote) || quote.includes(normalizeText(c.quote)));
    if (!covered) found.push({ quote, why: rule.why, instead: rule.instead, origin: 'rule' });
  }
  return found;
}

// A line that says nearly the same as an earlier one adds nothing for the reader.
export function withoutRepeats(lines) {
  const kept = [], repeated = [];
  const squash = t => normalizeText(t).replace(/[\s·,.]/g, '');
  const same = (a, b) => questionSimilarity(a, b) >= 0.6 || squash(a).includes(squash(b)) || squash(b).includes(squash(a));
  for (const line of lines) (kept.some(other => same(other.text, line.text)) ? repeated : kept).push(line);
  return { kept, held: repeated.map(line => ({ text: line.text, reason: '앞 문장과 거의 같아요' })) };
}

export function acceptComposition(raw, payload) {
  const usable = payload.items || [];
  const headline = verifyComposedLines(raw.headline ? [raw.headline] : [], usable);
  const resumeChecked = verifyComposedLines(raw.resume, usable), resumeUnique = withoutRepeats(resumeChecked.kept);
  const scriptChecked = verifyComposedLines(raw.interview?.script, usable), scriptUnique = withoutRepeats(scriptChecked.kept);
  const resume = { kept: resumeUnique.kept, held: [...resumeChecked.held, ...resumeUnique.held] };
  const script = { kept: scriptUnique.kept, held: [...scriptChecked.held, ...scriptUnique.held] };
  // The question may not presuppose an outcome the user never stated ("개선한 경험을 말씀해 주세요").
  const asked = normalizeText(raw.interview?.question);
  const question = asked && !claimIssues(asked, []).length ? asked : NEUTRAL_QUESTION;
  const quotes = usable.flatMap(item => item.evidence.map(e => normalizeText(e.quote)));
  const cautions = (raw.cautions || []).filter(c => normalizeText(c.quote).length >= 2 && quotes.some(q => q.includes(normalizeText(c.quote))))
    .slice(0, 2).map(c => ({ quote: short(c.quote, 120), why: short(c.why, 160), instead: short(c.instead, 200) }));
  cautions.push(...wordingRisks(payload.sources || [], cautions).slice(0, 3 - cautions.length));
  // A headline that fails the check is replaced by the core message the person confirmed, never left as an unsupported claim.
  const confirmed = normalizeText(payload.angle);
  const headlineLine = headline.kept[0] || (confirmed && !claimIssues(confirmed, usable).length ? { text: confirmed, itemIds: [] } : null);
  return { engine: 'ai', headline: headlineLine, useFor: (raw.use_for || []).map(u => short(u, 80)).filter(Boolean).slice(0, 3),
    resume: resume.kept, interview: { question, lines: script.kept },
    followUps: (raw.follow_ups || []).filter(f => normalizeText(f.question)).slice(0, 2).map(f => ({ question: short(f.question, 120), point: short(f.point, 240) })),
    cautions, strengthen: (raw.strengthen || []).map(t => short(t, 120)).filter(Boolean).slice(0, 3),
    held: [...headline.held, ...resume.held, ...script.held] };
}
