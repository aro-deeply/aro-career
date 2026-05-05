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

const BLOCK_KICKER = {
  fontSize: "0.6875rem",
  letterSpacing: "0.2em",
  color: "#5E4A36",
  fontWeight: 700,
  marginBottom: "1.5rem",
  textTransform: "uppercase",
};

export default function ResultStep({ result, onReset }) {
  const top3 = getTop3Patterns(result.pattern_scores);

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      style={{ background: "#FAFAF7" }}
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
            border: "1px solid rgba(28,25,23,.1)",
            borderRadius: "16px",
            padding: "clamp(1.75rem, 4vw, 3rem)",
            boxShadow: "0 1px 8px rgba(28,25,23,.06)",
          }}
        >
          <div style={{ marginBottom: "3rem" }}>
            <div
              style={{
                fontSize: "0.6875rem",
                letterSpacing: "0.25em",
                color: "#8B7355",
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
                color: "#1C1917",
                lineHeight: 1.25,
                letterSpacing: "-0.03em",
                marginBottom: "1rem",
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
              }}
            >
              현재 서류가 평가자에게 어떻게 읽히는지 아래 순서로 확인하세요.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "3rem" }}>
            {/* 01 핵심 원인 */}
            <section>
              <div style={BLOCK_KICKER}>01 / 핵심 원인</div>
              <div
                style={{
                  background: "#F7F1E8",
                  borderLeft: "4px solid #5E4A36",
                  padding: "1.75rem",
                  borderRadius: "0 10px 10px 0",
                }}
              >
                <p
                  style={{
                    fontSize: "1.0625rem",
                    color: "#1C1917",
                    lineHeight: 1.8,
                  }}
                >
                  {renderMarkdownBold(result.root_diagnosis, BOLD_HIGHLIGHT_CLASS)}
                </p>
                {result.key_verdict && (
                  <p
                    style={{
                      fontSize: "0.9375rem",
                      color: "#6B625C",
                      marginTop: "1rem",
                      lineHeight: 1.6,
                    }}
                  >
                    {result.key_verdict}
                  </p>
                )}
              </div>
            </section>

            {/* 02 감지된 문제 패턴 */}
            <section>
              <div style={BLOCK_KICKER}>02 / 감지된 문제 패턴</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {top3.map(({ key, label }) => (
                  <span
                    key={key}
                    style={{
                      display: "inline-block",
                      padding: "5px 14px",
                      borderRadius: "9999px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      background: "#EFE7DC",
                      color: "#5E4A36",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p
                style={{
                  fontSize: "0.72rem",
                  color: "#8B7355",
                  marginTop: "1rem",
                }}
              >
                점수 기준 상위 3개 패턴입니다. 평가자 관점에서 가장 눈에 띄는 문제 유형입니다.
              </p>
            </section>

            {/* 03 원문에서 감지된 위험 문장 */}
            <section>
              <div style={BLOCK_KICKER}>03 / 원문에서 감지된 위험 문장</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {result.evidence.slice(0, 3).map((e, i) => (
                  <div
                    key={i}
                    style={{
                      background: "rgba(28,25,23,.04)",
                      border: "1px solid rgba(28,25,23,.08)",
                      borderRadius: "10px",
                      padding: "1.25rem 1.5rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.625rem",
                        letterSpacing: "0.15em",
                        color: "#8B7355",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        marginBottom: "0.75rem",
                      }}
                    >
                      #{String(i + 1).padStart(2, "0")} · {e.signal}
                    </div>
                    <blockquote
                      style={{
                        fontSize: "0.9375rem",
                        color: "#1C1917",
                        marginBottom: "0.75rem",
                        paddingLeft: "1rem",
                        borderLeft: "2px solid #8B7355",
                        lineHeight: 1.7,
                        fontWeight: 500,
                        fontStyle: "normal",
                      }}
                    >
                      "{e.quote}"
                    </blockquote>
                    <p style={{ fontSize: "0.875rem", color: "#6B625C", lineHeight: 1.6 }}>
                      {e.why}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* 04 평가자 관점 */}
            <section>
              <div style={BLOCK_KICKER}>04 / 평가자 관점</div>
              <div
                style={{
                  background: "#FAFAF7",
                  border: "1px solid #EFE7DC",
                  borderRadius: "10px",
                  padding: "2rem 2.25rem",
                }}
              >
                <p
                  style={{
                    fontSize: "0.9375rem",
                    color: "#1C1917",
                    lineHeight: 1.95,
                    wordBreak: "keep-all",
                  }}
                >
                  {renderMarkdownBold(result.root_diagnosis, BOLD_HIGHLIGHT_CLASS)}
                </p>
                <p style={{ fontSize: "0.8125rem", color: "#6B625C", marginTop: "1rem", lineHeight: 1.6 }}>
                  위 진단은 입력된 문장에서 반복적으로 감지된 패턴을 평가자 시각으로 해석한 것입니다.
                </p>
              </div>
            </section>

            {/* 05 면접에서 이어질 수 있는 질문 */}
            <section>
              <div style={BLOCK_KICKER}>05 / 면접에서 이어질 수 있는 질문</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {result.self_reflection_questions.map((q, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: "1rem",
                      alignItems: "flex-start",
                      background: "#FFFFFF",
                      border: "1px solid #EFE7DC",
                      borderRadius: "10px",
                      padding: "1.125rem 1.25rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.25rem",
                        fontWeight: 700,
                        color: "#EFE7DC",
                        lineHeight: 1,
                        flexShrink: 0,
                        marginTop: "2px",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <p
                      style={{
                        fontSize: "0.9375rem",
                        color: "#1C1917",
                        lineHeight: 1.65,
                        fontWeight: 500,
                        wordBreak: "keep-all",
                      }}
                    >
                      {q}
                    </p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: "0.72rem", color: "#8B7355", marginTop: "1rem" }}>
                서류에서 감지된 패턴은 면접에서 꼬리질문으로 이어질 수 있습니다.
              </p>
            </section>

            {/* 06 정리 방향 */}
            <section>
              <div style={BLOCK_KICKER}>06 / 정리 방향</div>
              <div
                style={{
                  background: "linear-gradient(135deg, #EFE7DC, #F7F1E8)",
                  borderLeft: "5px solid #5E4A36",
                  borderRadius: "0 12px 12px 0",
                  padding: "2rem 2.25rem",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {result.one_pager_summary
                    .split(/\n\n+/)
                    .filter((p) => p.trim())
                    .map((paragraph, idx) => (
                      <p
                        key={idx}
                        style={{
                          fontSize: "0.9375rem",
                          color: "#1C1917",
                          lineHeight: 1.95,
                          wordBreak: "keep-all",
                        }}
                      >
                        {renderMarkdownBold(paragraph, BOLD_HIGHLIGHT_CLASS)}
                      </p>
                    ))}
                </div>
              </div>
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
          <div
            style={{
              fontSize: "0.6875rem",
              letterSpacing: "0.2em",
              color: "#8B7355",
              fontWeight: 700,
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            다음 선택
          </div>
          <h2
            style={{
              fontSize: "clamp(1.25rem, 3vw, 1.75rem)",
              fontWeight: 700,
              color: "#1C1917",
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
              color: "#6B625C",
              lineHeight: 1.7,
              marginBottom: "0.75rem",
              maxWidth: "600px",
              fontSize: "1rem",
            }}
          >
            이 결과만으로도 현재 서류의 주요 문제 유형을 확인할 수 있습니다.
          </p>
          <p
            style={{
              color: "#6B625C",
              lineHeight: 1.7,
              marginBottom: "0.75rem",
              maxWidth: "600px",
              fontSize: "1rem",
            }}
          >
            더 깊게 보고 싶다면 1:1 상담에서 실제 문장과 면접 답변 구조까지 함께 정리합니다.
          </p>
          <p
            style={{
              color: "#6B625C",
              lineHeight: 1.7,
              marginBottom: "2rem",
              maxWidth: "600px",
              fontSize: "1rem",
            }}
          >
            상담 신청은 선택입니다.
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
                background: "#1C1917",
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
              onMouseOut={(e) => (e.currentTarget.style.background = "#1C1917")}
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
                e.currentTarget.style.borderColor = "#1C1917";
                e.currentTarget.style.color = "#1C1917";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = "rgba(28,25,23,.25)";
                e.currentTarget.style.color = "#57534E";
              }}
            >
              다시 진단하기
            </button>
          </div>
        </div>

        <ConsultRequestForm result={result} />
      </div>
    </motion.div>
  );
}
