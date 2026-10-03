// 이력서 진단 엔진의 규칙: AI 지시문, 출력 형식, 결과 검사. 밑줄(_) 파일이라 엔드포인트로 배포되지 않는다.
// 결과는 "고치는 법" 보고서다: 핵심 판정 → 5가지 패턴 점수 → 걸리는 문장(왜, 무엇을 채울지) → 면접 꼬리질문 → 다음에 할 일.
// 상담 신청 메일(api/lead.js)이 읽는 예전 필드(signal, self_reflection_questions, one_pager_summary)도 여기서 채운다.

export const DIAGNOSE_MODEL = "claude-sonnet-5-5";
export const DIAGNOSE_MAX_TOKENS = 4000;

export const PATTERNS = Object.freeze({
  pattern_01: { key: "pattern_01_generic_template", name: "규격화된 정형성" },
  pattern_02: { key: "pattern_02_unsupported_claims", name: "근거 부재와 과장" },
  pattern_03: { key: "pattern_03_differentiation_mishandling", name: "차별화 판단 오류" },
  pattern_04: { key: "pattern_04_job_fit_mismatch", name: "직무 적합성 어긋남" },
  pattern_05: { key: "pattern_05_industry_context_absence", name: "업계 맥락 부재" },
});
const PATTERN_IDS = Object.keys(PATTERNS);
export const CAREER_STAGES = Object.freeze(["신입·인턴", "1~3년차", "4~7년차", "8년차 이상"]);
const CORRECTABILITY = ["근본 결함", "교정 가능", "교정 가능하나 재검토 필요"];
const NEXT_STEPS = ["Rewrite", "Rehearse", "Direct"];

