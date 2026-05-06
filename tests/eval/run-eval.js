// 진단 재현성·일관성 평가 스크립트.
// 5개 입력 × N회 호출(기본 3회) → root_cause 일관성, pattern_scores 표준편차 측정.
//
// 실행: npm run eval
//   ANTHROPIC_API_KEY 환경변수 필요. 호출당 약 $0.03~0.05 소요.
//   기본 5×3=15회 호출 → 약 $0.45~0.75
//
// 환경변수 주입 방법(택1):
//   1) Windows PowerShell: $env:ANTHROPIC_API_KEY="sk-ant-..." ; npm run eval
//   2) macOS/Linux:        ANTHROPIC_API_KEY=sk-ant-... npm run eval
//   3) .env.local 파일 사용: node --env-file=.env.local --import tsx tests/eval/run-eval.js
//
// ⚠ SYSTEM_PROMPT는 api/diagnose.js의 것과 동기화 필요. 변경 시 양쪽 함께 수정.

import Anthropic from "@anthropic-ai/sdk";
import { EVAL_INPUTS } from "./inputs.js";

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const RUNS_PER_INPUT = Number(process.env.EVAL_RUNS) || 3;

// ─── api/diagnose.js와 반드시 동기화 ─────────────────────────────────────────
const SYSTEM_PROMPT = `당신은 ARO 스튜디오의 커리어 디렉터 관점으로 이력서를 진단합니다. 16년 HR 경력, 1,000회 이상의 면접 진행, 150건 이상의 컨설팅 사례를 가진 평가자의 시선으로 판단합니다.

【출력】
반드시 유효한 JSON 한 덩어리. 다른 텍스트 불가. evidence는 원문에서 직접 발췌. one_pager_summary는 600~900자. 모든 한국어 문장은 반드시 경어체(~합니다)로 작성.

【JSON 스키마】
{
  "root_cause": "pattern_01|pattern_02|pattern_03|pattern_04|pattern_05",
  "dominant_pattern": "동일 enum",
  "pattern_scores": {
    "pattern_01_generic_template": 0.0-1.0,
    "pattern_02_unsupported_claims": 0.0-1.0,
    "pattern_03_differentiation_mishandling": 0.0-1.0,
    "pattern_04_job_fit_mismatch": 0.0-1.0,
    "pattern_05_industry_context_absence": 0.0-1.0
  },
  "evidence": [{"quote": "원문 발췌", "signal": "Pattern 번호 · 신호명", "why": "평가 근거"}],
  "root_diagnosis": "근본 진단 2-3문장",
  "key_verdict": "전체 진단을 한 문장으로 압축. 60자 이내",
  "one_pager_summary": "3~4단락",
  "correctability": "근본 결함 | 교정 가능 | 교정 가능하나 재검토 필요",
  "next_step_recommendation": "Rewrite | Rehearse | Direct",
  "self_reflection_questions": ["질문 3개"]
}`;

function buildUserMessage({ jobTarget, situation, resume, rejection }) {
  return `지원 직무: ${jobTarget}
현재 상황: ${situation}
이력서 본문:
${resume}
최근 탈락 경험: ${rejection || "기재되지 않음"}

위 입력에 대해 JSON 스키마에 따라 진단 결과를 생성해주세요.`;
}

async function callDiagnose(client, input) {
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(input) }],
  });
  const text = response.content?.[0]?.text || "";
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  return JSON.parse(cleaned);
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function mode(arr) {
  const counts = {};
  for (const x of arr) counts[x] = (counts[x] || 0) + 1;
  return Object.entries(counts).sort(([, a], [, b]) => b - a)[0][0];
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY 환경변수가 필요합니다. (.env.local에 설정하거나 export)");
    process.exit(1);
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log(`\n[ARO 진단 재현성 평가]`);
  console.log(`모델: ${ANTHROPIC_MODEL}`);
  console.log(`입력 수: ${EVAL_INPUTS.length} · 입력당 호출 수: ${RUNS_PER_INPUT}`);
  console.log(`총 호출: ${EVAL_INPUTS.length * RUNS_PER_INPUT}회 (예상 비용: $${(EVAL_INPUTS.length * RUNS_PER_INPUT * 0.04).toFixed(2)})`);
  console.log(`────────────────────────────────────────────`);

  const allResults = [];
  for (const input of EVAL_INPUTS) {
    console.log(`\n▶ ${input.id} — ${input.label}`);
    const runs = [];
    for (let i = 0; i < RUNS_PER_INPUT; i++) {
      try {
        const result = await callDiagnose(client, input);
        runs.push(result);
        process.stdout.write(`  run ${i + 1}/${RUNS_PER_INPUT}: root=${result.root_cause}\n`);
      } catch (e) {
        console.error(`  run ${i + 1}/${RUNS_PER_INPUT} 실패:`, e.message);
        runs.push(null);
      }
    }
    const valid = runs.filter(Boolean);
    const rootCauses = valid.map((r) => r.root_cause);
    const dominantPatterns = valid.map((r) => r.dominant_pattern);

    // 패턴 점수 일관성
    const patternKeys = [
      "pattern_01_generic_template",
      "pattern_02_unsupported_claims",
      "pattern_03_differentiation_mishandling",
      "pattern_04_job_fit_mismatch",
      "pattern_05_industry_context_absence",
    ];
    const scoreStats = {};
    for (const k of patternKeys) {
      const vals = valid.map((r) => r.pattern_scores?.[k] ?? 0);
      scoreStats[k] = { mean: mean(vals), stdev: stdev(vals) };
    }

    const rootCauseConsistent = new Set(rootCauses).size === 1;
    const result = {
      id: input.id,
      label: input.label,
      successCount: valid.length,
      rootCauseConsistent,
      rootCauseMode: rootCauses.length ? mode(rootCauses) : "n/a",
      rootCauses,
      dominantPatterns,
      scoreStats,
    };
    allResults.push(result);

    console.log(`  → root_cause 일관성: ${rootCauseConsistent ? "✓ 일관" : "⚠ 변동"} (${rootCauses.join(", ")})`);
    for (const k of patternKeys) {
      const s = scoreStats[k];
      const flag = s.stdev > 0.1 ? " ⚠" : "";
      console.log(`     ${k.replace("pattern_", "P").slice(0, 4).padEnd(5)}: 평균 ${s.mean.toFixed(2)} · σ ${s.stdev.toFixed(3)}${flag}`);
    }
  }

  // 요약
  console.log(`\n────────────────────────────────────────────`);
  console.log(`[요약]`);
  const consistent = allResults.filter((r) => r.rootCauseConsistent).length;
  console.log(`root_cause 일관성: ${consistent}/${allResults.length} 입력에서 모든 호출이 동일한 결과`);
  const allStdevs = allResults.flatMap((r) => Object.values(r.scoreStats).map((s) => s.stdev));
  console.log(`pattern_scores 평균 표준편차: ${mean(allStdevs).toFixed(3)} (낮을수록 좋음)`);
  console.log(`최대 표준편차: ${Math.max(...allStdevs).toFixed(3)}`);
  console.log(`────────────────────────────────────────────\n`);
}

main().catch((e) => {
  console.error("Eval 실패:", e);
  process.exit(1);
});
