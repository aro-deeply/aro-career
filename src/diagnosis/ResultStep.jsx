import React from "react";
import { motion } from "framer-motion";
import {
  getPatternLabel,
} from "../../shared/diagnosis-dictionary.js";
import ConsultRequestForm from "./ConsultRequestForm.jsx";
import PatternScoreList from "./sections/PatternScoreList.jsx";
import RootDiagnosisCard from "./sections/RootDiagnosisCard.jsx";
import EvidenceList from "./sections/EvidenceList.jsx";
import OnePagerSummary from "./sections/OnePagerSummary.jsx";
import ReflectionQuestions from "./sections/ReflectionQuestions.jsx";
import ResultCTA from "./sections/ResultCTA.jsx";

export default function ResultStep({ result, onReset }) {
  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-16"
    >
      <div>
        <div className="text-[11px] tracking-[0.25em] text-neutral-500 font-semibold mb-5">
          진단 결과 · 1P 요약
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 leading-tight tracking-tight mb-6">
          진단이 완료되었습니다.
        </h1>
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span className="bg-neutral-900 text-white px-3 py-1.5 font-medium text-xs tracking-wide">
            핵심 원인: {getPatternLabel(result.root_cause)}
          </span>
          <span className="text-neutral-600 px-3 py-1.5">
            성격: <span className="font-semibold text-neutral-900">{result.correctability}</span>
          </span>
          <span className="text-neutral-600 px-3 py-1.5">
            권장 단계: <span className="font-semibold text-neutral-900">{result.next_step_recommendation}</span>
          </span>
        </div>
      </div>

      {result.key_verdict && (
        <section className="bg-yellow-50 border-l-4 border-yellow-500 px-7 py-6 -mx-2 md:mx-0">
          <div className="text-[10px] tracking-[0.2em] text-yellow-900 font-bold mb-3 uppercase">
            핵심 판정
          </div>
          <p className="text-xl md:text-2xl text-neutral-900 font-bold leading-[1.5]">
            {result.key_verdict}
          </p>
        </section>
      )}

      <PatternScoreList
        patternScores={result.pattern_scores}
        dominantPattern={result.dominant_pattern}
        rootCause={result.root_cause}
      />

      <RootDiagnosisCard rootDiagnosis={result.root_diagnosis} />

      <EvidenceList evidence={result.evidence} />

      <OnePagerSummary summary={result.one_pager_summary} />

      <ReflectionQuestions questions={result.self_reflection_questions} />

      <ResultCTA onReset={onReset} />

      <ConsultRequestForm result={result} />
    </motion.div>
  );
}
