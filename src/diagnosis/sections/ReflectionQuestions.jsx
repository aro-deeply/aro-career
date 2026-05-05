import React from "react";

export default function ReflectionQuestions({ questions }) {
  return (
    <section>
      <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-8">
        05 · 다음 상담 전 자가 성찰 질문
      </div>
      <div className="space-y-6">
        {questions.map((q, i) => (
          <div key={i} className="flex gap-5 items-start">
            <div className="text-3xl font-bold text-neutral-300 leading-none tabular-nums flex-shrink-0">
              {String(i + 1).padStart(2, "0")}
            </div>
            <p className="text-base md:text-lg text-neutral-900 leading-relaxed pt-1 font-medium">
              {q}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
