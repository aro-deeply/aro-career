// Rule-based engine. It runs only in the browser and never sends text anywhere.
// It reads surface wording, not meaning; every item is an exact quote the user can check.
import { normalizeText, verifyItems, isUsableItem, verifyComposedLines, KIND_LABELS } from './evidence.mjs';

const FIRST_PERSON_VERB = /(했|맡았|맡아|진행|담당|정리|만들|제안|공부|조율|섭외|선정|설계|작성|해내|해냈|처리|검토|준비|요청|확인해|확인했|알아보|비교)/u;
const OTHERS_AS_SUBJECT = /^(그들|그분들|다른 팀|팀원들|회사가|대표님이|임원들이)/u;
const PURPOSE = /(위해서|위해|하려고|려고|도록)/u;
const SITUATION = /(이유로|때문에|였기|이었기|없던|모르는|몰랐|처음|바쁘|싫어|부족|급하게|갑자기|있었지만|였지만|있다면|시켰)/u;
const ROLE = /(리더|팀장|담당자|책임자|대행|역할|맡고 있)/u;
// Effort and feelings describe how hard it was, not what I did.
const FEELING = /(상상초월|끙끙|힘들|버거|벅찼|벅차|최선을 다|고생)/u;
const RESULT = /(결과|덕분|줄었|늘었|완료|끝냈|마쳤|반응|칭찬|좋아졌|나아졌)/u;
const EXAMPLE_MARKER = /예를\s*들(?:어|면)(?:서)?,?\s*/u;

function sentences(text) {
  return normalizeText(text).split(/(?<=[.!?。])\s+/u).map(s => s.trim()).filter(Boolean);
}
function clauses(sentence) {
  return sentence.split(/,\s*|(?<=지만|는데|었고|였고|이었고|이고|동시에|하면서)\s+/u).map(s => s.replace(/[.!?。]+$/u, '').trim()).filter(s => s.length >= 2);
}

// "A부터 시작해서 B, C, 그리고 D까지 내가 했어" → A, B, C, D as separate actions.
function listedActions(sentence) {
  const match = sentence.match(/([^,]*?)부터\s*시작해서\s*(.+?)까지(?:도)?\s*(?:모두|전부|다)?\s*(?:내가|제가)?\s*(?:직접\s*)?(?:했|맡|진행|처리|담당)/u);
  if (!match) return [];
  const head = match[1].split(/(?:이유로|때문에|해서|하고|고)\s+/u).pop().trim();
  const rest = match[2].split(/,\s*/u).map(part => part.replace(/^(?:그리고|또|및)\s*(?:심지어\s*)?/u, '').trim());
  return [head, ...rest].filter(part => part.length >= 2 && part.length <= 40);
}

function classifyClause(clause) {
  if (OTHERS_AS_SUBJECT.test(clause) || FEELING.test(clause)) return 'situation';
  // "모르는 내가 공부하면서" describes what I did despite the situation.
  if (/(?:내가|제가)/u.test(clause) && FIRST_PERSON_VERB.test(clause)) return 'action';
  if (SITUATION.test(clause)) return 'situation';
  if (ROLE.test(clause)) return 'role';
  if (RESULT.test(clause)) return 'result';
  if (FIRST_PERSON_VERB.test(clause)) return 'action';
  return null;
}

// "X를 제안해서 Y를 만들기 위해서" holds an action and the purpose behind it.
function splitPurpose(clause) {
  const at = clause.search(PURPOSE);
  if (at < 0) return null;
  const end = at + clause.slice(at).match(PURPOSE)[0].length;
  const purposeText = clause.slice(0, end);
  const lead = purposeText.match(/^(.+?(?:해서|하여|하고))\s+(.+)$/u);
  return lead ? { action: lead[1], purpose: lead[2] } : { action: null, purpose: purposeText };
}

const SLOT_KIND = { action: 'action', focus: 'action', criterion: 'criterion', alignment: 'action', result: 'result', role: 'role', situation: 'situation' };

