import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const SITUATIONS = [
  "신입 취업",
  "동종업계 이직",
  "경력 전환",
  "업종 변경",
  "경력 단절 재취업",
  "팀장·임원급 설계",
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

  return (
    <motion.div
      key="input"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-14">
        <div className="text-[11px] tracking-[0.25em] text-neutral-500 font-semibold mb-5">
          AI 사전 진단 · 30분 무료
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-neutral-900 leading-[1.2] tracking-tight mb-6">
          지금 이력서의<br />
          탈락 요인을 진단합니다.
        </h1>
        <p className="text-neutral-600 leading-relaxed text-base md:text-lg max-w-2xl">
          16년 면접관석의 기준, 1,000회 이상의 면접 경험, 150건 이상의 컨설팅 사례에서 추출된 진단 체계로 현재 이력서의 근본 원인을 짚어드립니다. 본 상담 전환은 전제되지 않습니다.
        </p>
      </div>

      <div className="space-y-10">
        <div>
          <label className="block text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-3">
            01 · 지원 직무 / 희망 포지션
          </label>
          <input
            type="text"
            value={formData.jobTarget}
            onChange={(e) => setFormData({ ...formData, jobTarget: e.target.value })}
            placeholder="예: 제조업 생산관리 신입, IT 서비스 PM 경력 5년차"
            className="w-full border-b-2 border-neutral-300 bg-transparent py-3 text-base md:text-lg text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none transition-colors"
          />
        </div>

        <div>
          <label className="block text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-4">
            02 · 현재 상황
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {SITUATIONS.map((s) => (
              <button
                key={s}
                onClick={() => setFormData({ ...formData, situation: s })}
                className={`py-3.5 px-3 text-sm font-medium border transition-all ${
                  formData.situation === s
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 text-neutral-700 hover:border-neutral-500 bg-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-3">
            03 · 이력서 본문 또는 자기소개 핵심 문단
          </label>
          <textarea
            value={formData.resume}
            onChange={(e) => setFormData({ ...formData, resume: e.target.value.slice(0, 3000) })}
            placeholder="진단받고 싶은 자기소개서 또는 이력서 본문을 붙여넣어 주세요. 최대 3,000자."
            rows={12}
            className="w-full border-2 border-neutral-300 bg-white p-5 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none leading-relaxed resize-none transition-colors"
          />
          <div className="text-xs text-neutral-500 mt-2 text-right tabular-nums">
            {formData.resume.length} / 3,000자
          </div>
        </div>

        <div>
          <label className="block text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-3">
            04 · 최근 탈락 경험 <span className="text-neutral-400 font-normal">(선택)</span>
          </label>
          <input
            type="text"
            value={formData.rejection}
            onChange={(e) => setFormData({ ...formData, rejection: e.target.value })}
            placeholder="예: 서류 합격률 0/10, 면접까지 간 적 없음"
            className="w-full border-b-2 border-neutral-300 bg-transparent py-3 text-base text-neutral-700 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none transition-colors"
          />
        </div>

        {error && (
          <div className="text-sm text-red-700 border-l-2 border-red-700 pl-4 py-2 bg-red-50">
            {error}
          </div>
        )}

        <div className="mt-6 mb-4" ref={turnstileRef}></div>

        <label className="flex items-start gap-2 mb-4 text-sm text-neutral-700 leading-relaxed">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1"
          />
          <span>
            <b>(필수)</b> 입력한 정보가 AI 진단 처리에 사용되며,
            '전문가 상담 신청' 시 입력 내용이 운영자에게 전달됨에 동의합니다.<br />
            <span className="text-neutral-500 text-xs">
              · 보관 기간: 신청 후 6개월 · 문의/삭제: <a href="mailto:naminimiya@gmail.com" className="underline">naminimiya@gmail.com</a>
            </span>
          </span>
        </label>

        <div className="pt-8 border-t border-neutral-200">
          <button
            onClick={onSubmit}
            disabled={!consent || !turnstileToken}
            className="w-full md:w-auto bg-neutral-900 hover:bg-black text-white px-10 py-4 text-sm font-semibold tracking-[0.15em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            진단 시작 →
          </button>
          <p className="text-xs text-neutral-500 mt-4 leading-relaxed">
            입력하신 내용은 진단 생성 외의 용도로 저장되거나 사용되지 않습니다.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
