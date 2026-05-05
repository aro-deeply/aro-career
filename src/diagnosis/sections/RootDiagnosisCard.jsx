import React from "react";
import {
  renderMarkdownBold,
  BOLD_HIGHLIGHT_CLASS,
} from "../../shared/render-markdown-bold.jsx";

export default function RootDiagnosisCard({ rootDiagnosis }) {
  return (
    <section>
      <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-6">
        02 · 근본 진단
      </div>
      <div className="bg-neutral-50 border-l-4 border-neutral-900 px-7 py-7">
        <p className="text-lg md:text-xl text-neutral-800 leading-[1.8]">
          {renderMarkdownBold(rootDiagnosis, BOLD_HIGHLIGHT_CLASS)}
        </p>
      </div>
    </section>
  );
}