// Display text for a quoted clause: drop filler words and dangling connectives so it reads like a note.
// The evidence keeps the exact quote; only the label is tidied, and nothing is added.
const ENDINGS = [[/위해서$/u, ' 위해'], [/기위해/u, '기 위해'], [/있었지만$|있었고$/u, '있었음'], [/(?:이)?긴 하지만$/u, ''],
  [/(?:이)?었지만$|였지만$/u, ''], [/(?:이)?었고$|였고$/u, ''], [/하면서$|해서$|하고$/u, '함'], [/면서도$/u, '면서도'], [/는 동시에$/u, ''], [/시켰어$/u, '시킴'], [/했었어$|했어$/u, '함']];
export function tidy(text) {
  let out = normalizeText(text).replace(/^(?:그냥|정말|물론|그리고|심지어|사실|근데|그래서)\s+/u, '').replace(/^(?:그냥|정말|물론)\s+/u, '');
  for (const [pattern, replacement] of ENDINGS) out = out.replace(pattern, replacement);
  out = out.replace(/\s+/g, ' ').trim();
  return out.length >= 2 ? out : normalizeText(text);
}

function storyItems(source) {
  const raw = [];
  const add = (kind, quote) => raw.push({ kind, text: tidy(quote), evidence: [{ sourceId: source.id, quote }], basis: 'stated', origin: 'local-rule' });
  const text = normalizeText(source.text);
  const marker = text.match(EXAMPLE_MARKER);
  const contextEnd = marker ? marker.index : -1;
  for (const sentence of sentences(text)) {
    const listed = listedActions(sentence);
    listed.forEach(part => add('action', part));
    const inContext = contextEnd > 0 && text.indexOf(sentence) < contextEnd;
    for (let clause of clauses(sentence)) {
      clause = clause.replace(EXAMPLE_MARKER, '').trim();
      if (clause.length < 2) continue;
      if (inContext) { add('situation', clause); continue; }
      if (listed.length && listed.some(part => clause.includes(part))) {
        // Keep the reason that precedes a list ("그들이 바쁘다는 이유로 A부터…") as its own situation.
        const lead = clause.slice(0, clause.indexOf(listed[0])).trim();
        if (lead.length >= 4 && (SITUATION.test(lead) || OTHERS_AS_SUBJECT.test(lead))) add('situation', lead);
        continue;
      }
      const purpose = splitPurpose(clause);
      if (purpose) {
        if (purpose.action) add('action', purpose.action);
        add('judgment', purpose.purpose);
        continue;
      }
      // A short remark about effort alone ("힘들게 버티면서") carries no fact to keep as an item.
      if (FEELING.test(clause) && clause.length <= 16) continue;
      const kind = classifyClause(clause);
      if (kind) add(kind, clause.length > 90 ? clause.slice(0, 90) : clause);
    }
  }
  return raw;
}

function answerItems(answer) {
  if (answer.status !== 'answered') return [];
  const kind = SLOT_KIND[answer.slot] || 'action';
  return sentences(answer.text).map(s => s.replace(/[.!?。]+$/u, '')).filter(s => s.length >= 2)
    .map(quote => ({ kind, text: tidy(quote.length > 150 ? quote.slice(0, 150) : quote),
      evidence: [{ sourceId: answer.id, quote: quote.length > 150 ? quote.slice(0, 150) : quote }], basis: 'stated', origin: 'local-rule' }));
}

function noteItems(note) {
  return [{ kind: note.itemKind, text: note.text, evidence: [{ sourceId: note.id, quote: note.text }], basis: 'stated', origin: 'user' }];
}

export function suggestTitle(storyText) {
  const text = normalizeText(storyText);
  const named = text.match(/업무가\s*(.{2,24}?)\s*(?:업무|일|프로젝트)(?:였|이었)/u)
    || text.match(/([가-힣A-Za-z0-9]{2,12}(?:\s[가-힣A-Za-z0-9]{2,12})?)\s*(?:프로젝트|업무)를?\s*(?:맡|진행|담당)/u);
  return named ? named[1].trim() : null;
}

