import React from "react";

export default function ResultCTA({ onReset }) {
  return (
    <section className="border-t border-neutral-200 pt-10 mt-16">
      <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-4">
        다음 단계
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 leading-tight tracking-tight mb-5">
        이제 실제 교정으로 넘어가십시오.
      </h2>
      <p className="text-neutral-600 leading-relaxed mb-8 max-w-2xl text-base md:text-lg">
        본 진단은 자동 생성된 1차 분석입니다. 30분 1:1 사전 진단에서는 본인의 실제 경험과 상황에 맞춘 심화 분석이 이어집니다. 본 상담 전환은 전제되지 않습니다.
      </p>
      <div className="flex flex-col md:flex-row gap-3">
        <a
          href="index.html#final"
          className="bg-neutral-900 hover:bg-black text-white px-8 py-4 text-sm font-semibold tracking-[0.15em] text-center transition-colors"
        >
          30분 무료 사전 진단 신청 →
        </a>
        <button
          onClick={onReset}
          className="border border-neutral-300 hover:border-neutral-900 text-neutral-700 hover:text-neutral-900 px-8 py-4 text-sm font-semibold tracking-[0.15em] transition-colors"
        >
          다시 진단하기
        </button>
      </div>
    </section>
  );
}