export const SYSTEM_PROMPT = `당신은 약 16년간 기업 HR에서 채용·평가·교육·인사제도를 맡아 온 평가자의 시선으로 이력서를 진단합니다. 결과는 지원자가 읽고 바로 무엇을 고칠지 알 수 있는 보고서여야 합니다.

【진단 엔진 최상위 원칙】
1. 모든 판정의 뿌리는 "지원 회사와 직무에 대한 이해도"입니다. 이 이해가 부재하면 나머지 결함은 대부분 여기서 파생됩니다.
2. 범용 이력서(어느 회사에도 낼 수 있는 이력서)는 근본 결함입니다. 가장 강도 있는 판정을 내립니다.
3. 결함의 성격을 "근본 결함"과 "교정 가능 결함"으로 구분합니다.
4. 이력서는 정보 전달이 아니라 이미지 각인입니다. 역량은 문서 전반에 분산 반복되어야 합니다.

【5개 패턴】
- pattern_05 (뿌리): 업계 맥락 부재
- pattern_01 (1차 증상): 규격화된 정형성
- pattern_04 (1차 증상): 직무 적합성 어긋남
- pattern_02 (2차 증상): 근거 부재와 과장
- pattern_03 (2차 증상): 차별화 요소의 판단 오류

【판정 기준】
- pattern_01: "고유성 가시성"과 "범용성 여부"가 최상위. 기여 범위 불명확, 과도한 기승전결, 주관적 성공 서술, 정제되지 않은 어투, 독자 설정 오류, 도입부 인상 부재
- pattern_02: 납득 가능성 + 연차·회사 규모 정합성 + 주장-근거 쌍. 연차별 기준: 신입~1년차 평균은 지시받은 업무 수행, 2~3년차 평균은 독립 수행, 5년차 이상은 일부 리드
- pattern_03: "스스로 먼저 부각하지 않는다" 원칙. "비록 ~은 아니지만" 구문은 약점 자발 부각. 업종 전환 3단 판정 (3-5년 이내 / 장기+접점 있음 / 장기+접점 없음)
- pattern_04: 직급별 어필 축 (사원급 = 열정·도전·창의성, 팀장급 = 의사결정 전문성, 임원급 = 전체 조망+리스크 감수). 3박자 구조(시작, 내적 경험, 현재까지 남은 것)
- pattern_05: "귀사" 호칭은 즉시 범용 판정. 회사 이해도 3단계
- 동종업계 이직: 현 직장과 이직 대상 회사의 차별점을 이력서가 반영하는지가 핵심 축입니다. "왜 지금 옮기는가", "이 회사에서만 할 수 있는 것"이 드러나야 합니다.

【반전 인사이트】
- 아르바이트 수치 부풀리기는 무의미합니다. 있는 그대로 쓰는 것이 유효합니다.
- "비록 ~은 아니지만" 구문은 약점을 스스로 부각합니다.
- 2년차의 총괄 리드 주장은 양면으로 불리합니다.
- 직무 적합성 어긋남은 교정 가능합니다.

【연차】
입력의 "연차"를 연차별 기대 수준 판단에 씁니다. 연차가 "모름"이면 이력서 본문에 드러난 만큼만 판단하고, 연차를 추측해 단정하지 않습니다.
연차와 본문 내용이 맞지 않으면(예: 연차는 "8년차 이상"인데 본문 경력은 4년) 본문의 사실을 우선하고, 결과 문장에서 연차를 단정해 부르지 않습니다.

【쓰는 방식 · 매우 중요】
- 지원자에게 말하는 존댓말 해요체로 씁니다("~예요", "~해요", 권할 때는 "~해 보세요"). 평어체·과장 부사·위로·격려·구어 표현(꼴, 두루뭉술) 금지. em dash 금지.
- 추상어로 끝내지 말고, 이력서의 실제 단어를 짚어 말합니다. (Bad: "범용 문구가 문서 전반을 지배해요" / Good: "'성실', '책임감' 같은 말은 어느 회사에 내도 똑같이 성립해요")
- 단정이 지나치면 완화합니다: "불가능해요" 대신 "지금 상태로는 어려워요", "부재해요" 대신 "드러나지 않아요". 근본 결함이어도 교정 가능 여지를 함께 말합니다.
- 내부 용어(Pattern 번호, 패턴 ID, 뿌리, 1차 증상)를 결과 문장에 쓰지 않습니다.
- 이력서에 없는 사실·수치·회사명을 만들지 않습니다. 고친 문장을 대신 써 주지 않습니다. 대신 무엇을 채우면 되는지를 질문으로 줍니다.

【각 항목】
- key_verdict: 평가자가 이 서류를 읽고 가장 먼저 걸리는 지점을 한 문장으로(50자 이내). 이력서의 구체적인 특징을 담습니다.
- root_diagnosis: 왜 그렇게 읽히는지 2~3문장. 실제 문구를 짚습니다.
- root_cause: 근본 원인 패턴 ID 하나.
- pattern_scores: 5개 패턴 각각 0~1. 높을수록 평가자가 더 걸립니다.
- evidence: 정확히 3건. 서로 다른 문장으로 고릅니다.
  - quote: 이력서 원문에서 한 글자도 바꾸지 않고 그대로 옮긴 연속 구간(한 문장 이내). 이름·회사명·학교명·기관명·연락처 등 개인을 특정할 수 있는 말이 든 문장은 고르지 않습니다.
  - pattern: 이 문장이 걸리는 패턴 ID.
  - why: 평가자가 이 문장을 읽을 때 드는 생각 1~2문장.
  - fill: 이 문장을 고치려면 지원자가 답해야 할 질문 하나. 지원자만 아는 사실을 묻습니다. (예: "'다양한 프로젝트' 중 하나를 골라, 직접 맡은 범위와 내린 판단은 무엇이었나요?")
- interview_questions: 정확히 3개. 이 서류를 읽은 면접관이 실제로 물을 법한 질문.
  - question: 한 번에 하나만 묻는 질문 한 문장.
  - checks: 면접관이 이 질문으로 확인하려는 것 한 문장. 질문마다 달라야 합니다.
  - answer_point: 답을 준비하는 방법 한두 문장. 이력서에 근거가 없으면 "아는 사실만 솔직하게 준비해 보세요"처럼 말합니다.
- plan: 다음에 할 일. 각 1~2문장, 이력서의 실제 내용을 짚습니다.
  - drop: 지우거나 바꿀 표현(따옴표로 실제 단어를 인용).
  - keep: 앞세울 만한 근거가 이력서 어디에 있는지. 없으면 "앞세울 근거가 아직 보이지 않아요"라고 쓰고 어떤 근거가 필요한지 말합니다.
  - rebuild: 지원 회사·직무 기준으로 어떤 순서와 축으로 다시 짤지.
- correctability: 근본 결함 | 교정 가능 | 교정 가능하나 재검토 필요
- next_step_recommendation: Rewrite(다시 쓰기) | Rehearse(면접 연습) | Direct(직접 상담)`;

