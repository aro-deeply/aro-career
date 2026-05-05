import React from "react";
import {
  renderMarkdownBold,
  BOLD_HIGHLIGHT_CLASS,
} from "../../shared/render-markdown-bold.jsx";

export default function OnePagerSummary({ summary }) {
  return (
    <section>
      <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-6">
        04 · 종합 진단
      </div>
      <div className="bg-stone-50 border border-stone-200 p-8 md:p-12">
        <div className="space-y-6">
          {summary
            .split(/\n\n+/)
            .filter((p) => p.trim())
            .map((paragraph, idx) => (
              <p
                key={idx}
                className="text-base md:text-[17px] text-neutral-800 leading-[1.95]"
              >
                {idx === 0 && (
                  <span className="inline-block w-8 h-8 bg-neutral-900 text-white text-xs font-bold text-center leading-8 mr-3 -mt-1 align-middle tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                )}
                {idx > 0 && (
                  <span className="inline-block w-8 h-8 border-2 border-neutral-900 text-neutral-900 text-xs font-bold text-center leading-[28px] mr-3 -mt-1 align-middle tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                )}
                {renderMarkdownBold(paragraph, BOLD_HIGHLIGHT_CLASS)}
              </p>
            ))}
        </div>
      </div>
    </section>
  );
}
