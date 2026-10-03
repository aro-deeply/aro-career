import React from "react";
import { motion } from "framer-motion";
import {
  renderMarkdownBold,
  BOLD_HIGHLIGHT_CLASS,
} from "../shared/render-markdown-bold.jsx";
import ConsultRequestForm from "./ConsultRequestForm.jsx";
import FeedbackCard from "./FeedbackCard.jsx";
import { KAKAO_CHANNEL_URL, OPERATOR_EMAIL } from "../shared/contact.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function stripBold(s) {
  if (!s) return "";
  return s.replace(/\*\*([^*]+)\*\*/g, "$1");
}

function firstSentence(s) {
  if (!s) return "";
  const clean = s.trim();
  const m = clean.match(/^.{1,80}?[.!?。]/);
  if (m) return m[0].trim();
  return clean.slice(0, 80).trim();
}

// ─── pattern metadata ────────────────────────────────────────────────────────

const PATTERN_META = {
  pattern_01_generic_template: {
    name: "규격화된 정형성",
    blurb: "어느 회사에도 제출할 수 있는 형식적 표현이 반복됩니다.",
  },
  pattern_02_unsupported_claims: {
    name: "근거 부재와 과장",
    blurb: "주장이 행동 근거 없이 결론으로만 제시됩니다.",
  },
  pattern_03_differentiation_mishandling: {
    name: "차별화 약함",
    blurb: "타 지원자와 구별되는 강점이 충분히 드러나지 않습니다.",
  },
  pattern_04_job_fit_mismatch: {
    name: "직무 적합성 정리 필요",
    blurb: "경험이 지원 직무의 평가 기준과 직접 연결되지 않습니다.",
  },
  pattern_05_industry_context_absence: {
    name: "지원 회사 이해 부족",
    blurb: "특정 회사가 아니라 어느 기업에도 제출 가능한 문장처럼 읽힙니다.",
  },
};

const PATTERN_PURPOSE = {
  pattern_01: "지원 동기·경험이 형식적 표현 너머에서 구체적인지 확인합니다.",
  pattern_02: "주장이 실제 행동 근거로 뒷받침되는지 확인합니다.",
  pattern_03: "다른 지원자와 구별되는 차별 지점이 무엇인지 확인합니다.",
  pattern_04: "지원 직무 기준에서 경험이 어떻게 연결되는지 확인합니다.",
  pattern_05: "특정 회사에 대한 이해와 선택 이유가 구체적인지 확인합니다.",
};

// ─── derived data helpers ────────────────────────────────────────────────────

function getTop3Patterns(patternScores) {
  return Object.entries(patternScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key]) => ({
      key,
      ...(PATTERN_META[key] || { name: key, blurb: "" }),
    }));
}

function getPurposeText(dominantPattern, rootCause) {
  const raw = dominantPattern || rootCause || "";
  // raw may be e.g. "pattern_05" or "pattern_05_industry_context_absence"
  const m = raw.match(/pattern_0?(\d+)/);
  if (m) {
    const id = "pattern_0" + m[1];
    if (PATTERN_PURPOSE[id]) return PATTERN_PURPOSE[id];
  }
  return "지원 동기와 경험이 구체적으로 뒷받침되는지 확인합니다.";
}

function getShortBody(text) {
  if (!text) return "";
  const plain = stripBold(text);
  const sentences = plain.match(/[^.!?。]+[.!?。]?/g) || [];
  return sentences.slice(0, 2).join(" ").trim();
}

function getFullBody(text) {
  if (!text) return "";
  const plain = stripBold(text);
  const sentences = plain.match(/[^.!?。]+[.!?。]?/g) || [];
  return sentences.slice(2).join(" ").trim();
}

// ─── component ───────────────────────────────────────────────────────────────

