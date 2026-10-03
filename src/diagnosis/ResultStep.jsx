import React from "react";
import { motion } from "framer-motion";
import {
  renderMarkdownBold,
  BOLD_HIGHLIGHT_CLASS,
} from "../shared/render-markdown-bold.jsx";
import ConsultRequestForm from "./ConsultRequestForm.jsx";
import FeedbackCard from "./FeedbackCard.jsx";
import { KAKAO_CHANNEL_URL, OPERATOR_EMAIL } from "../shared/contact.js";

// 이력서 진단 결과: "고치는 법" 보고서.
// 핵심 판정 → 5가지 패턴 점수 → 걸리는 문장(왜, 무엇을 채울지) → 면접 꼬리질문 → 다음에 할 일.

const PATTERNS = [
  { id: "pattern_05", key: "pattern_05_industry_context_absence", name: "업계 맥락 부재", blurb: "이 회사·직무를 이해했는지 보이지 않음" },
  { id: "pattern_01", key: "pattern_01_generic_template", name: "규격화된 정형성", blurb: "누구의 서류인지 구분되지 않음" },
  { id: "pattern_02", key: "pattern_02_unsupported_claims", name: "근거 부재와 과장", blurb: "주장은 있는데 뒷받침이 없음" },
  { id: "pattern_04", key: "pattern_04_job_fit_mismatch", name: "직무 적합성 어긋남", blurb: "직무가 원하는 것과 강조점이 다름" },
  { id: "pattern_03", key: "pattern_03_differentiation_mishandling", name: "차별화 판단 오류", blurb: "약점을 스스로 먼저 드러냄" },
];

function stripBold(s) {
  return s ? s.replace(/\*\*([^*]+)\*\*/g, "$1") : "";
}

// Patterns from the most to the least troubling, with the root cause marked.
function rankedPatterns(scores = {}, rootCause) {
  return PATTERNS
    .map((p) => ({ ...p, score: Math.round(Math.min(1, Math.max(0, Number(scores[p.key]) || 0)) * 100), root: p.id === rootCause }))
    .sort((a, b) => b.score - a.score);
}

// Results made before the report format changed carry questions as plain strings.
function interviewQuestionsOf(result) {
  if (Array.isArray(result.interview_questions) && result.interview_questions.length) return result.interview_questions;
  return (result.self_reflection_questions || []).map((question) => ({ question, checks: "", answer_point: "" }));
}