function plannedQuestions(items, sources, title) {
  const actions = items.filter(item => item.kind === 'action');
  const has = kind => items.some(item => item.kind === kind);
  const corpus = sources.map(source => normalizeText(source.text)).join(' ');
  const people = [...new Set((corpus.match(/임원|대표님|다른 팀|[가-힣A-Z]{1,6}팀|업체|부서|결재권자/gu) || []).filter(word => !/^(?:인사|총무|인사총무)팀$/u.test(word)))].slice(0, 3);
  const plan = [];
  if (!actions.length) plan.push({ slot: 'action', text: '이 일에서 내가 직접 한 일을 생각나는 순서대로 적어주세요.',
    why: '이력서와 면접의 중심은 ‘내가 한 일’이에요. 이것부터 남겨요.', hint: '정해진 절차를 따랐어도 그대로 적어주세요.' });
  if (actions.length >= 2) plan.push({ slot: 'focus', text: '적어주신 일 중 내 판단이 가장 많이 필요했던 일은 무엇이었나요?',
    why: '면접에서는 여러 일을 나열하기보다 한 가지를 깊게 묻는 경우가 많아요. 깊게 이야기할 한 가지를 먼저 정해요.',
    hint: '아래에서 고르거나 직접 적어주세요.', choices: actions.slice(0, 7).map(item => item.text) });
  if (!has('criterion')) plan.push({ slot: 'criterion', dependsOn: 'focus', text: '‘{focus}’에서 여러 선택지 중 하나로 정할 때 무엇을 기준으로 삼았나요?',
    why: '같은 일을 해도 기준은 사람마다 달라요. 이 기준이 나를 설명하는 근거가 돼요.', hint: '예산, 일정, 사용할 사람의 불편처럼 실제로 따진 것을 적어주세요.' });
  if (people.length) plan.push({ slot: 'alignment', text: '그 과정에서 ' + people.join('·') + ' 등과 생각이 달랐던 때가 있었다면, 어떻게 맞췄나요?',
    why: '혼자 처리한 일과 여러 사람의 의견을 맞춘 일은 다르게 읽혀요. 실제 있었던 경우만 남겨요.', hint: '없었다면 ‘기억나지 않아요’ 또는 ‘다음에 답할게요’를 눌러도 돼요.' });
  if (!has('result')) plan.push({ slot: 'result', text: '이 일이 끝난 뒤 직접 보거나 들은 결과·반응이 있나요?',
    why: '확인한 결과만 쓰고, 확인하지 못한 결과는 쓰지 않으려는 질문이에요.', hint: '숫자가 없어도 돼요. 기억나지 않으면 그대로 표시해 주세요.' });
  return plan.map(question => ({ ...question, title }));
}

function fillFocus(question, answers, items) {
  if (!question.text.includes('{focus}')) return question;
  const focusAnswer = answers.find(answer => answer.slot === 'focus' && answer.status === 'answered');
  const actions = items.filter(item => item.kind === 'action');
  const named = focusAnswer && actions.find(item => normalizeText(focusAnswer.text).includes(item.text));
  const focus = named?.text || (focusAnswer && normalizeText(focusAnswer.text).length <= 24 ? normalizeText(focusAnswer.text) : null)
    || (focusAnswer ? '고른 일' : actions[0]?.text || '이 일');
  return { ...question, text: question.text.replace('{focus}', focus), aboutKey: focus };
}

// The next rule-based question for slots nobody has asked yet. Used when the AI stops asking too early.
export function plannedNextQuestion({ items, askedSlots, sources, answers = [] }) {
  const next = plannedQuestions(items, sources, '').find(question => !askedSlots.has(question.slot));
  return next ? fillFocus(next, answers, items) : null;
}

