import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const CAREER_STAGES = ["신입·인턴", "1~3년차", "4~7년차", "8년차 이상"];

const SITUATIONS = [
  "서류에서 자주 막힘",
  "면접에서 자주 막힘",
  "경험이 부족하다고 느낌",
  "경력은 있지만 강점이 흐림",
  "공백·전환·짧은 경력 설명이 어려움",
  "지원동기 작성이 어려움",
];

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

  const tooShort = formData.resume.length > 0 && formData.resume.length < 200;
  return (
    <motion.div
      key="input"
      className="xp"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4 }}
    >
      <main className="xp-main">
        <section className="xp-screen">
          <p className="xp-context">써둔 이력서 진단</p>
          <h1 tabIndex={-1}>지금 쓴 문장을 그대로 붙여 넣어 주세요</h1>
          <p className="xp-sub">완성본이 아니어도 괜찮아요. 평가자가 어디서 걸리는지 먼저 짚어 드려요.</p>
          <div className="xp-gets-box">
            <p className="xp-gets-title" id="diag-gets">결과에서 받는 것</p>
            <ul className="xp-gets" aria-labelledby="diag-gets">
              <li><b>문제 유형</b> 지원 기준과 어긋난 지점</li>
              <li><b>위험 문장</b> 면접에서 질문으로 이어질 표현</li>
              <li><b>꼬리질문</b> 평가자가 더 확인할 질문</li>
              <li><b>정리 방향</b> 어떤 근거를 앞세울지</li>
            </ul>
          </div>

          <div id="diag-form" className="xp-form">
            <div className="xp-field">
              <label htmlFor="diag-job-target" className="xp-field-label">지원하는 자리</label>
              <p id="diag-job-target-hint" className="xp-fine">회사나 직무를 알수록 더 정확한 기준으로 읽어요.</p>
              <input
                id="diag-job-target"
                aria-describedby="diag-job-target-hint"
                type="text"
                value={formData.jobTarget}
                onChange={(e) => setFormData({ ...formData, jobTarget: e.target.value })}
                placeholder="예: 패션 브랜드 MD 신입, 제조업 인사 직무"
              />
            </div>

            <fieldset className="xp-field">
              <legend className="xp-field-label">연차 <span className="xp-optional">선택</span></legend>
              <p className="xp-fine">연차마다 평가자가 기대하는 수준이 달라요.</p>
              <div className="xp-options xp-options--4" role="radiogroup" aria-label="연차">
                {CAREER_STAGES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={formData.careerStage === c}
                    className="xp-option"
                    onClick={() => setFormData({ ...formData, careerStage: formData.careerStage === c ? "" : c })}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="xp-field">
              <legend className="xp-field-label">지금 막히는 지점</legend>
              <div className="xp-options" role="radiogroup" aria-label="현재 막히는 지점">
                {SITUATIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={formData.situation === s}
                    className="xp-option"
                    onClick={() => setFormData({ ...formData, situation: s })}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="xp-field">
              <label htmlFor="diag-resume" className="xp-field-label">이력서 문장 또는 면접 답변</label>
              <p id="diag-resume-hint" className="xp-fine">이력서·자기소개서 일부·면접 답변 초안 무엇이든 괜찮아요. 주민등록번호·연락처 같은 개인정보는 빼 주세요.</p>
              <textarea
                id="diag-resume"
                aria-describedby="diag-resume-hint diag-resume-counter"
                value={formData.resume}
                onChange={(e) => setFormData({ ...formData, resume: e.target.value.slice(0, 3000) })}
                placeholder="지금 쓴 문장을 그대로 붙여 넣어 주세요. 200자 이상이면 더 정확해요."
                rows={9}
              />
              <p id="diag-resume-counter" className={tooShort ? "xp-count-line xp-error" : "xp-count-line xp-fine"}>
                {formData.resume.length} / 3,000자{tooShort ? ` · ${200 - formData.resume.length}자 더 필요해요` : ""}
              </p>
            </div>

            <div className="xp-field">
              <label htmlFor="diag-rejection" className="xp-field-label">더 알려 줄 상황 <span className="xp-optional">선택</span></label>
              <p id="diag-rejection-hint" className="xp-fine">최근 탈락 경험, 지원 중인 회사, 가장 고민되는 부분.</p>
              <input
                id="diag-rejection"
                aria-describedby="diag-rejection-hint"
                type="text"
                value={formData.rejection}
                onChange={(e) => setFormData({ ...formData, rejection: e.target.value })}
                placeholder="예: 서류는 통과하는데 면접에서 답변이 길어져요."
              />
            </div>

            {error && <p role="alert" className="xp-alert">{error}</p>}

            <div className="xp-turnstile" ref={turnstileRef}></div>

            <label className="xp-consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                <b>(필수)</b> 입력한 내용은 진단 결과 생성과 상담 요청 시 참고 목적으로만 써요.
                <br />보관 기간: 신청 후 6개월 · 문의/삭제: <a href="mailto:aro.deeply@gmail.com">aro.deeply@gmail.com</a>
              </span>
            </label>

            <button
              type="button"
              onClick={onSubmit}
              disabled={!consent || !turnstileToken}
              className="xp-btn xp-btn--wide diag-submit-btn"
            >
              진단 결과 보기
            </button>
            <p className="xp-aside">약 3분 · 결과를 본 뒤 상담은 선택이에요.</p>
          </div>
        </section>
      </main>
    </motion.div>
  );
}
