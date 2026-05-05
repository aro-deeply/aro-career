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
      <div className="mb-14">
        <div className="text-[11px] tracking-[0.25em] text-neutral-500 font-semibold mb-5">
          무료 서류 문제 유형 진단
        </div>
        <h1
          className="text-4xl md:text-5xl font-bold text-neutral-900 leading-[1.2] tracking-tight mb-6"
          style={{ wordBreak: "keep-all" }}
        >
          무료로 내 서류 문제 유형을 확인합니다.
        </h1>
        <p className="text-neutral-600 leading-relaxed text-base md:text-lg max-w-2xl mb-3">
          약 3분 입력하면 현재 이력서와 면접 답변이 평가자에게 어떻게 읽히는지 확인할 수 있습니다.
        </p>
        <p className="text-neutral-600 leading-relaxed text-base md:text-lg max-w-2xl mb-3">
          진단 결과에서는 문제 유형, 위험 문장, 면접 꼬리질문, 정리 방향을 먼저 보여드립니다.
        </p>
        <p className="text-neutral-600 leading-relaxed text-base md:text-lg max-w-2xl">
          상담 전환은 선택입니다.
        </p>
      </div>

      <div className="mb-8 text-xs text-[#6B625C] font-medium tracking-wide">
        약 3분 입력 · 결과 확인 후 상담 선택
      </div>

      <div className="space-y-10">
        <div>
          <label className="block text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-3">
            01 · 지원 회사 또는 직무
          </label>
          <input
            type="text"
            value={formData.jobTarget}
            onChange={(e) => setFormData({ ...formData, jobTarget: e.target.value })}
            placeholder="예: 패션 브랜드 MD 신입, 제조업 인사 직무, 플랫폼 운영 PM"
            className="w-full border-b-2 border-neutral-300 bg-transparent py-3 text-base md:text-lg text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none transition-colors"
          />
          <p className="text-xs text-neutral-500 mt-2">
            지원 기준을 알아야 현재 경험이 어떤 기준에서 읽히는지 볼 수 있습니다.
          </p>
        </div>

        <div>
          <label className="block text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-4">
            02 · 현재 상황
          </label>
          <div className="grid grid-cols-2 gap-2">
            {SITUATIONS.map((s) => (
              <button
                key={s}
                onClick={() => setFormData({ ...formData, situation: s })}
                className={`py-3.5 px-3 text-sm font-medium border transition-all ${
                  formData.situation === s
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-300 text-neutral-700 hover:border-neutral-500 bg-white"
                }`}
                style={{ wordBreak: "keep-all" }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-3">
            03 · 현재 이력서 또는 면접 답변
          </label>
          <p className="text-xs text-neutral-500 mb-3">
            완성본이 아니어도 됩니다. 현재 작성한 문장 그대로 붙여넣어 주세요.
          </p>
          <textarea
            value={formData.resume}
            onChange={(e) => setFormData({ ...formData, resume: e.target.value.slice(0, 3000) })}
            placeholder="진단받고 싶은 자기소개서 또는 이력서 본문을 붙여넣어 주세요. 최대 3,000자."
            rows={12}
            className="w-full border-2 border-neutral-300 bg-white p-5 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none leading-relaxed resize-none transition-colors"
          />
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-neutral-400">
              주민등록번호, 주소, 연락처 등 민감한 개인정보는 제외하고 입력해 주세요.
            </p>
            <div className="text-xs text-neutral-500 tabular-nums flex-shrink-0 ml-4">
              {formData.resume.length} / 3,000자
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-3">
            04 · 최근 막히는 지점 <span className="text-neutral-400 font-normal">(선택)</span>
          </label>
          <input
            type="text"
            value={formData.rejection}
            onChange={(e) => setFormData({ ...formData, rejection: e.target.value })}
            placeholder="예: 서류는 가끔 통과하는데 면접에서 답변이 길어진다 / 지원동기가 늘 뻔하게 느껴진다"
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
            <b>(필수)</b> 입력한 내용은 진단 결과 생성 및 상담 요청 시 참고 목적으로만 사용됩니다.<br />
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
            무료로 내 서류 문제 유형 확인하기
          </button>
          <p className="text-xs text-neutral-500 mt-4 leading-relaxed">
            약 3분 입력 · 결과 확인 후 상담 선택
          </p>
        </div>
      </div>
    </motion.div>
  );
}
