import React from "react";
import { motion } from "framer-motion";
import {
  PATTERN_LABELS,
  getPatternIdFromScoreKey,
} from "../../../shared/diagnosis-dictionary.js";

const PATTERN_LABELS_DISPLAY = {
  pattern_01_generic_template: `Pattern 01 · ${PATTERN_LABELS.pattern_01}`,
  pattern_02_unsupported_claims: `Pattern 02 · ${PATTERN_LABELS.pattern_02}`,
  pattern_03_differentiation_mishandling: `Pattern 03 · ${PATTERN_LABELS.pattern_03}`,
  pattern_04_job_fit_mismatch: `Pattern 04 · ${PATTERN_LABELS.pattern_04}`,
  pattern_05_industry_context_absence: `Pattern 05 · ${PATTERN_LABELS.pattern_05}`,
};

export default function PatternScoreList({ patternScores, dominantPattern, rootCause }) {
  return (
    <section>
      <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-8">
        01 · 5개 패턴 진단 점수
      </div>
      <div className="space-y-5">
        {Object.entries(patternScores).map(([key, score]) => {
          const patternId = getPatternIdFromScoreKey(key);
          const isDominant = patternId === dominantPattern;
          const isRoot = patternId === rootCause;
          return (
            <div key={key}>
              <div className="flex justify-between items-baseline mb-2.5">
                <div className="text-sm md:text-base text-neutral-900 font-semibold flex items-center gap-2 flex-wrap">
                  {PATTERN_LABELS_DISPLAY[key]}
                  {isRoot && <span className="text-[9px] tracking-widest font-bold bg-neutral-900 text-white px-2 py-0.5">ROOT</span>}
                  {isDominant && !isRoot && <span className="text-[9px] tracking-widest font-bold border border-neutral-900 text-neutral-900 px-2 py-0.5">DOMINANT</span>}
                </div>
                <div className="text-sm text-neutral-600 tabular-nums font-medium">
                  {(score * 100).toFixed(0)}
                </div>
              </div>
              <div className="h-1.5 bg-neutral-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className={`h-full ${score > 0.7 ? "bg-neutral-900" : score > 0.4 ? "bg-neutral-600" : "bg-neutral-400"}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
