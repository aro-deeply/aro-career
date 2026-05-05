import React from "react";
import { motion } from "framer-motion";
import {
  getPatternLabel,
} from "../../shared/diagnosis-dictionary.js";
import {
  renderMarkdownBold,
  BOLD_HIGHLIGHT_CLASS,
} from "../shared/render-markdown-bold.jsx";
import ConsultRequestForm from "./ConsultRequestForm.jsx";
import PatternScoreList from "./sections/PatternScoreList.jsx";

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

      <section>
        <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-6">
          02 · 근본 진단
        </div>
        <div className="bg-neutral-50 border-l-4 border-neutral-900 px-7 py-7">
          <p className="text-lg md:text-xl text-neutral-800 leading-[1.8]">
            {renderMarkdownBold(result.root_diagnosis, BOLD_HIGHLIGHT_CLASS)}
          </p>
        </div>
      </section>

      <section>
        <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-8">
          03 · 원문 근거
        </div>
        <div className="space-y-4">
          {result.evidence.map((e, i) => (
            <div key={i} className="bg-white border border-neutral-200 p-6 md:p-7">
              <div className="text-[10px] tracking-[0.15em] text-neutral-500 font-semibold mb-4 uppercase">
                #{String(i + 1).padStart(2, "0")} · {e.signal}
              </div>
              <blockquote className="text-base md:text-lg text-neutral-900 mb-5 pl-4 border-l-2 border-neutral-400 leading-relaxed font-medium">
                "{e.quote}"
              </blockquote>
              <p className="text-sm md:text-base text-neutral-700 leading-relaxed">
                {e.why}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-6">
          04 · 종합 진단
        </div>
        <div className="bg-stone-50 border border-stone-200 p-8 md:p-12">
          <div className="space-y-6">
            {result.one_pager_summary
              .split(/\n\n+/)
              .filter(p => p.trim())
              .map((paragraph, idx) => (
                <p
                  key={idx}
                  className="text-base md:text-[17px] text-neutral-800 leading-[1.95]"
                >
                  {idx === 0 && (
                    <span className="inline-block w-8 h-8 bg-neutral-900 text-white text-xs font-bold text-center leading-8 mr-3 -mt-1 align-middle tabular-nums">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  )}
                  {idx > 0 && (
                    <span className="inline-block w-8 h-8 border-2 border-neutral-900 text-neutral-900 text-xs font-bold text-center leading-[28px] mr-3 -mt-1 align-middle tabular-nums">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  )}
                  {renderMarkdownBold(paragraph, BOLD_HIGHLIGHT_CLASS)}
                </p>
              ))}
          </div>
        </div>
      </section>

      <section>
        <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-8">
          05 · 다음 상담 전 자가 성찰 질문
        </div>
        <div className="space-y-6">
          {result.self_reflection_questions.map((q, i) => (
            <div key={i} className="flex gap-5 items-start">
              <div className="text-3xl font-bold text-neutral-300 leading-none tabular-nums flex-shrink-0">
                {String(i + 1).padStart(2, "0")}
              </div>
              <p className="text-base md:text-lg text-neutral-900 leading-relaxed pt-1 font-medium">
                {q}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-neutral-200 pt-10 mt-16">
        <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-4">
          다음 단계
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 leading-tight tracking-tight mb-5">
          이제 실제 교정으로 넘어가십시오.
        </h2>
        <p className="text-neutral-600 leading-relaxed mb-8 max-w-2xl text-base md:text-lg">
          본 진단은 자동 생성된 1차 분석입니다. 30분 1:1 사전 진단에서는 본인의 실제 경험과 상황에 맞춘 심화 분석이 이어집니다. 본 상담 전환은 전제되지 않습니다.
        </p>
        <div className="flex flex-col md:flex-row gap-3">
          <a
            href="index.html#final"
            className="bg-neutral-900 hover:bg-black text-white px-8 py-4 text-sm font-semibold tracking-[0.15em] text-center transition-colors"
          >
            30분 무료 사전 진단 신청 →
          </a>
          <button
            onClick={onReset}
            className="border border-neutral-300 hover:border-neutral-900 text-neutral-700 hover:text-neutral-900 px-8 py-4 text-sm font-semibold tracking-[0.15em] transition-colors"
          >
            다시 진단하기
          </button>
        </div>
      </section>

      <ConsultRequestForm result={result} />
    </motion.div>
  );
}
