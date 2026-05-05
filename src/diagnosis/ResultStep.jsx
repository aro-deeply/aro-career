import React from "react";
import { motion } from "framer-motion";
import {
  renderMarkdownBold,
  BOLD_HIGHLIGHT_CLASS,
} from "../shared/render-markdown-bold.jsx";
import ConsultRequestForm from "./ConsultRequestForm.jsx";

const PATTERN_SHORT_LABELS = {
  pattern_01_generic_template: "직무 기준 연결 부족",
  pattern_02_unsupported_claims: "행동 근거 부족",
  pattern_03_differentiation_mishandling: "차별화 약함",
  pattern_04_job_fit_mismatch: "직무 적합성 정리 필요",
  pattern_05_industry_context_absence: "지원 회사 이해 부족",
};

function getTop3Patterns(patternScores) {
  return Object.entries(patternScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key]) => ({ key, label: PATTERN_SHORT_LABELS[key] || key }));
}

const BLOCK_LABEL_CLASS = "text-[11px] tracking-[0.2em] text-[#6B625C] font-semibold mb-6 uppercase";

export default function ResultStep({ result, onReset }) {
  const top3 = getTop3Patterns(result.pattern_scores);

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-16"
    >
      {/* Header */}
      <div>
        <div className="text-[11px] tracking-[0.25em] text-neutral-500 font-semibold mb-5">
          진단 결과 · 무료 진단
        </div>
        <h1
          className="text-3xl md:text-4xl font-bold text-neutral-900 leading-tight tracking-tight mb-4"
          style={{ wordBreak: "keep-all" }}
        >
          진단이 완료되었습니다.
        </h1>
        <p className="text-neutral-600 text-base md:text-lg leading-relaxed">
          현재 서류가 평가자에게 어떻게 읽히는지 아래 순서로 정리했습니다.
        </p>
      </div>

      {/* 01 핵심 원인 */}
      <section>
        <div className={BLOCK_LABEL_CLASS}>
          01 · 핵심 원인
        </div>
        <div className="bg-[#F7F1E8] border-l-4 border-[#5E4A36] px-7 py-7">
          <p className="text-lg md:text-xl text-[#1C1917] leading-[1.8]">
            {renderMarkdownBold(result.root_diagnosis, BOLD_HIGHLIGHT_CLASS)}
          </p>
          {result.key_verdict && (
            <p className="text-base text-[#6B625C] mt-4 leading-relaxed">
              {result.key_verdict}
            </p>
          )}
        </div>
      </section>

      {/* 02 감지된 문제 패턴 */}
      <section>
        <div className={BLOCK_LABEL_CLASS}>
          02 · 감지된 문제 패턴
        </div>
        <div className="flex flex-wrap gap-2">
          {top3.map(({ key, label }) => (
            <span
              key={key}
              className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-[#EFE7DC] text-[#5E4A36]"
            >
              {label}
            </span>
          ))}
        </div>
        <p className="text-xs text-neutral-500 mt-4">
          점수 기준 상위 3개 패턴입니다. 평가자 관점에서 가장 눈에 띄는 문제 유형입니다.
        </p>
      </section>

      {/* 03 원문에서 감지된 문장 */}
      <section>
        <div className={BLOCK_LABEL_CLASS}>
          03 · 원문에서 감지된 문장
        </div>
        <div className="space-y-4">
          {result.evidence.slice(0, 3).map((e, i) => (
            <div key={i} className="bg-white border border-[#EFE7DC] p-6 md:p-7">
              <div className="text-[10px] tracking-[0.15em] text-[#8B7355] font-semibold mb-4 uppercase">
                #{String(i + 1).padStart(2, "0")} · {e.signal}
              </div>
              <blockquote className="text-base md:text-lg text-[#1C1917] mb-5 pl-4 border-l-2 border-[#8B7355] leading-relaxed font-medium">
                "{e.quote}"
              </blockquote>
              <p className="text-sm md:text-base text-[#6B625C] leading-relaxed">
                {e.why}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 04 평가자 관점 */}
      <section>
        <div className={BLOCK_LABEL_CLASS}>
          04 · 평가자 관점
        </div>
        <div className="bg-[#FAFAF7] border border-[#EFE7DC] p-8 md:p-10">
          <p
            className="text-base md:text-[17px] text-[#1C1917] leading-[1.95]"
            style={{ wordBreak: "keep-all" }}
          >
            {renderMarkdownBold(result.root_diagnosis, BOLD_HIGHLIGHT_CLASS)}
          </p>
          <p className="text-sm text-[#6B625C] mt-4 leading-relaxed">
            위 진단은 입력된 문장에서 반복적으로 감지된 패턴을 평가자 시각으로 해석한 것입니다.
          </p>
        </div>
      </section>

      {/* 05 면접에서 이어질 수 있는 질문 */}
      <section>
        <div className={BLOCK_LABEL_CLASS}>
          05 · 면접에서 이어질 수 있는 질문
        </div>
        <div className="space-y-4">
          {result.self_reflection_questions.map((q, i) => (
            <div key={i} className="flex gap-4 items-start bg-white border border-[#EFE7DC] p-5">
              <div className="text-2xl font-bold text-[#EFE7DC] leading-none tabular-nums flex-shrink-0 mt-1">
                {String(i + 1).padStart(2, "0")}
              </div>
              <p
                className="text-base md:text-lg text-[#1C1917] leading-relaxed font-medium"
                style={{ wordBreak: "keep-all" }}
              >
                {q}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-500 mt-4">
          서류에서 감지된 패턴은 면접에서 꼬리질문으로 이어질 수 있습니다.
        </p>
      </section>

      {/* 06 정리 방향 */}
      <section>
        <div className={BLOCK_LABEL_CLASS}>
          06 · 정리 방향
        </div>
        <div className="bg-[#EFE7DC] border border-[#8B7355] p-8 md:p-10">
          <div className="space-y-5">
            {result.one_pager_summary
              .split(/\n\n+/)
              .filter((p) => p.trim())
              .map((paragraph, idx) => (
                <p
                  key={idx}
                  className="text-base md:text-[17px] text-[#1C1917] leading-[1.95]"
                  style={{ wordBreak: "keep-all" }}
                >
                  {renderMarkdownBold(paragraph, BOLD_HIGHLIGHT_CLASS)}
                </p>
              ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-neutral-200 pt-10 mt-16">
        <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-4">
          다음 선택
        </div>
        <h2
          className="text-2xl md:text-3xl font-bold text-[#1C1917] leading-tight tracking-tight mb-5"
          style={{ wordBreak: "keep-all" }}
        >
          결과를 확인했다면, 필요한 깊이를 선택하세요.
        </h2>
        <p className="text-[#6B625C] leading-relaxed mb-3 max-w-2xl text-base md:text-lg">
          이 결과만으로도 현재 서류의 주요 문제 유형을 확인할 수 있습니다.
        </p>
        <p className="text-[#6B625C] leading-relaxed mb-3 max-w-2xl text-base md:text-lg">
          더 깊게 보고 싶다면 1:1 상담에서 실제 문장과 면접 답변 구조까지 함께 정리합니다.
        </p>
        <p className="text-[#6B625C] leading-relaxed mb-8 max-w-2xl text-base md:text-lg">
          상담 신청은 선택입니다.
        </p>
        <div className="flex flex-col md:flex-row gap-3">
          <a
            href="mailto:naminimiya@gmail.com"
            className="w-full md:w-auto bg-[#1C1917] hover:bg-black text-white px-8 py-4 text-sm font-semibold tracking-[0.15em] text-center transition-colors"
          >
            진단 결과를 바탕으로 상담 문의하기
          </a>
          <button
            onClick={onReset}
            className="w-full md:w-auto border border-neutral-300 hover:border-neutral-900 text-neutral-700 hover:text-neutral-900 px-8 py-4 text-sm font-semibold tracking-[0.15em] transition-colors"
          >
            다시 진단하기
          </button>
        </div>
      </section>

      <ConsultRequestForm result={result} />
    </motion.div>
  );
}
