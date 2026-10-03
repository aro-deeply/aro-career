// Experience notebook state for the diagnosis page: broad entry → picked work → story, answers, decisions, results.
// Pure functions; every change returns a new state. Earlier wording is kept as history, never deleted.
import { proposeScopes } from './scopes.mjs';
import { normalizeText, hasText, hashState, itemKey, KIND_LABELS } from './evidence.mjs';

export const NOTE_KEY = 'aro.diagnosis.experience.v1';
const clone = value => structuredClone(value);
const now = () => new Date().toISOString();

export function createNotebook() {
  return { version: 3, createdAt: now(), entry: { text: '', versions: [] }, entryDraft: null,
    scope: null, experiences: [], activeId: null, lastRoute: '#/start', nextId: 1, imported: null };
}
const newId = (state, prefix) => prefix + (state.nextId++);

export function activeExperience(state) { return experienceById(state, state.activeId); }
export function experienceById(state, id) { return state.experiences.find(exp => exp.id === id) || null; }

// ---- 1. Broad entry → candidate list ----
export function commitEntry(previous, text) {
  if (!hasText(text)) return previous;
  const state = clone(previous);
  if (state.entry.text && normalizeText(state.entry.text) !== normalizeText(text)) state.entry.versions.push({ text: state.entry.text, at: now() });
  state.entry.text = text; state.entryDraft = null;
  if (!state.scope || normalizeText(state.scope.basedOn) !== normalizeText(text)) {
    const proposal = proposeScopes(text);
    const previousCandidates = state.scope?.candidates || [];
    // Candidates the user added by hand survive an edit of the first text.
    const kept = previousCandidates.filter(c => c.origin === 'user-added');
    state.scope = { basedOn: text, kind: proposal.kind, candidates: [...proposal.candidates.map(c => ({ ...c, id: 'c-' + slug(c.title) })), ...kept] };
  }
  return state;
}
const slug = title => hashState(normalizeText(title));

export function hasSeveralCandidates(state) { return (state.scope?.candidates.length || 0) > 1; }

export function addCandidate(previous, title) {
  if (!hasText(title) || !previous.scope) return previous;
  const state = clone(previous);
  const id = 'c-' + slug(title);
  if (!state.scope.candidates.some(c => c.id === id)) state.scope.candidates.push({ id, title: normalizeText(title), evidence: '', origin: 'user-added' });
  return state;
}

export function experiencesForCandidate(state, candidateId) { return state.experiences.filter(exp => exp.scopeId === candidateId); }

// Picking a candidate opens its most recent experience, or starts one. Experiences of other candidates are untouched.
export function pickCandidate(previous, candidateId) {
  const candidate = previous.scope?.candidates.find(c => c.id === candidateId)
    || (candidateId === 'whole' && previous.entry.text ? { id: 'whole', title: normalizeText(previous.entry.text).slice(0, 40), evidence: previous.entry.text } : null);
  if (!candidate) return previous;
  const existing = experiencesForCandidate(previous, candidate.id).at(-1);
  if (existing) return { ...clone(previous), activeId: existing.id };
  return startExperience(previous, { scopeId: candidate.id, scopeTitle: candidate.title, scopeEvidence: candidate.evidence || '' });
}

export function startExperience(previous, { scopeId, scopeTitle, scopeEvidence = '', mode = null, story = '' }) {
  const state = clone(previous);
  const exp = { id: newId(state, 'e'), createdAt: now(), mode, scopeId, scopeTitle, scopeEvidence,
    title: '', titleByUser: false, story: { text: '', versions: [] }, answers: [], notes: [], reviews: {},
    analysis: null, result: null, drafts: story ? { story } : {} };
  state.experiences.push(exp); state.activeId = exp.id;
  return state;
}

// One experience is organised by one engine from start to finish, so results never mix rule-based and AI items.
export function assignEngine(previous, expId, engine) {
  const exp = experienceById(previous, expId);
  if (!exp || exp.mode || !['ai', 'local'].includes(engine)) return previous;
  const state = clone(previous);
  experienceById(state, expId).mode = engine;
  return state;
}