export default function ResultStep({ result, onReset, onStartExperience }) {
  const top3 = getTop3Patterns(result.pattern_scores);

  // Block 01 derivation
  const keyLine = result.key_verdict || firstSentence(stripBold(result.root_diagnosis));
  const shortBody = getShortBody(result.root_diagnosis);
  const fullBody = getFullBody(result.root_diagnosis);

  // Block 04 evaluator-flow derivation
  const step2Text =
    firstSentence(stripBold(result.root_diagnosis)) || result.key_verdict;
  const step3Question = result.self_reflection_questions?.[0] || "";

  // Block 05 purpose
  const purposeText = getPurposeText(
    result.dominant_pattern,
    result.root_cause
  );

  // Block 06 action plan derivation
  const summaryParagraphs = (result.one_pager_summary || "")
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  function getPlanItem(idx) {
    const para = summaryParagraphs[idx];
    if (!para) return "";
    const plain = stripBold(para);
    const sentences = plain.match(/[^.!?。]+[.!?。]?/g) || [];
    return sentences.slice(0, 2).join(" ").trim();
  }

  const plan = [getPlanItem(0), getPlanItem(1), getPlanItem(2)];

  return (
    <motion.div
      key="result"
      className="xp"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Print-only styles: hide chrome, expand result, B/W text */}
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
          <p className="xp-sub">문장을 고치기 전에, 왜 걸리는지부터 확인해 보세요.</p>

          {/* 01 핵심 원인 */}
          <section className="xp-hero" aria-labelledby="diag-core">
            <p className="xp-label" id="diag-core">핵심 원인</p>
            <p className="xp-hero-text">{keyLine}</p>
            {shortBody && <p className="xp-hero-body">{shortBody}</p>}
            {fullBody && (
              <details className="xp-evidence">
                <summary>자세한 해석 보기</summary>
                <p className="xp-hero-more">
                  {renderMarkdownBold(result.root_diagnosis, BOLD_HIGHLIGHT_CLASS)}
                  {result.correctability && <span className="xp-block">{result.correctability}</span>}
                </p>
              </details>
            )}
          </section>

          {/* 02 감지된 문제 패턴 */}
          <section className="xp-card">
            <header><h2>함께 걸린 패턴</h2></header>
            <ul className="xp-lines">
              {top3.map(({ key, name, blurb }) => (
                <li key={key} className="xp-line">
                  <span className="xp-dotmark" aria-hidden="true" />
                  <div><p className="xp-strong">{name}</p><p className="xp-muted">{blurb}</p></div>
                </li>
              ))}
            </ul>
          </section>

          {/* 03 원문에서 감지된 위험 문장 */}
          <section className="xp-card">
            <header><h2>원문에서 걸리는 문장</h2></header>
            <ul className="xp-quotes">
              {result.evidence.slice(0, 3).map((e, i) => (
                <li key={i} className="xp-quote-item">
                  <blockquote className="xp-quote">"{e.quote}"</blockquote>
                  <span className="xp-tag">{e.signal}</span>
                  <p className="xp-muted">{e.why}</p>
                  {onStartExperience && (
                    <button type="button" className="xp-link xp-left" onClick={() => onStartExperience(e.quote)}>
                      이 문장 뒤의 경험 정리하기 →
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* 04 평가자 관점 */}
          <section className="xp-card">
            <header><h2>평가자는 이렇게 읽어요</h2></header>
            <ol className="xp-lines">
              {[
                "좋은 태도와 의지는 충분히 전달됩니다.",
                step2Text,
                step3Question
                  ? `그래서 "${step3Question}"라는 질문이 남습니다.`
                  : "그래서 구체적인 근거가 남아 있는지 묻게 됩니다.",
              ].map((text, i) => (
                <li key={i} className="xp-line">
                  <span className="xp-num" aria-hidden="true">{i + 1}</span>
                  <p>{text}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* 05 면접에서 이어질 수 있는 질문 */}
          <section className="xp-card">
            <header><h2>면접에서 이어질 질문</h2></header>
            <p className="xp-muted">평가자가 확인하려는 것: {purposeText}</p>
            <div className="xp-follow">
              {result.self_reflection_questions.map((q, i) => (
                <div key={i} className="xp-follow-item"><p className="xp-follow-q">{q}</p></div>
              ))}
            </div>
          </section>

          {/* 06 정리 방향 */}
          <section className="xp-card">
            <header><h2>정리 방향</h2></header>
            <p className="xp-strong">개별 문장을 더 다듬기보다, 지원 기업과 직무 기준에 맞춰 이력서의 기준점을 다시 잡아야 합니다.</p>
            <ul className="xp-plan">
              {[
                { label: "버릴 표현", text: plan[0] },
                { label: "살릴 근거", text: plan[1] },
                { label: "다시 구성할 방향", text: plan[2] },
              ].map(({ label, text }) => (
                <li key={label}><b>{label}</b><p>{text || "본문에서 확인하세요."}</p></li>
              ))}
            </ul>
            <details className="xp-fold">
              <summary>자세한 정리 방향 보기</summary>
              <p className="xp-pre">{renderMarkdownBold(result.one_pager_summary, BOLD_HIGHLIGHT_CLASS)}</p>
            </details>
          </section>

          {/* Next steps */}
          <section className="xp-card aro-print-hide">
            <header><h2>다음에 할 일을 골라 주세요</h2></header>
            <p className="xp-muted">고칠 문장이 보였다면, 그 뒤의 경험부터 정리해 보세요. 실제 문장과 면접 답변까지 함께 다듬고 싶다면 상담을 신청할 수 있어요.</p>
            <div className="xp-actions">
              {onStartExperience && result.evidence?.[0]?.quote && (
                <button type="button" className="xp-btn" onClick={() => onStartExperience(result.evidence[0].quote)}>
                  첫 문장 뒤의 경험 정리하기
                </button>
              )}
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
