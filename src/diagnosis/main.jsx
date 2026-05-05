import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  PATTERN_LABELS,
  getPatternIdFromScoreKey,
  getPatternLabel,
} from "../../shared/diagnosis-dictionary.js";
import {
  renderMarkdownBold,
  BOLD_HIGHLIGHT_CLASS,
} from "../shared/render-markdown-bold.jsx";
import { DEMO_RESULT } from "./demo-result.js";
import ConsultRequestForm from "./ConsultRequestForm.jsx";
import LoadingStep from "./LoadingStep.jsx";
import InputStep from "./InputStep.jsx";
import "../index.css";
function DiagnosisPage() {
  const [step, setStep] = useState("input");
  const [formData, setFormData] = useState({
    jobTarget: "",
    situation: "",
    resume: "",
    rejection: "",
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [consent, setConsent] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const patternLabels = {
    pattern_01_generic_template: `Pattern 01 · ${PATTERN_LABELS.pattern_01}`,
    pattern_02_unsupported_claims: `Pattern 02 · ${PATTERN_LABELS.pattern_02}`,
    pattern_03_differentiation_mishandling: `Pattern 03 · ${PATTERN_LABELS.pattern_03}`,
    pattern_04_job_fit_mismatch: `Pattern 04 · ${PATTERN_LABELS.pattern_04}`,
    pattern_05_industry_context_absence: `Pattern 05 · ${PATTERN_LABELS.pattern_05}`,
  };

  async function runDiagnosis() {
    if (!formData.jobTarget || !formData.situation || !formData.resume) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }
    if (formData.resume.length < 50) {
      setError("이력서 본문은 50자 이상 입력해주세요.");
      return;
    }
    if (!consent) {
      setError("개인정보 처리에 동의해야 진단을 시작할 수 있습니다.");
      return;
    }
    if (!turnstileToken) {
      setError("봇 검증을 완료해주세요.");
      return;
    }
    setError(null);
    setStep("loading");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTarget: formData.jobTarget,
          situation: formData.situation,
          resume: formData.resume,
          rejection: formData.rejection,
          turnstileToken,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error || "일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        setStep("input");
        return;
      }
      setResult(data.result);
      setStep("result");
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(err);
      if (err?.name === "AbortError") {
        setError("진단이 90초 안에 완료되지 않았습니다. 잠시 후 다시 시도해주세요.");
      } else {
        setError("네트워크 오류입니다. 잠시 후 다시 시도해주세요.");
      }
      setStep("input");
    }
  }

  function resetForm() {
    setFormData({ jobTarget: "", situation: "", resume: "", rejection: "" });
    setResult(null);
    setError(null);
    setStep("input");
  }

  const fontStack = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

  return (
    <div className="min-h-screen bg-white text-neutral-900" style={{ fontFamily: fontStack }}>
      <header className="border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] tracking-[0.25em] text-neutral-500 font-medium">ARO</div>
            <div className="text-sm font-semibold text-neutral-900 tracking-tight">Career Direction</div>
          </div>
          <a href="index.html" className="text-xs text-neutral-600 hover:text-neutral-900 transition-colors">
            ← 메인으로
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 md:py-20">
        <AnimatePresence mode="wait">
          {step === "input" && (
            <InputStep
              key="input"
              formData={formData}
              setFormData={setFormData}
              consent={consent}
              setConsent={setConsent}
              turnstileToken={turnstileToken}
              setTurnstileToken={setTurnstileToken}
              error={error}
              onSubmit={runDiagnosis}
            />
          )}

          {step === "loading" && <LoadingStep key="loading" />}

          {step === "result" && result && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-16"
            >
              <div>
                <div className="text-[11px] tracking-[0.25em] text-neutral-500 font-semibold mb-5">
                  진단 결과 · 1P 요약
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 leading-tight tracking-tight mb-6">
                  진단이 완료되었습니다.
                </h1>
                <div className="flex flex-wrap gap-2 items-center text-sm">
                  <span className="bg-neutral-900 text-white px-3 py-1.5 font-medium text-xs tracking-wide">
                    핵심 원인: {getPatternLabel(result.root_cause)}
                  </span>
                  <span className="text-neutral-600 px-3 py-1.5">
                    성격: <span className="font-semibold text-neutral-900">{result.correctability}</span>
                  </span>
                  <span className="text-neutral-600 px-3 py-1.5">
                    권장 단계: <span className="font-semibold text-neutral-900">{result.next_step_recommendation}</span>
                  </span>
                </div>
              </div>

              {result.key_verdict && (
                <section className="bg-yellow-50 border-l-4 border-yellow-500 px-7 py-6 -mx-2 md:mx-0">
                  <div className="text-[10px] tracking-[0.2em] text-yellow-900 font-bold mb-3 uppercase">
                    핵심 판정
                  </div>
                  <p className="text-xl md:text-2xl text-neutral-900 font-bold leading-[1.5]">
                    {result.key_verdict}
                  </p>
                </section>
              )}

              <section>
                <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-8">
                  01 · 5개 패턴 진단 점수
                </div>
                <div className="space-y-5">
                  {Object.entries(result.pattern_scores).map(([key, score]) => {
                    const patternId = getPatternIdFromScoreKey(key);
                    const isDominant = patternId === result.dominant_pattern;
                    const isRoot = patternId === result.root_cause;
                    return (
                      <div key={key}>
                        <div className="flex justify-between items-baseline mb-2.5">
                          <div className="text-sm md:text-base text-neutral-900 font-semibold flex items-center gap-2 flex-wrap">
                            {patternLabels[key]}
                            {isRoot && <span className="text-[9px] tracking-widest font-bold bg-neutral-900 text-white px-2 py-0.5">ROOT</span>}
                            {isDominant && !isRoot && <span className="text-[9px] tracking-widest font-bold border border-neutral-900 text-neutral-900 px-2 py-0.5">DOMINANT</span>}
                          </div>
                          <div className="text-sm text-neutral-600 tabular-nums font-medium">
                            {(score * 100).toFixed(0)}
                          </div>
                        </div>
                        <div className="h-1.5 bg-neutral-100 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${score * 100}%` }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className={`h-full ${score > 0.7 ? "bg-neutral-900" : score > 0.4 ? "bg-neutral-600" : "bg-neutral-400"}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-6">
                  02 · 근본 진단
                </div>
                <div className="bg-neutral-50 border-l-4 border-neutral-900 px-7 py-7">
                  <p className="text-lg md:text-xl text-neutral-800 leading-[1.8]">
                    {renderMarkdownBold(result.root_diagnosis, BOLD_HIGHLIGHT_CLASS)}
                  </p>
                </div>
              </section>

              <section>
                <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-8">
                  03 · 원문 근거
                </div>
                <div className="space-y-4">
                  {result.evidence.map((e, i) => (
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

              <section>
                <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-6">
                  04 · 종합 진단
                </div>
                <div className="bg-stone-50 border border-stone-200 p-8 md:p-12">
                  <div className="space-y-6">
                    {result.one_pager_summary
                      .split(/\n\n+/)
                      .filter(p => p.trim())
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

              <section>
                <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-8">
                  05 · 다음 상담 전 자가 성찰 질문
                </div>
                <div className="space-y-6">
                  {result.self_reflection_questions.map((q, i) => (
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
                    onClick={resetForm}
                    className="border border-neutral-300 hover:border-neutral-900 text-neutral-700 hover:text-neutral-900 px-8 py-4 text-sm font-semibold tracking-[0.15em] transition-colors"
                  >
                    다시 진단하기
                  </button>
                </div>
              </section>

              <ConsultRequestForm result={result} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-neutral-200 mt-24">
        <div className="max-w-5xl mx-auto px-6 py-8 text-center text-xs text-neutral-500">
          © ARO · Career Direction · AI 진단 엔진
        </div>
      </footer>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<DiagnosisPage />);
