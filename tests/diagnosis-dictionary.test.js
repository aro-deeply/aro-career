import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PATTERN_LABELS,
  SCORE_KEY_TO_PATTERN,
  NEXT_STEP_LABELS,
  getPatternIdFromScoreKey,
  getPatternLabel,
} from "../shared/diagnosis-dictionary.js";

test("PATTERN_LABELS: 5 patterns with short labels", () => {
  assert.equal(PATTERN_LABELS.pattern_01, "규격화된 정형성");
  assert.equal(PATTERN_LABELS.pattern_02, "근거 부재와 과장");
  assert.equal(PATTERN_LABELS.pattern_03, "차별화 판단 오류");
  assert.equal(PATTERN_LABELS.pattern_04, "직무 적합성 어긋남");
  assert.equal(PATTERN_LABELS.pattern_05, "업계 맥락 부재");
});

test("SCORE_KEY_TO_PATTERN: maps long score keys to short pattern ids", () => {
  assert.equal(SCORE_KEY_TO_PATTERN.pattern_01_generic_template, "pattern_01");
  assert.equal(SCORE_KEY_TO_PATTERN.pattern_05_industry_context_absence, "pattern_05");
});

test("NEXT_STEP_LABELS: maps Rewrite/Rehearse/Direct", () => {
  assert.equal(NEXT_STEP_LABELS.Rewrite, "재작성 (Rewrite)");
  assert.equal(NEXT_STEP_LABELS.Rehearse, "리허설 (Rehearse)");
  assert.equal(NEXT_STEP_LABELS.Direct, "직접 컨설팅 (Direct)");
});

test("getPatternIdFromScoreKey: returns pattern_NN for long key", () => {
  assert.equal(getPatternIdFromScoreKey("pattern_03_differentiation_mishandling"), "pattern_03");
});

test("getPatternIdFromScoreKey: returns the input unchanged if not in dictionary", () => {
  assert.equal(getPatternIdFromScoreKey("unknown_key"), "unknown_key");
});

test("getPatternLabel: returns short label for known id", () => {
  assert.equal(getPatternLabel("pattern_02"), "근거 부재와 과장");
});

test("getPatternLabel: returns the id unchanged if not in dictionary", () => {
  assert.equal(getPatternLabel("pattern_99"), "pattern_99");
});