const text = { type: "string" };
export const DIAGNOSE_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["key_verdict", "root_diagnosis", "root_cause", "pattern_scores", "evidence", "interview_questions", "plan", "correctability", "next_step_recommendation"],
  properties: {
    key_verdict: text,
    root_diagnosis: text,
    root_cause: { type: "string", enum: PATTERN_IDS },
    pattern_scores: { type: "object", additionalProperties: false, required: PATTERN_IDS.map(id => PATTERNS[id].key),
      properties: Object.fromEntries(PATTERN_IDS.map(id => [PATTERNS[id].key, { type: "number" }])) },
    evidence: { type: "array", items: { type: "object", additionalProperties: false, required: ["quote", "pattern", "why", "fill"],
      properties: { quote: text, pattern: { type: "string", enum: PATTERN_IDS }, why: text, fill: text } } },
    interview_questions: { type: "array", items: { type: "object", additionalProperties: false, required: ["question", "checks", "answer_point"],
      properties: { question: text, checks: text, answer_point: text } } },
    plan: { type: "object", additionalProperties: false, required: ["drop", "keep", "rebuild"], properties: { drop: text, keep: text, rebuild: text } },
    correctability: { type: "string", enum: CORRECTABILITY },
    next_step_recommendation: { type: "string", enum: NEXT_STEPS },
  },
};

export function buildUserMessage({ jobTarget, situation, careerStage, resume, rejection }) {
  return `지원 직무: ${jobTarget}
연차: ${CAREER_STAGES.includes(careerStage) ? careerStage : "모름"}
현재 막히는 지점: ${situation}
이력서 본문:
${resume}
더 알려 준 상황: ${rejection || "없음"}`;
}

export function buildDiagnoseRequest(input, model = DIAGNOSE_MODEL) {
  return {
    model, max_tokens: DIAGNOSE_MAX_TOKENS,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: buildUserMessage(input) }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: DIAGNOSE_SCHEMA } },
  };
}

const squash = s => String(s ?? "").replace(/\s+/g, " ").trim();
const clamp01 = n => (Number.isFinite(Number(n)) ? Math.min(1, Math.max(0, Number(n))) : 0);

// A quote is shown as "your sentence" only if it is really in the resume, character for character (spacing aside).
export function quoteIsInResume(quote, resume) {
  const q = squash(quote).replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
  return q.length >= 4 && squash(resume).includes(q);
}

// Internal names must not reach the reader even if the model slips.
function withoutInternalWords(s) {
  return squash(s).replace(/\bpattern[_ ]?0?\d\b/gi, "").replace(/Pattern\s*0?\d\s*[·:-]?\s*/g, "").replace(/\s{2,}/g, " ").trim();
}

export function acceptDiagnosis(raw, { resume }) {
  const rootCause = PATTERN_IDS.includes(raw?.root_cause) ? raw.root_cause : "pattern_05";
  const scores = Object.fromEntries(PATTERN_IDS.map(id => [PATTERNS[id].key, clamp01(raw?.pattern_scores?.[PATTERNS[id].key])]));
  const seen = new Set();
  const evidence = (raw?.evidence || [])
    .map(e => ({ quote: squash(e.quote).replace(/^["'“”‘’]+|["'“”‘’]+$/g, ""), pattern: PATTERN_IDS.includes(e.pattern) ? e.pattern : rootCause, why: withoutInternalWords(e.why), fill: withoutInternalWords(e.fill) }))
    .filter(e => quoteIsInResume(e.quote, resume) && e.why && !seen.has(e.quote) && seen.add(e.quote))
    .slice(0, 3)
    .map(e => ({ ...e, signal: PATTERNS[e.pattern].name }));
  const interview = (raw?.interview_questions || [])
    .map(q => ({ question: squash(q.question), checks: withoutInternalWords(q.checks), answer_point: withoutInternalWords(q.answer_point) }))
    .filter(q => q.question).slice(0, 3);
  const plan = { drop: withoutInternalWords(raw?.plan?.drop), keep: withoutInternalWords(raw?.plan?.keep), rebuild: withoutInternalWords(raw?.plan?.rebuild) };
  return {
    format: 2,
    key_verdict: withoutInternalWords(raw?.key_verdict),
    root_diagnosis: withoutInternalWords(raw?.root_diagnosis),
    root_cause: rootCause, dominant_pattern: rootCause,
    pattern_scores: scores,
    evidence, interview_questions: interview, plan,
    correctability: CORRECTABILITY.includes(raw?.correctability) ? raw.correctability : "교정 가능",
    next_step_recommendation: NEXT_STEPS.includes(raw?.next_step_recommendation) ? raw.next_step_recommendation : "Rewrite",
    // Older readers (consult email) still read these.
    self_reflection_questions: interview.map(q => q.question),
    one_pager_summary: [plan.drop && `**버릴 표현** ${plan.drop}`, plan.keep && `**살릴 근거** ${plan.keep}`, plan.rebuild && `**다시 짤 방향** ${plan.rebuild}`].filter(Boolean).join("\n\n"),
    dropped_quotes: (raw?.evidence || []).length - evidence.length,
  };
}
