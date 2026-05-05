import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const SITUATIONS = [
  "서류에서 자주 막힘",
  "면접에서 자주 막힘",
  "경험이 부족하다고 느낌",
  "경력은 있지만 강점이 흐림",
  "공백·전환·짧은 경력 설명이 어려움",
  "지원동기 작성이 어려움",
];

const FONT_STACK = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

export default function InputStep({
  formData,
  setFormData,
  consent,
  setConsent,
  turnstileToken,
  setTurnstileToken,
  error,
  onSubmit,
}) {
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    function tryMount() {
      if (cancelled) return;
      if (window.turnstile && turnstileRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: "0x4AAAAAADFpsfyi_rcbyT0P",
          callback: (token) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(null),
          "error-callback": () => setTurnstileToken(null),
        });
      } else {
        setTimeout(tryMount, 200);
      }
    }
    tryMount();
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch (e) {}
      }
    };
  }, [setTurnstileToken]);

  return (
    <motion.div
      key="input"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4 }}
      style={{ fontFamily: FONT_STACK }}
    >
      {/* ── Dark editorial hero ── */}
      <section
        style={{
          background: "#1C1917",
          padding: "clamp(3rem, 6vw, 5rem) 0",
        }}
      >
        <div
          className="max-w-5xl mx-auto px-6"
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: "clamp(3rem, 5vw, 4.5rem)",
            alignItems: "start",
          }}
        >
          {/* Copy column */}
          <div>
            <span
              style={{
                display: "block",
                fontSize: "0.72rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#B48A5A",
                marginBottom: "1.25rem",
              }}
            >
              Evaluator-based Diagnosis
            </span>
            <h1
              style={{
                fontWeight: 700,
                letterSpacing: "-0.04em",
                lineHeight: 1.16,
                fontSize: "clamp(2rem, 4vw, 3.2rem)",
                color: "#FAFAF7",
                wordBreak: "keep-all",
                marginBottom: "1.5rem",
              }}
            >
              현재 서류가 평가자에게 어떻게 읽히는지 확인합니다.
            </h1>
            <p
              style={{
                fontSize: "1.0625rem",
                lineHeight: 1.7,
                color: "rgba(250,250,247,.78)",
                maxWidth: "540px",
                marginBottom: "1rem",
              }}
            >
              이력서와 면접 답변을 입력하면, 지원하는 자리의 기준에서 부족한 근거, 위험 문장, 면접에서 이어질 수 있는 질문을 먼저 정리합니다.
            </p>
            <p
              style={{
                fontSize: "0.9rem",
                lineHeight: 1.6,
                color: "rgba(250,250,247,.56)",
                maxWidth: "540px",
              }}
            >
              사전 진단은 비용 없이 진행되며, 결과 확인 후 상담 여부를 선택할 수 있습니다.
            </p>
          </div>

          {/* Card column */}
          <aside
            style={{
              background: "rgba(250,250,247,.05)",
              border: "1px solid rgba(250,250,247,.12)",
              borderRadius: "16px",
              padding: "28px",
            }}
          >
            <p
              style={{
                fontSize: "0.65rem",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#B48A5A",
                marginBottom: "1rem",
              }}
            >
              진단 결과에서 확인하는 것
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {["문제 유형", "위험 문장", "면접 꼬리질문", "정리 방향"].map((item) => (
                <li
                  key={item}
                  style={{
                    color: "rgba(250,250,247,.85)",
                    fontWeight: 500,
                    fontSize: "0.9375rem",
                    padding: "8px 0",
                    borderBottom: "1px solid rgba(250,250,247,.08)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ color: "#B48A5A", fontSize: "0.7rem" }}>—</span>
                  {item}
                </li>
              ))}
            </ul>
          </aside>
        </div>

        {/* Mobile: stack card below copy via CSS */}
        <style>{`
          @media (max-width: 900px) {
            .diag-hero-inner {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </section>

      {/* ── Warm paper form section ── */}
      <section
        style={{
          background: "#FAFAF7",
          padding: "clamp(2.5rem, 5vw, 4rem) 1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: "920px",
            margin: "0 auto",
            background: "#FFFFFF",
            border: "1px solid rgba(28,25,23,.1)",
            borderRadius: "16px",
            padding: "clamp(22px, 4vw, 36px)",
            boxShadow: "0 1px 8px rgba(28,25,23,.06)",
          }}
        >
          <h2
            style={{
              fontWeight: 700,
              fontSize: "1.25rem",
              letterSpacing: "-0.02em",
              color: "#1C1917",
              marginBottom: "0.5rem",
              wordBreak: "keep-all",
            }}
          >
            진단에 필요한 정보를 입력해 주세요.
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#57534E", lineHeight: 1.6, marginBottom: "0.4rem" }}>
            완성된 서류가 아니어도 괜찮습니다. 현재 작성한 문장 그대로 입력해 주세요.
          </p>
          <p style={{ fontSize: "0.8125rem", color: "#8B7355", marginBottom: "2.5rem" }}>
            사전 진단은 비용 없이 진행됩니다.
          </p>

          <div className="space-y-10">
            {/* Field 01 */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.6875rem",
                  letterSpacing: "0.2em",
                  color: "#57534E",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  marginBottom: "0.5rem",
                }}
              >
                01 · 지원하는 자리
              </label>
              <p style={{ fontSize: "0.75rem", color: "#8B7355", marginBottom: "0.6rem" }}>
                지원 회사나 직무를 알수록 더 정확한 기준으로 읽을 수 있습니다.
              </p>
              <input
                type="text"
                value={formData.jobTarget}
                onChange={(e) => setFormData({ ...formData, jobTarget: e.target.value })}
                placeholder="예: 패션 브랜드 MD 신입, 제조업 인사 직무, 플랫폼 운영 PM"
                style={{
                  width: "100%",
                  borderBottom: "2px solid #D6CEC6",
                  background: "transparent",
                  padding: "10px 0",
                  fontSize: "1rem",
                  color: "#1C1917",
                  outline: "none",
                  transition: "border-color .2s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderBottomColor = "#1C1917")}
                onBlur={(e) => (e.target.style.borderBottomColor = "#D6CEC6")}
              />
            </div>

            {/* Field 02 */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.6875rem",
                  letterSpacing: "0.2em",
                  color: "#57534E",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  marginBottom: "1rem",
                }}
              >
                02 · 현재 막히는 지점
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SITUATIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setFormData({ ...formData, situation: s })}
                    style={{
                      padding: "14px 12px",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      border: formData.situation === s
                        ? "2px solid #1C1917"
                        : "1px solid rgba(28,25,23,.18)",
                      background: formData.situation === s ? "#1C1917" : "#FFFFFF",
                      color: formData.situation === s ? "#FAFAF7" : "#57534E",
                      borderRadius: "8px",
                      cursor: "pointer",
                      wordBreak: "keep-all",
                      lineHeight: 1.4,
                      transition: "all .15s",
                      textAlign: "left",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Field 03 */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.6875rem",
                  letterSpacing: "0.2em",
                  color: "#57534E",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  marginBottom: "0.5rem",
                }}
              >
                03 · 현재 이력서 또는 면접 답변
              </label>
              <p style={{ fontSize: "0.75rem", color: "#8B7355", marginBottom: "0.75rem" }}>
                이력서 문장, 자기소개서 일부, 면접 답변 초안 중 무엇이든 입력할 수 있습니다.
              </p>
              <textarea
                value={formData.resume}
                onChange={(e) => setFormData({ ...formData, resume: e.target.value.slice(0, 3000) })}
                placeholder="현재 작성한 문장을 그대로 붙여넣어 주세요."
                rows={9}
                style={{
                  width: "100%",
                  border: "1.5px solid rgba(28,25,23,.18)",
                  borderRadius: "10px",
                  background: "#FAFAF7",
                  padding: "16px",
                  fontSize: "0.9375rem",
                  color: "#1C1917",
                  outline: "none",
                  lineHeight: 1.7,
                  resize: "vertical",
                  transition: "border-color .2s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderColor = "#5E4A36")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(28,25,23,.18)")}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                <p style={{ fontSize: "0.72rem", color: "#8B7355" }}>
                  주민등록번호, 주소, 연락처 등 민감한 개인정보는 제외하고 입력해 주세요.
                </p>
                <span style={{ fontSize: "0.72rem", color: "#8B7355", flexShrink: 0, marginLeft: "12px", fontVariantNumeric: "tabular-nums" }}>
                  {formData.resume.length} / 3,000자
                </span>
              </div>
            </div>

            {/* Field 04 */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.6875rem",
                  letterSpacing: "0.2em",
                  color: "#57534E",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  marginBottom: "0.5rem",
                }}
              >
                04 · 추가로 확인할 맥락{" "}
                <span style={{ color: "#8B7355", fontWeight: 400, fontSize: "0.65rem" }}>(선택)</span>
              </label>
              <p style={{ fontSize: "0.75rem", color: "#8B7355", marginBottom: "0.6rem" }}>
                최근 탈락 경험, 지원 중인 회사, 가장 고민되는 부분을 적어 주세요.
              </p>
              <input
                type="text"
                value={formData.rejection}
                onChange={(e) => setFormData({ ...formData, rejection: e.target.value })}
                placeholder="예: 서류는 통과하는데 면접에서 답변이 길어집니다."
                style={{
                  width: "100%",
                  borderBottom: "2px solid #D6CEC6",
                  background: "transparent",
                  padding: "10px 0",
                  fontSize: "1rem",
                  color: "#1C1917",
                  outline: "none",
                  transition: "border-color .2s",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.borderBottomColor = "#1C1917")}
                onBlur={(e) => (e.target.style.borderBottomColor = "#D6CEC6")}
              />
            </div>

            {error && (
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "#b91c1c",
                  borderLeft: "2px solid #b91c1c",
                  paddingLeft: "1rem",
                  paddingTop: "8px",
                  paddingBottom: "8px",
                  background: "#fef2f2",
                }}
              >
                {error}
              </div>
            )}

            <div style={{ marginTop: "24px", marginBottom: "16px" }} ref={turnstileRef}></div>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                marginBottom: "16px",
                fontSize: "0.875rem",
                color: "#57534E",
                lineHeight: 1.6,
              }}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: "3px", flexShrink: 0 }}
              />
              <span>
                <b>(필수)</b> 입력한 내용은 진단 결과 생성 및 상담 요청 시 참고 목적으로만 사용됩니다.
                <br />
                <span style={{ color: "#8B7355", fontSize: "0.72rem" }}>
                  · 보관 기간: 신청 후 6개월 · 문의/삭제:{" "}
                  <a href="mailto:naminimiya@gmail.com" style={{ textDecoration: "underline" }}>
                    naminimiya@gmail.com
                  </a>
                </span>
              </span>
            </label>

            <div
              style={{
                paddingTop: "2rem",
                borderTop: "1px solid rgba(28,25,23,.1)",
              }}
            >
              <button
                onClick={onSubmit}
                disabled={!consent || !turnstileToken}
                style={{
                  width: "100%",
                  background: "#1C1917",
                  color: "#FAFAF7",
                  padding: "16px 40px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  letterSpacing: "0.12em",
                  border: "none",
                  borderRadius: "8px",
                  cursor: (!consent || !turnstileToken) ? "not-allowed" : "pointer",
                  opacity: (!consent || !turnstileToken) ? 0.5 : 1,
                  transition: "background .2s",
                }}
                onMouseOver={(e) => {
                  if (consent && turnstileToken) e.currentTarget.style.background = "#000000";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "#1C1917";
                }}
              >
                진단 결과 확인하기
              </button>
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#8B7355",
                  marginTop: "12px",
                  lineHeight: 1.5,
                }}
              >
                약 3분 입력 · 결과 확인 후 상담 선택
              </p>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
