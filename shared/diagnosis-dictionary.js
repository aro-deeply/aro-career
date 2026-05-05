export const PATTERN_LABELS = {
  pattern_01: "규격화된 정형성",
  pattern_02: "근거 부재와 과장",
  pattern_03: "차별화 판단 오류",
  pattern_04: "직무 적합성 어긋남",
  pattern_05: "업계 맥락 부재",
};

export const SCORE_KEY_TO_PATTERN = {
  pattern_01_generic_template: "pattern_01",
  pattern_02_unsupported_claims: "pattern_02",
  pattern_03_differentiation_mishandling: "pattern_03",
  pattern_04_job_fit_mismatch: "pattern_04",
  pattern_05_industry_context_absence: "pattern_05",
};

export const NEXT_STEP_LABELS = {
  Rewrite: "재작성 (Rewrite)",
  Rehearse: "리허설 (Rehearse)",
  Direct: "직접 컨설팅 (Direct)",
};

export function getPatternIdFromScoreKey(scoreKey) {
  return SCORE_KEY_TO_PATTERN[scoreKey] || scoreKey;
}

export function getPatternLabel(patternId) {
  return PATTERN_LABELS[patternId] || patternId;
}
