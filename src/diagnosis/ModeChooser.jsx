import React from "react";
import "./experience/experience.css";

// 진단 첫 화면: 이력서가 있으면 기존 패턴 진단, 아직 글이 없으면 경험 정리로 시작한다.
export default function ModeChooser({ onResume, onExperience }) {
  const Arrow = () => <svg className="xp-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>;
  return (
    <div className="xp">
      <main className="xp-main">
        <section className="xp-screen xp-chooser">
          <p className="xp-context">ARO AI 도구 · 비용 없음</p>
          <h1 tabIndex={-1}>무엇으로 시작할까요?</h1>
          <p className="xp-sub">평가자 관점으로 보고, 필요한 것만 물어요.</p>
          <div className="xp-choices">
            <button type="button" className="xp-choice" onClick={onResume} data-mode="resume">
              <span className="xp-choice-main"><b>써둔 이력서가 있어요</b><small>이력서 진단 · 평가자가 걸리는 지점을 5가지 패턴으로 짚어요.</small></span><Arrow />
            </button>
            <button type="button" className="xp-choice" onClick={onExperience} data-mode="experience">
              <span className="xp-choice-main"><b>아직 글은 없고, 해온 일만 있어요</b><small>경험 정리 · 질문에 답하며 이력서·면접에 쓸 문장으로 만들어요.</small></span><Arrow />
            </button>
          </div>
          <p className="xp-aside">약 3분 · 적는 내용은 이 기기에 저장돼요.</p>
        </section>
      </main>
    </div>
  );
}
