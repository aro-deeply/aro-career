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
      <style>{`
        .diag-hero {
          position: relative;
          min-height: calc(100vh - 84px);
          padding: 88px 0 96px;
          background:
            radial-gradient(circle at 80% 20%, rgba(180,138,90,.12), transparent 32%),
            linear-gradient(180deg, #FAFAF7 0%, #F7F1E8 100%);
          display: flex;
          align-items: center;
        }
        @media (max-width: 820px) {
          .diag-hero { min-height: auto; padding: 72px 0 64px; }
        }
        .diag-hero-grid {
          max-width: 1024px;
          margin: 0 auto;
          padding: 0 1.5rem;
          display: grid;
          grid-template-columns: 1.05fr .95fr;
          gap: 72px;
          align-items: center;
          width: 100%;
        }
        @media (max-width: 900px) {
          .diag-hero-grid { grid-template-columns: 1fr; gap: 36px; }
        }
        .diag-kicker {
          display: block;
          font-size: .72rem;
          letter-spacing: .12em;
          text-transform: uppercase;
          color: #5E4A36;
          font-weight: 800;
          margin-bottom: 1.25rem;
        }
        .diag-hero h1 {
          max-width: 10.8em;
          font-size: clamp(2.8rem, 5vw, 4.6rem);
          line-height: 1.08;
          letter-spacing: -0.055em;
          font-weight: 800;
          color: #1C1917;
          word-break: keep-all;
          margin-bottom: 1.5rem;
        }
        .diag-hero h1 span { display: block; }
        @media (max-width: 640px) {
          .diag-hero h1 {
            font-size: clamp(2.2rem, 9vw, 3rem);
            line-height: 1.12;
            max-width: 100%;
          }
          .diag-preview-card { padding: 22px 20px !important; }
        }
        .diag-lede {
          font-size: 1.0625rem;
          line-height: 1.7;
          color: #3C3832;
          max-width: 540px;
          margin-bottom: 0.75rem;
        }
        .diag-note {
          font-size: .905rem;
          line-height: 1.6;
          color: #6B625C;
          max-width: 540px;
        }
        .diag-cta-row {
          margin-top: 32px;
        }
        .diag-primary-btn {
          display: inline-block;
          background: #1C1917;
          color: #FAFAF7;
          padding: 16px 32px;
          border-radius: 4px;
          font-weight: 700;
          font-size: .98rem;
          border: 0;
          cursor: pointer;
          transition: background .2s;
          letter-spacing: -.005em;
          text-decoration: none;
        }
        .diag-primary-btn:hover { background: #000000; }
        @media (max-width: 640px) {
          .diag-primary-btn { display: block; width: 100%; text-align: center; box-sizing: border-box; }
        }
        .diag-microcopy {
          font-size: .82rem;
          color: #8B7355;
          margin-top: 14px;
        }
        .diag-preview-card {
          background: rgba(255,255,255,.76);
          border: 1px solid rgba(28,25,23,.10);
          border-radius: 18px;
          box-shadow: 0 18px 50px rgba(28,25,23,.08);
          padding: 28px;
          max-width: 480px;
          margin-left: auto;
        }
        @media (max-width: 900px) {
          .diag-preview-card { max-width: 100%; margin-left: 0; }
        }
        .diag-card-label {
          font-size: .72rem;
          letter-spacing: .10em;
          text-transform: uppercase;
          color: #5E4A36;
          font-weight: 800;
          margin-bottom: 4px;
        }
        .diag-result-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .diag-result-list li {
          display: grid;
          grid-template-columns: 34px 1fr;
          gap: 12px;
          padding: 16px 0;
          border-top: 1px solid rgba(28,25,23,.08);
          align-items: start;
        }
        .diag-result-list li:first-child {
          border-top: 1px solid rgba(28,25,23,.08);
        }
        .diag-result-list li > span {
          color: #8B7355;
          font-weight: 800;
          font-size: .78rem;
          letter-spacing: .04em;
          padding-top: 2px;
        }
        .diag-result-list strong {
          display: block;
          color: #1C1917;
          font-size: .98rem;
          font-weight: 700;
          margin-bottom: 3px;
          letter-spacing: -.005em;
        }
        .diag-result-list p {
          margin: 0;
          color: #6B625C;
          font-size: .9rem;
          line-height: 1.55;
        }
        .diag-card-foot {
          margin-top: 18px;
          font-size: .8rem;
          color: #9A938D;
        }
        .diag-form-section {
          background: #F7F1E8;
          padding: 80px 0 120px;
        }
        @media (max-width: 640px) {
          .diag-form-section { padding: 56px 0 80px; }
        }
        .diag-form-card {
          max-width: 920px;
          margin: 0 auto;
          background: #FFFFFF;
          border: 1px solid rgba(28,25,23,.10);
          border-radius: 18px;
          box-shadow: 0 12px 36px rgba(28,25,23,.06);
          padding: 36px 40px;
          scroll-margin-top: 90px;
          box-sizing: border-box;
        }
        @media (max-width: 640px) {
          .diag-form-card { padding: 22px 18px; border-radius: 14px; }
        }
        .diag-form-section-wrap {
          padding: 0 1.5rem;
        }
        @media (max-width: 640px) {
          .diag-submit-btn { width: 100% !important; }
        }
      `}</style>

      {/* ── Warm-light hero ── */}
      <section className="diag-hero">
        <div className="diag-hero-grid">
          {/* Copy column */}
          <div className="diag-hero-copy">
            <span className="diag-kicker">ARO DIAGNOSIS</span>
            <h1>
              <span>현재 서류가</span>
              <span>평가자에게 남기는 근거를 확인합니다.</span>
            </h1>
            <p className="diag-lede">
              이력서와 면접 답변을 입력하면, 지원하는 자리의 기준에서 부족한 근거와 모호한 문장, 면접에서 이어질 수 있는 질문을 먼저 정리합니다.
            </p>
            <p className="diag-note">
              사전 진단은 비용 없이 진행되며, 결과 확인 후 상담 여부를 선택할 수 있습니다.
            </p>
            <div className="diag-cta-row">
              <a href="#diag-form" className="diag-primary-btn">진단 시작하기</a>
            </div>
            <p className="diag-microcopy">약 3분 입력 · 상담 전환은 선택</p>
          </div>

          {/* Preview card */}
          <aside className="diag-preview-card">
            <p className="diag-card-label">진단 결과에서 확인하는 것</p>
            <ul className="diag-result-list">
              <li>
                <span>01</span>
                <div>
                  <strong>문제 유형</strong>
                  <p>지원 기준과 현재 문장의 어긋난 지점</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>위험 문장</strong>
                  <p>면접에서 질문으로 이어질 수 있는 표현</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>면접 꼬리질문</strong>
                  <p>평가자가 추가로 확인할 가능성이 높은 질문</p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <strong>정리 방향</strong>
                  <p>어떤 근거를 앞세워 다시 구성할지</p>
                </div>
              </li>
            </ul>
            <p className="diag-card-foot">결과는 입력 내용에 따라 달라집니다.</p>
          </aside>
        </div>
      </section>

      {/* ── Form section ── */}
      <section className="diag-form-section">
        <div className="diag-form-section-wrap">
          <div id="diag-form" className="diag-form-card">
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
              현재 문장을 그대로 입력해 주세요.
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#57534E", lineHeight: 1.6, marginBottom: "0.4rem" }}>
              완성된 서류가 아니어도 괜찮습니다. 지금 작성한 이력서 문장, 자기소개서 일부, 면접 답변 초안을 그대로 넣어 주세요.
            </p>
            <p style={{ fontSize: "0.8125rem", color: "#8B7355", marginBottom: "2.5rem" }}>
              주민등록번호, 주소, 연락처 등 민감한 개인정보는 제외하고 입력해 주세요.
            </p>

            <div className="space-y-10">
              {/* Field 01 */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.6875rem",
                    letterSpacing: "0.06em",
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
                    letterSpacing: "0.06em",
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
                    letterSpacing: "0.06em",
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
                    letterSpacing: "0.06em",
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
                  className="diag-submit-btn"
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
        </div>
      </section>
    </motion.div>
  );
}