export function recordConsent(previous) {
  return previous.consentAt ? previous : { ...clone(previous), consentAt: now() };
}

// ---- 2. The story and answers (the user's own words) ----
export function commitStory(previous, expId, text) {
  if (!hasText(text)) return previous;
  const state = clone(previous), exp = experienceById(state, expId);
  if (!exp) return previous;
  if (exp.story.text && normalizeText(exp.story.text) !== normalizeText(text)) exp.story.versions.push({ text: exp.story.text, at: now() });
  exp.story.text = text; delete exp.drafts.story;
  return state;
}

export function answerQuestion(previous, expId, question, { text = '', status = 'answered' } = {}) {
  if (status === 'answered' && !hasText(text)) return previous;
  const state = clone(previous), exp = experienceById(state, expId);
  if (!exp || !question) return previous;
  // A repeated click on the same question must not create a second answer.
  if (exp.answers.some(a => a.slot === question.slot && a.question === question.text)) return previous;
  exp.answers.push({ id: newId(state, 'a'), slot: question.slot, aboutKey: question.aboutKey || '', question: question.text, why: question.why || '',
    text: status === 'answered' ? text : '', status, versions: [], at: now() });
  delete exp.drafts.answer;
  return state;
}

// Editing keeps every earlier wording; only the current text feeds the engine and results.
export function editAnswer(previous, expId, answerId, text) {
  const state = clone(previous), answer = experienceById(state, expId)?.answers.find(a => a.id === answerId);
  if (!answer) return previous;
  const status = hasText(text) ? 'answered' : answer.status;
  if (answer.text === text && answer.status === status) { delete experienceById(state, expId).drafts['answer:' + answerId]; return state; }
  answer.versions.push({ text: answer.text, status: answer.status, at: now() });
  Object.assign(answer, { text: hasText(text) ? text : answer.text, status });
  delete experienceById(state, expId).drafts['answer:' + answerId];
  return state;
}

export function markAnswer(previous, expId, answerId, status) {
  if (!['unknown', 'skipped'].includes(status)) return previous;
  const state = clone(previous), answer = experienceById(state, expId)?.answers.find(a => a.id === answerId);
  if (!answer || answer.status === status) return previous;
  answer.versions.push({ text: answer.text, status: answer.status, at: now() });
  answer.status = status;
  return state;
}

export function renameExperience(previous, expId, title) {
  if (!hasText(title)) return previous;
  const state = clone(previous), exp = experienceById(state, expId);
  exp.title = normalizeText(title); exp.titleByUser = true; delete exp.drafts.title;
  return state;
}

// ---- 3. Decisions about extracted items ----
export function reviewItem(previous, expId, key, decision) {
  const state = clone(previous), exp = experienceById(state, expId);
  if (!exp) return previous;
  if (decision === null) delete exp.reviews[key];
  else if (['confirmed', 'excluded'].includes(decision)) exp.reviews[key] = { decision, at: now() };
  return state;
}

// Rewording an item turns the new words into the user's own note; the original item is set aside, not deleted.
export function rewordItem(previous, expId, item, text) {
  if (!hasText(text)) return previous;
  const state = clone(previous), exp = experienceById(state, expId);
  const note = { id: newId(state, 'n'), itemKind: item.kind, text: normalizeText(text), replaces: item.key, original: item.text, at: now() };
  exp.notes.push(note);
  exp.reviews[item.key] = { decision: 'replaced', by: note.id, at: now() };
  delete exp.drafts['item:' + item.key];
  return state;
}

// The person may restate the core message in their own words; the result then follows that wording.
export function setAngle(previous, expId, text) {
  const state = clone(previous), exp = experienceById(state, expId);
  if (!exp) return previous;
  if (hasText(text)) exp.angleOverride = normalizeText(text); else delete exp.angleOverride;
  delete exp.drafts.angle;
  return state;
}
export function coreMessage(exp) { return exp.angleOverride || exp.analysis?.angle?.text || ''; }

