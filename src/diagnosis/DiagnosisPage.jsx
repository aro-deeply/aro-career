import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import LoadingStep from "./LoadingStep.jsx";
import InputStep from "./InputStep.jsx";
import ResultStep from "./ResultStep.jsx";

export default function DiagnosisPage() {
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

  const fontStack = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1C1917]" style={{ fontFamily: fontStack }}>
      {/* Light sticky header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(250,250,247,.86)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(28,25,23,.08)",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <div
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.22em",
                color: "#B48A5A",
                fontWeight: 700,
                textTransform: "uppercase",
                marginBottom: "2px",
              }}
            >
              ARO
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#1C1917",
                letterSpacing: "-0.01em",
              }}
            >
              Career Direction
            </div>
          </div>
          <a
            href="index.html"
            style={{
              fontSize: "0.75rem",
              color: "#8B7355",
              transition: "color .2s",
              textDecoration: "none",
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#5E4A36")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#8B7355")}
          >
            ← 메인으로 돌아가기
          </a>
        </div>
      </header>

      <main>
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
            <ResultStep key="result" result={result} onReset={resetForm} />
          )}
        </AnimatePresence>
      </main>

      <footer
        style={{
          background: "#FAFAF7",
          borderTop: "1px solid rgba(28,25,23,.08)",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-8 text-center" style={{ fontSize: "0.72rem", color: "#8B7355" }}>
          © ARO · Career Direction · 서류 문제 유형 진단
        </div>
      </footer>
    </div>
  );
}
