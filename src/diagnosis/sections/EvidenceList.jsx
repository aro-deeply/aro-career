import React from "react";

export default function EvidenceList({ evidence }) {
  return (
    <section>
      <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-8">
        03 · 원문 근거
      </div>
      <div className="space-y-4">
        {evidence.map((e, i) => (
          <div key={i} className="bg-white border border-neutral-200 p-6 md:p-7">
            <div className="text-[10px] tracking-[0.15em] text-neutral-500 font-semibold mb-4 uppercase">
              #{String(i + 1).padStart(2, "0")} · {e.signal}
            </div>
            <blockquote className="text-base md:text-lg text-neutral-900 mb-5 pl-4 border-l-2 border-neutral-400 leading-relaxed font-medium">
              "{e.quote}"
            </blockquote>
            <p className="text-sm md:text-base text-neutral-700 leading-relaxed">
              {e.why}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