export function setDraft(previous, expId, field, value) {
  const state = clone(previous);
  if (expId === null) { state.entryDraft = value; return state; }
  const exp = experienceById(state, expId);
  if (exp) exp.drafts[field] = value;
  return state;
}
export function clearDraft(previous, expId, field) {
  const state = clone(previous), exp = experienceById(state, expId);
  if (exp) delete exp.drafts[field];
  return state;
}

// ---- 4. What the engine sees ----
export function sourcesOf(exp) {
  const sources = [];
  if (hasText(exp.story.text)) sources.push({ id: 'story', kind: 'story', label: '내가 쓴 이야기', text: exp.story.text });
  for (const answer of exp.answers) if (answer.status === 'answered') sources.push({ id: answer.id, kind: 'answer', label: '답변', question: answer.question, text: answer.text });
  for (const note of exp.notes) sources.push({ id: note.id, kind: 'note', label: '내가 고친 문장', itemKind: note.itemKind, text: note.text });
  return sources;
}

export function engineInput(exp) {
  const items = exp.analysis?.items || [];
  return { title: displayTitle(exp), scopeTitle: exp.scopeTitle, sources: sourcesOf(exp), answers: exp.answers, notes: exp.notes,
    asked: exp.answers.map(a => ({ slot: a.slot, aboutKey: a.aboutKey, text: a.question })),
    unanswered: exp.answers.filter(a => a.status !== 'answered').map(a => ({ slot: a.slot, question: a.question, status: a.status })),
    excluded: items.filter(item => ['excluded', 'replaced'].includes(exp.reviews[item.key]?.decision)).map(item => ({ kind: item.kind, text: item.text })),
    previousItems: items.map(item => ({ id: item.id, kind: item.kind, text: item.text })), reviews: exp.reviews };
}

export function analysisBasis(exp) {
  return hashState([exp.story.text, exp.answers.map(a => [a.id, a.status, a.text]), exp.notes.map(n => [n.id, n.text]), exp.mode]);
}
export function resultBasis(exp) {
  return hashState([analysisBasis(exp), exp.reviews, displayTitle(exp), exp.angleOverride || '']);
}
export const analysisIsCurrent = exp => Boolean(exp.analysis && exp.analysis.basis === analysisBasis(exp));
export const resultIsCurrent = exp => Boolean(exp.result && exp.result.basis === resultBasis(exp));

export function applyAnalysis(previous, expId, analysis, basis) {
  const state = clone(previous), exp = experienceById(state, expId);
  if (!exp || basis !== analysisBasis(exp)) return previous; // a newer edit arrived meanwhile; keep waiting for that one
  exp.analysis = { ...analysis, basis, at: now() };
  if (!exp.titleByUser && analysis.suggestedTitle) exp.title = analysis.suggestedTitle;
  return state;
}
export function applyResult(previous, expId, result, basis) {
  const state = clone(previous), exp = experienceById(state, expId);
  if (!exp || basis !== resultBasis(exp)) return previous;
  exp.result = { ...result, basis, at: now() };
  return state;
}

export function clearResult(previous, expId) {
  const state = clone(previous), exp = experienceById(state, expId);
  if (!exp?.result) return previous;
  exp.resultHistory = [...(exp.resultHistory || []), exp.result];
  delete exp.result;
  return state;
}

export function displayTitle(exp) { return exp.title || exp.scopeTitle || '이름 없는 경험'; }

export function stageOf(exp) {
  if (!hasText(exp.story.text)) return 'story';
  if (!analysisIsCurrent(exp)) return 'analyzing';
  return exp.analysis.nextQuestion ? 'asking' : 'ready';
}

export function restoreNotebook(serialized) {
  try {
    const data = JSON.parse(serialized);
    if (data?.version !== 3 || !Array.isArray(data.experiences) || typeof data.entry?.text !== 'string') return null;
    for (const exp of data.experiences) if (typeof exp.id !== 'string' || !Array.isArray(exp.answers) || typeof exp.story?.text !== 'string') return null;
    return { ...createNotebook(), ...data };
  } catch { return null; }
}

export { KIND_LABELS, itemKey };
