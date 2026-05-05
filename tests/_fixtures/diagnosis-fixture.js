export const FIXTURE_DIAGNOSIS = {
  root_cause: "pattern_05",
  dominant_pattern: "pattern_05",
  pattern_scores: {
    pattern_01_generic_template: 0.78,
    pattern_02_unsupported_claims: 0.62,
    pattern_03_differentiation_mishandling: 0.41,
    pattern_04_job_fit_mismatch: 0.55,
    pattern_05_industry_context_absence: 0.88,
  },
  evidence: [
    {
      quote: "귀사의 인재상에 부합하는 성실하고 책임감 있는 인재가 되겠습니다.",
      signal: "Pattern 05 · 귀사 호칭 · 범용 문구",
      why: "범용 구문입니다.",
    },
  ],
  root_diagnosis: "근본 원인은 **지원 회사 이해의 공백**입니다.",
  key_verdict: "업계 맥락 부재에서 비롯된 구조입니다.",
  one_pager_summary:
    "근본 원인은 **회사 이해 공백**입니다.\n\n표면 증상은 정형성입니다. **본인의 기여 범위가 가려집니다**.",
  correctability: "교정 가능",
  next_step_recommendation: "Rewrite",
  self_reflection_questions: ["질문 1?", "질문 2?", "질문 3?"],
};

export const FIXTURE_LEAD = {
  name: "테스트 신청자",
  email: "test@example.com",
  submittedAt: "2026-05-05 12:00:00",
  diagnosis: FIXTURE_DIAGNOSIS,
};