export default function ResultStep({ result, onReset, onStartExperience }) {
  const patterns = rankedPatterns(result.pattern_scores, result.root_cause);
  const evidence = (result.evidence || []).slice(0, 3);
  const questions = interviewQuestionsOf(result);
  const plan = result.plan || {};
  const steps = [
    { label: "버릴 표현", text: plan.drop },
    { label: "살릴 근거", text: plan.keep },
    { label: "다시 짤 방향", text: plan.rebuild },
  ].filter((s) => s.text);

  return (
    <motion.div
      key="result"
      className="xp"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Print-only styles: hide chrome, keep the report readable on paper */}
      <style>{`
        @media print {
          @page { size: A4; margin: 18mm 16mm; }
          .aro-print-hide,
          header[style*="sticky"],
          .aro-skip-link,
          a[href^="#"]:not(.aro-print-keep) {
            display: none !important;
          }
          html, body, .xp { background: #FFFFFF !important; }
          .xp-card, .xp-hero { box-shadow: none !important; border: 1px solid #DDD !important; }
          .xp-hero { background: #FFFFFF !important; color: #0B0B0C !important; }
          .xp-hero .xp-label, .xp-hero-body { color: #3A3A3F !important; }
          h1, h2, h3 { page-break-after: avoid; break-after: avoid; }
          section, article { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>

      <main className="xp-main">
        <section className="xp-screen xp-result">
          <div className="xp-result-top">
            <p className="xp-context">써둔 이력서 진단 · 결과</p>
            <button type="button" className="xp-btn xp-btn--ghost xp-btn--small aro-print-hide" onClick={() => window.print()} aria-label="진단 결과 인쇄 또는 PDF로 저장">
              PDF로 저장
            </button>
          </div>
          <h1 tabIndex={-1}>평가자가 먼저 걸리는 지점이에요</h1>
          <p className="xp-sub">걸리는 이유를 보고, 문장마다 무엇을 채울지 확인해 보세요.</p>

          {/* ① 핵심 판정 */}
          <section className="xp-hero" aria-labelledby="diag-verdict">
            <p className="xp-label" id="diag-verdict">핵심 판정</p>
            <p className="xp-hero-text">{stripBold(result.key_verdict)}</p>
            {result.root_diagnosis && <p className="xp-hero-body">{renderMarkdownBold(result.root_diagnosis, BOLD_HIGHLIGHT_CLASS)}</p>}
            {result.correctability && <p className="xp-hero-tag">{result.correctability}</p>}
          </section>

          {/* ② 5가지 패턴 */}
          <section className="xp-card" aria-labelledby="diag-patterns">
            <header><h2 id="diag-patterns">평가자가 보는 5가지 패턴</h2></header>
            <p className="xp-muted">점수가 높을수록 평가자가 더 걸려요.</p>
            <ol className="xp-bars">
              {patterns.map((p) => (
                <li key={p.id} className={p.root ? "xp-bar xp-bar--root" : "xp-bar"}>
                  <span className="xp-bar-name">
                    {p.name}{p.root && <em>근본 원인</em>}
                    <small>{p.blurb}</small>
                  </span>
                  <span className="xp-bar-track" aria-hidden="true"><i style={{ width: `${p.score}%` }} /></span>
                  <span className="xp-bar-val">{p.score}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* ③ 걸리는 문장 */}
          {evidence.length > 0 && (
            <section className="xp-card" aria-labelledby="diag-quotes">
              <header><h2 id="diag-quotes">원문에서 걸리는 문장</h2></header>
              <ul className="xp-quotes">
                {evidence.map((e, i) => (
                  <li key={i} className="xp-quote-item">
                    <blockquote className="xp-quote">"{e.quote}"</blockquote>
                    {e.signal && <span className="xp-tag">{e.signal.replace(/^Pattern\s*\d+\s*·\s*/i, "")}</span>}
                    <p className="xp-read"><b>평가자는 이렇게 읽어요</b>{e.why}</p>
                    {e.fill && <p className="xp-fill"><b>채울 것</b>{e.fill}</p>}
                    {onStartExperience && (
                      <button type="button" className="xp-link xp-left" onClick={() => onStartExperience(e.quote)}>
                        이 문장, 경험 정리로 채우기 →
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ④ 면접 꼬리질문 */}
          {questions.length > 0 && (
            <section className="xp-card" aria-labelledby="diag-interview">
              <header><h2 id="diag-interview">면접에서 이어질 질문</h2></header>
              <div className="xp-follow xp-follow--flush">
                {questions.map((q, i) => (
                  <div key={i} className="xp-follow-item">
                    <p className="xp-follow-q">{q.question}</p>
                    {q.checks && <p className="xp-follow-a"><b>확인하려는 것</b> {q.checks}</p>}
                    {q.answer_point && <p className="xp-follow-a"><b>준비</b> {q.answer_point}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ⑤ 다음에 할 일 */}
          {steps.length > 0 && (
            <section className="xp-card" aria-labelledby="diag-plan">
              <header><h2 id="diag-plan">다음에 할 일</h2></header>
              <ol className="xp-lines">
                {steps.map((s, i) => (
                  <li key={s.label} className="xp-line">
                    <span className="xp-num" aria-hidden="true">{i + 1}</span>
                    <div><p className="xp-strong">{s.label}</p><p className="xp-muted">{s.text}</p></div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* 상담·다시 하기 */}
          <section className="xp-card aro-print-hide">
            <header><h2>혼자 고치기 어렵다면</h2></header>
            <p className="xp-muted">걸리는 문장은 경험 정리로 하나씩 채울 수 있어요. 실제 문장과 면접 답변까지 함께 다듬고 싶다면 상담을 신청해 주세요.</p>
            <div className="xp-actions">
              <a className="xp-btn xp-btn--kakao" href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer" aria-label="카카오톡 채널로 상담 문의 (새 창)">
                <span aria-hidden="true">💬</span> 카카오톡으로 상담 문의
              </a>
              <a className="xp-btn xp-btn--ghost" href={`mailto:${OPERATOR_EMAIL}`}>이메일 문의</a>
              <button type="button" className="xp-btn xp-btn--ghost" onClick={onReset}>다시 진단하기</button>
            </div>
            <p className="xp-fine">상담 신청은 선택이에요.</p>
          </section>

          <div className="aro-print-hide xp-after">
            <FeedbackCard result={result} />
            <ConsultRequestForm result={result} />
          </div>
        </section>
      </main>
    </motion.div>
  );
}
