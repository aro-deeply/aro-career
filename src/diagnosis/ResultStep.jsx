import React from "react";
import { motion } from "framer-motion";
import {
  renderMarkdownBold,
  BOLD_HIGHLIGHT_CLASS,
} from "../shared/render-markdown-bold.jsx";
import ConsultRequestForm from "./ConsultRequestForm.jsx";

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

// ─── style constants ─────────────────────────────────────────────────────────

const BLOCK_KICKER = {
  fontSize: "0.6875rem",
  letterSpacing: "0.2em",
  color: "#5E4A36",
  fontWeight: 700,
  marginBottom: "1.5rem",
  textTransform: "uppercase",
};

const VAR_INK = "#1C1917";
const VAR_INK80 = "#6B625C";
const VAR_MUTED = "#8B7355";
const VAR_ACCENT = "#5E4A36";
const VAR_BG = "#FAFAF7";
const VAR_BORDER = "rgba(28,25,23,.08)";
const VAR_BORDER10 = "rgba(28,25,23,.10)";
const VAR_ACCENT_BG = "rgba(94,74,54,.1)";
const VAR_ACCENT_BG2 = "rgba(94,74,54,.12)";

// ─── component ───────────────────────────────────────────────────────────────

export default function ResultStep({ result, onReset }) {
  const top3 = getTop3Patterns(result.pattern_scores);

  // Block 01 derivation
  const keyLine = result.key_verdict || firstSentence(stripBold(result.root_diagnosis));
  const shortBody = getShortBody(result.root_diagnosis);
  const fullBody = getFullBody(result.root_diagnosis);

  // Summary Snapshot derivation
  const snapshot = [
    {
      label: "핵심 문제",
      text:
        result.key_verdict ||
        firstSentence(stripBold(result.root_diagnosis)),
    },
    {
      label: "면접 리스크",
      text:
        result.self_reflection_questions?.[0] ||
        "면접에서 추가 질문으로 이어질 수 있습니다.",
    },
    {
      label: "정리 방향",
      text:
        firstSentence(
          stripBold(
            result.one_pager_summary?.split(/\n\n+/)?.pop() ||
              result.one_pager_summary
          )
        ) || "방향은 결과 본문을 확인하세요.",
    },
  ];

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ background: VAR_BG }}
    >
      {/* Result content card */}
      <div
        style={{
          maxWidth: "860px",
          margin: "0 auto",
          padding: "clamp(2rem, 5vw, 4rem) 1.5rem",
        }}
      >
        <div
          style={{
            background: "#FFFFFF",
            border: `1px solid ${VAR_BORDER10}`,
            borderRadius: "16px",
            padding: "clamp(1.75rem, 4vw, 3rem)",
            boxShadow: "0 1px 8px rgba(28,25,23,.06)",
          }}
        >
          {/* Heading */}
          <div style={{ marginBottom: "2rem" }}>
            <div
              style={{
                fontSize: "0.6875rem",
                letterSpacing: "0.25em",
                color: VAR_MUTED,
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: "1.25rem",
              }}
            >
              진단 결과
            </div>
            <h1
              style={{
                fontSize: "clamp(1.6rem, 3.5vw, 2.25rem)",
                fontWeight: 700,
                color: VAR_INK,
                lineHeight: 1.25,
                letterSpacing: "-0.03em",
                marginBottom: "0.75rem",
                wordBreak: "keep-all",
              }}
            >
              진단 결과가 정리되었습니다.
            </h1>
            <p
              style={{
                color: "#57534E",
                fontSize: "1.0625rem",
                lineHeight: 1.65,
                wordBreak: "keep-all",
              }}
            >
              현재 서류가 평가자에게 어떻게 읽히는지 핵심만 먼저 확인하세요.
            </p>
          </div>

          {/* Summary Snapshot */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "14px",
              margin: "32px 0 48px",
            }}
          >
            {snapshot.map((card) => (
              <div
                key={card.label}
                style={{
                  background: "#fff",
                  border: `1px solid ${VAR_BORDER10}`,
                  borderRadius: "14px",
                  padding: "20px",
                }}
              >
                <span
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "0.72rem",
                    letterSpacing: "0.08em",
                    color: VAR_ACCENT,
                    fontWeight: 800,
                  }}
                >
                  {card.label}
                </span>
                <strong
                  style={{
                    display: "block",
                    fontSize: "1.02rem",
                    lineHeight: 1.55,
                    color: VAR_INK,
                    fontWeight: 700,
                    wordBreak: "keep-all",
                  }}
                >
                  {card.text}
                </strong>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
            {/* 01 핵심 원인 */}
            <section>
              <div style={BLOCK_KICKER}>01 / 핵심 원인</div>
              <div className="result-block">
                <p
                  style={{
                    fontSize: "1.18rem",
                    lineHeight: 1.48,
                    fontWeight: 800,
                    color: VAR_INK,
                    letterSpacing: "-0.015em",
                    margin: "0 0 12px",
                    wordBreak: "keep-all",
                  }}
                >
                  {keyLine}
                </p>
                {shortBody && (
                  <p
                    style={{
                      fontSize: "0.98rem",
                      lineHeight: 1.7,
                      color: VAR_INK80,
                      margin: 0,
                      wordBreak: "keep-all",
                    }}
                  >
                    {shortBody}
                  </p>
                )}
                {fullBody && (
                  <details
                    style={{
                      marginTop: "16px",
                      borderTop: `1px solid ${VAR_BORDER}`,
                      paddingTop: "14px",
                    }}
                  >
                    <summary
                      style={{
                        cursor: "pointer",
                        fontSize: "0.9rem",
                        color: VAR_ACCENT,
                        fontWeight: 700,
                        listStyle: "none",
                      }}
                    >
                      상세 해석 보기
                    </summary>
                    <p
                      style={{
                        marginTop: "12px",
                        color: VAR_INK80,
                        lineHeight: 1.75,
                        whiteSpace: "pre-line",
                        wordBreak: "keep-all",
                      }}
                    >
                      {renderMarkdownBold(result.root_diagnosis, BOLD_HIGHLIGHT_CLASS)}
                      {result.correctability && (
                        <span
                          style={{
                            display: "block",
                            marginTop: "8px",
                            fontSize: "0.875rem",
                          }}
                        >
                          {result.correctability}
                        </span>
                      )}
                    </p>
                  </details>
                )}
              </div>
            </section>

            {/* 02 감지된 문제 패턴 */}
            <section>
              <div style={BLOCK_KICKER}>02 / 감지된 문제 패턴</div>
              <ul
                style={{
                  listStyle: "none",
                  margin: "16px 0 0",
                  padding: 0,
                  display: "grid",
                  gap: "12px",
                }}
              >
                {top3.map(({ key, name, blurb }) => (
                  <li
                    key={key}
                    style={{
                      padding: "14px 16px",
                      background: "rgba(255,255,255,.7)",
                      border: `1px solid ${VAR_BORDER}`,
                      borderRadius: "10px",
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: VAR_INK,
                        marginBottom: "4px",
                      }}
                    >
                      {name}
                    </strong>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.92rem",
                        lineHeight: 1.6,
                        color: VAR_MUTED,
                        wordBreak: "keep-all",
                      }}
                    >
                      {blurb}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            {/* 03 원문에서 감지된 위험 문장 */}
            <section>
              <div style={BLOCK_KICKER}>03 / 원문에서 감지된 위험 문장</div>
              <div>
                {result.evidence.slice(0, 3).map((e, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "18px 20px",
                      background: "rgba(255,255,255,.72)",
                      border: `1px solid ${VAR_BORDER}`,
                      borderRadius: "12px",
                      marginTop: i > 0 ? "12px" : 0,
                    }}
                  >
                    <blockquote
                      style={{
                        margin: "0 0 10px",
                        padding: "10px 14px",
                        background: "rgba(28,25,23,.04)",
                        borderLeft: "2px solid rgba(28,25,23,.18)",
                        borderRadius: "6px",
                        fontSize: "0.96rem",
                        lineHeight: 1.6,
                        color: VAR_MUTED,
                        fontStyle: "normal",
                        wordBreak: "keep-all",
                      }}
                    >
                      "{e.quote}"
                    </blockquote>
                    <div style={{ marginBottom: "8px" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          background: VAR_ACCENT_BG,
                          color: VAR_ACCENT,
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          borderRadius: "999px",
                        }}
                      >
                        {e.signal}
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.94rem",
                        lineHeight: 1.65,
                        color: VAR_INK80,
                        wordBreak: "keep-all",
                      }}
                    >
                      {e.why}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* 04 평가자 관점 */}
            <section>
              <div style={BLOCK_KICKER}>04 / 평가자 관점</div>
              <ul
                style={{
                  listStyle: "none",
                  display: "grid",
                  gap: "10px",
                  margin: "16px 0 0",
                  padding: 0,
                  counterReset: "flow",
                }}
              >
                {[
                  "좋은 태도와 의지는 충분히 전달됩니다.",
                  step2Text,
                  step3Question
                    ? `그래서 "${step3Question}"라는 질문이 남습니다.`
                    : "그래서 구체적인 근거가 남아 있는지 묻게 됩니다.",
                ].map((text, i) => (
                  <li
                    key={i}
                    style={{
                      background: "rgba(255,255,255,.72)",
                      border: `1px solid ${VAR_BORDER}`,
                      borderRadius: "10px",
                      padding: "14px 16px 14px 56px",
                      fontSize: "0.96rem",
                      lineHeight: 1.6,
                      color: VAR_INK80,
                      position: "relative",
                      wordBreak: "keep-all",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: "16px",
                        top: "14px",
                        width: "22px",
                        height: "22px",
                        borderRadius: "999px",
                        background: VAR_ACCENT_BG2,
                        color: VAR_ACCENT,
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {i + 1}
                    </span>
                    {text}
                  </li>
                ))}
              </ul>
            </section>

            {/* 05 면접에서 이어질 수 있는 질문 */}
            <section>
              <div style={BLOCK_KICKER}>05 / 면접에서 이어질 수 있는 질문</div>
              <ul
                style={{
                  listStyle: "none",
                  display: "grid",
                  gap: "12px",
                  margin: "16px 0 0",
                  padding: 0,
                }}
              >
                {result.self_reflection_questions.map((q, i) => (
                  <li
                    key={i}
                    style={{
                      padding: "16px 18px",
                      background: "rgba(255,255,255,.72)",
                      border: `1px solid ${VAR_BORDER}`,
                      borderRadius: "12px",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 8px",
                        fontSize: "1rem",
                        lineHeight: 1.6,
                        fontWeight: 700,
                        color: VAR_INK,
                        wordBreak: "keep-all",
                      }}
                    >
                      {q}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.82rem",
                        lineHeight: 1.55,
                        color: VAR_MUTED,
                        wordBreak: "keep-all",
                      }}
                    >
                      확인하려는 것 — {purposeText}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            {/* 06 정리 방향 */}
            <section>
              <div style={BLOCK_KICKER}>06 / 정리 방향</div>
              <p
                style={{
                  fontSize: "1.02rem",
                  lineHeight: 1.6,
                  color: VAR_INK,
                  fontWeight: 700,
                  margin: "0 0 18px",
                  wordBreak: "keep-all",
                }}
              >
                개별 문장을 더 다듬기보다, 지원 기업과 직무 기준에 맞춰 이력서의 기준점을 다시 잡아야 합니다.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "14px",
                  marginTop: "18px",
                }}
              >
                {[
                  { label: "버릴 표현", text: plan[0] },
                  { label: "살릴 근거", text: plan[1] },
                  { label: "다시 구성할 방향", text: plan[2] },
                ].map(({ label, text }) => (
                  <div
                    key={label}
                    style={{
                      background: "#fff",
                      border: `1px solid ${VAR_BORDER10}`,
                      borderRadius: "14px",
                      padding: "18px",
                    }}
                  >
                    <span
                      style={{
                        display: "block",
                        fontSize: "0.72rem",
                        letterSpacing: "0.08em",
                        color: VAR_ACCENT,
                        fontWeight: 800,
                        marginBottom: "8px",
                      }}
                    >
                      {label}
                    </span>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.94rem",
                        lineHeight: 1.62,
                        color: VAR_INK80,
                        wordBreak: "keep-all",
                      }}
                    >
                      {text || "본문에서 확인하세요."}
                    </p>
                  </div>
                ))}
              </div>
              <details
                style={{
                  marginTop: "16px",
                  borderTop: `1px solid ${VAR_BORDER}`,
                  paddingTop: "14px",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    color: VAR_ACCENT,
                    fontWeight: 700,
                    listStyle: "none",
                  }}
                >
                  상세 정리 방향 보기
                </summary>
                <p
                  style={{
                    marginTop: "12px",
                    color: VAR_INK80,
                    lineHeight: 1.75,
                    whiteSpace: "pre-line",
                    wordBreak: "keep-all",
                  }}
                >
                  {renderMarkdownBold(result.one_pager_summary, BOLD_HIGHLIGHT_CLASS)}
                </p>
              </details>
            </section>
          </div>
        </div>

        {/* Bottom CTA */}
        <div
          style={{
            marginTop: "3rem",
            paddingTop: "2.5rem",
            borderTop: "1px solid rgba(28,25,23,.1)",
          }}
        >
          <h2
            style={{
              fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
              fontWeight: 700,
              color: VAR_INK,
              lineHeight: 1.3,
              letterSpacing: "-0.025em",
              marginBottom: "1.25rem",
              wordBreak: "keep-all",
            }}
          >
            결과를 확인했다면, 필요한 깊이를 선택하세요.
          </h2>
          <p
            style={{
              color: VAR_INK80,
              lineHeight: 1.7,
              marginBottom: "0.75rem",
              maxWidth: "600px",
              fontSize: "1rem",
              wordBreak: "keep-all",
            }}
          >
            지금 결과만으로도 주요 문제 유형은 확인할 수 있습니다.
          </p>
          <p
            style={{
              color: VAR_INK80,
              lineHeight: 1.7,
              marginBottom: "2rem",
              maxWidth: "600px",
              fontSize: "1rem",
              wordBreak: "keep-all",
            }}
          >
            실제 문장과 면접 답변 구조까지 정리하고 싶다면 상담을 선택하세요.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <a
              href="mailto:naminimiya@gmail.com"
              style={{
                background: VAR_INK,
                color: "#FAFAF7",
                padding: "15px 28px",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textDecoration: "none",
                borderRadius: "8px",
                display: "inline-block",
                transition: "background .2s",
                textAlign: "center",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = "#000")}
              onMouseOut={(e) => (e.currentTarget.style.background = VAR_INK)}
            >
              진단 결과를 바탕으로 상담 문의하기
            </a>
            <button
              onClick={onReset}
              style={{
                border: "1px solid rgba(28,25,23,.25)",
                background: "transparent",
                color: "#57534E",
                padding: "15px 28px",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "border-color .2s, color .2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = VAR_INK;
                e.currentTarget.style.color = VAR_INK;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = "rgba(28,25,23,.25)";
                e.currentTarget.style.color = "#57534E";
              }}
            >
              다시 진단하기
            </button>
          </div>
          <p
            style={{
              marginTop: "1rem",
              fontSize: "0.8125rem",
              color: VAR_MUTED,
            }}
          >
            상담 신청은 선택입니다.
          </p>
        </div>

        <ConsultRequestForm result={result} />
      </div>
    </motion.div>
  );
}