export function analyzeLocally(input) {
  const { sources, answers = [], notes = [], title } = input;
  const raw = [];
  for (const source of sources) {
    if (source.kind === 'story') raw.push(...storyItems(source));
  }
  for (const answer of answers) raw.push(...answerItems(answer));
  for (const note of notes) raw.push(...noteItems(note));
  // An answer that just names something already in the story ("업체 선정") points at it; it is not a second item.
  const seen = new Set(), unique = raw.filter(item => { const k = item.kind + '|' + normalizeText(item.text); if (seen.has(k)) return false; seen.add(k); return true; });
  const { accepted, rejected } = verifyItems(unique.map((item, index) => ({ ...item, id: 'L' + (index + 1) })), sources);
  const askedSlots = new Set(answers.map(answer => answer.slot));
  const plan = plannedQuestions(accepted, sources, title).filter(question => !askedSlots.has(question.slot));
  const next = plan[0] ? fillFocus(plan[0], answers, accepted) : null;
  return { engine: 'local', items: accepted, rejected, nextQuestion: next, done: !next,
    suggestedTitle: suggestTitle(sources.find(source => source.kind === 'story')?.text || '') };
}

const quoteOf = item => item.text;

export function composeLocally(input) {
  const { title, items, reviews = {}, sources, answers = [] } = input;
  const seen = new Set();
  const usable = items.filter(item => isUsableItem(item, reviews)).filter(item => { const k = normalizeText(item.text); if (seen.has(k)) return false; seen.add(k); return true; });
  const of = kind => usable.filter(item => item.kind === kind);
  // Short task names read as a list; clause-like actions are kept whole as quotes. Nothing the user kept is dropped.
  const isTaskName = item => item.text.length <= 20 && !/(서|고|며|면서|어|요|다|음)$/u.test(item.text);
  const tasks = of('action').filter(isTaskName), clauses = of('action').filter(item => !isTaskName(item));
  const resume = [];
  if (tasks.length) resume.push({ text: title + '에서 맡은 일: ' + tasks.map(item => item.text).join(', '), itemIds: tasks.map(item => item.id) });
  for (const item of clauses) resume.push({ text: item.text, itemIds: [item.id] });
  for (const kind of ['role', 'judgment', 'criterion', 'result']) {
    const picked = of(kind).slice(0, 2);
    if (picked.length) resume.push({ text: KIND_LABELS[kind] + ': ' + picked.map(quoteOf).join(', '), itemIds: picked.map(item => item.id) });
  }
  const interview = [];
  for (const [kind, lead] of [['situation', '상황'], ['role', '맡은 범위'], ['action', '한 일'], ['judgment', '판단·이유'], ['criterion', '기준'], ['result', '결과']]) {
    const picked = of(kind).slice(0, kind === 'action' ? 6 : 3);
    if (picked.length) interview.push({ text: lead + ': ' + picked.map(quoteOf).join(', '), itemIds: picked.map(item => item.id) });
  }
  const resumeChecked = verifyComposedLines(resume, usable), interviewChecked = verifyComposedLines(interview, usable);
  const gaps = describeGaps(usable, answers);
  return { engine: 'local', headline: null, useFor: [], resume: resumeChecked.kept,
    interview: { question: '이 경험에서 어떤 역할을 했고, 어떻게 판단했는지 말씀해 주세요.', lines: interviewChecked.kept },
    followUps: [], cautions: [], strengthen: answers.filter(a => a.status !== 'answered').map(a => a.question).slice(0, 3),
    gaps, held: [...resumeChecked.held, ...interviewChecked.held] };
}

export function describeGaps(usable, answers) {
  // Name the actual question, so a "don't remember" on one detail is not read as the whole topic missing.
  const gaps = answers.filter(answer => answer.status !== 'answered').map(answer =>
    '질문 “' + answer.question + '” — ' + (answer.status === 'unknown' ? '기억나지 않음으로 남겨 문장에 넣지 않았어요.' : '나중에 답하기로 해서 문장에 넣지 않았어요.'));
  if (!usable.some(item => item.kind === 'result') && !answers.some(answer => answer.slot === 'result'))
    gaps.push('결과·반응: 확인한 내용이 없어 결과를 단정하는 문장을 넣지 않았어요.');
  return gaps;
}
