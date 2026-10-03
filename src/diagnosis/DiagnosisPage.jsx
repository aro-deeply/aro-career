import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, MotionConfig } from "framer-motion";
import LoadingStep from "./LoadingStep.jsx";
import InputStep from "./InputStep.jsx";
import ResultStep from "./ResultStep.jsx";
import ModeChooser from "./ModeChooser.jsx";
import ExperienceFlow, { SEED_KEY } from "./experience/ExperienceFlow.jsx";
import { readDiagnosisStream, parseDiagnosisJson } from "./diagnose-stream.js";
import { extractStreamPreview } from "./stream-preview.js";

// 진행률 추정용 예상 응답 길이 (eval 실측: 평균 약 1,950토큰 ≈ 2,800자)
const EXPECTED_RESPONSE_CHARS = 2800;
// 스트리밍 delta마다 리렌더하지 않도록 UI 갱신 최소 간격
const STREAM_UI_UPDATE_MS = 150;

const STEP_STATUS_MESSAGE = {
  input: "",
  loading: "진단을 시작합니다. 잠시만 기다려 주세요.",
  result: "진단 결과가 도착했습니다.",
};

// 주소의 해시로 진단 갈래를 정한다: 없음 = 시작 선택, #resume = 이력서 패턴 진단, #xp... = 경험 정리.
function modeFromHash() {
  const hash = typeof window === "undefined" ? "" : window.location.hash;
  if (hash.startsWith("#xp")) return "experience";
  if (hash === "#resume") return "resume";
  return "choose";
}

export default function DiagnosisPage() {
  const [mode, setMode] = useState(modeFromHash);
  useEffect(() => {
    const onHash = () => setMode(modeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const [step, setStep] = useState("input");
  const [statusMessage, setStatusMessage] = useState("");
  const mainRef = useRef(null);
  const previousStepRef = useRef(step);

  useEffect(() => {
    setStatusMessage(STEP_STATUS_MESSAGE[step] || "");

    // After a step transition (not on first mount), move keyboard focus to <main>
    // so SR/keyboard users land on the new content instead of staying at the form/old position.
    if (previousStepRef.current !== step && mainRef.current) {
      const t = setTimeout(() => {
        mainRef.current?.focus({ preventScroll: false });
      }, 80);
      previousStepRef.current = step;
      return () => clearTimeout(t);
    }
    previousStepRef.current = step;
  }, [step]);
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
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamPreview, setStreamPreview] = useState(null);

  async function runDiagnosis() {
    if (!formData.jobTarget || !formData.situation || !formData.resume) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }
    if (formData.resume.length < 200) {
      setError("이력서 본문은 200자 이상 입력해주세요. 정확한 진단을 위해 필요합니다.");
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
    setStreamProgress(0);
    setStreamPreview(null);
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
      if (!response.ok) {
        clearTimeout(timeoutId);
        const data = await response.json().catch(() => ({}));
        setError(data?.error || "일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        setStep("input");
        return;
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        // 스트리밍 이전 버전 서버와의 호환 (배포 전환기·롤백 대비)
        clearTimeout(timeoutId);
        const data = await response.json().catch(() => ({}));
        setResult(data.result);
        setStep("result");
        return;
      }

      let lastUiUpdate = 0;
      const accumulated = await readDiagnosisStream(response.body, (acc) => {
        const now = Date.now();
        if (now - lastUiUpdate < STREAM_UI_UPDATE_MS) return;
        lastUiUpdate = now;
        setStreamProgress(Math.min(95, (acc.length / EXPECTED_RESPONSE_CHARS) * 100));
        setStreamPreview(extractStreamPreview(acc));
      });
      clearTimeout(timeoutId);
      setResult(parseDiagnosisJson(accumulated));
      setStep("result");
    } catch (err) {
      clearTimeout(timeoutId);
      console.error(err);
      if (err?.name === "AbortError") {
        setError("진단이 90초 안에 완료되지 않았습니다. 잠시 후 다시 시도해주세요.");
      } else if (err?.userMessage) {
        setError(err.userMessage);
      } else {
        setError("네트워크 오류입니다. 잠시 후 다시 시도해주세요.");
      }
      setStep("input");
    }
  }

  // 진단에서 짚은 문장을 들고 경험 정리로 넘어간다. 진단 결과는 이 화면 상태에 그대로 남는다.
  function startExperienceFromQuote(quote) {
    try { window.sessionStorage.setItem(SEED_KEY, quote); } catch { /* storage blocked: start empty */ }
    window.location.hash = "xp/from-diagnosis";
  }

  function resetForm() {
    setFormData({ jobTarget: "", situation: "", resume: "", rejection: "" });
    setResult(null);
    setError(null);
    setStep("input");
  }

  const fontStack = '"SUIT Variable", "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen bg-[#FAFAFA] text-[#0B0B0C]" style={{ fontFamily: fontStack }}>
      <style>{`
        .aro-skip-link {
          position: absolute;
          top: -48px;
          left: 16px;
          z-index: 200;
          padding: 12px 20px;
          background: #0B0B0C;
          color: #FAFAFA;
          font-size: 0.9rem;
          font-weight: 500;
          border-radius: 4px;
          transition: top .15s;
          text-decoration: none;
        }
        .aro-skip-link:focus {
          top: 12px;
          outline: 3px solid #2F4DB3;
          outline-offset: 2px;
        }
        .aro-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0,0,0,0);
          white-space: nowrap;
          border: 0;
        }
        /* Keyboard focus indicator — applies to interactive elements; main itself opts out via inline outline:none */
        button:focus-visible,
        a:focus-visible,
        input:focus-visible,
        textarea:focus-visible,
        select:focus-visible,
        summary:focus-visible {
          outline: 2px solid #2F4DB3;
          outline-offset: 3px;
          border-radius: 3px;
        }
      `}</style>

      <a className="aro-skip-link" href="#main-content">본문으로 바로가기</a>

      <div className="aro-sr-only" role="status" aria-live="polite">
        {statusMessage}
      </div>

      {/* Light sticky header — same neutral tone as the landing page */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(250,250,250,.9)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          borderBottom: "1px solid #E7E7E5",
        }}
      >
        <div className="max-w-5xl mx-auto px-5 flex items-center justify-between" style={{ height: "60px" }}>
          <a href="index.html" style={{ display: "flex", alignItems: "baseline", gap: "10px", color: "#0B0B0C", textDecoration: "none" }}>
            <span style={{ fontSize: "1rem", fontWeight: 700, letterSpacing: "0.08em" }}>ARO</span>
            <span style={{ fontSize: "0.8125rem", color: "#5F5F65" }}>AI 서류 진단</span>
          </a>
          <a
            href="index.html"
            style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#5F5F65", textDecoration: "none", padding: "10px 4px" }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#0B0B0C")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#5F5F65")}
          >
            ← 메인으로 돌아가기
          </a>
        </div>
      </header>

      <main id="main-content" ref={mainRef} tabIndex={-1} style={{ scrollMarginTop: "84px", outline: "none" }}>
        {mode === "choose" && (
          <ModeChooser onResume={() => { window.location.hash = "resume"; }} onExperience={() => { window.location.hash = "xp"; }} />
        )}
        {mode === "experience" && <ExperienceFlow onExit={() => { window.location.hash = ""; }} />}
        {mode === "resume" && (
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

          {step === "loading" && (
            <LoadingStep key="loading" progress={streamProgress} preview={streamPreview} />
          )}

          {step === "result" && result && (
            <ResultStep key="result" result={result} onReset={resetForm} onStartExperience={startExperienceFromQuote} />
          )}
        </AnimatePresence>
        )}
      </main>

      <footer
        style={{
          background: "#FAFAFA",
          borderTop: "1px solid #E7E7E5",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 py-8 text-center" style={{ fontSize: "0.75rem", color: "#5F5F65" }}>
          © ARO · AI 서류 진단
        </div>
      </footer>
    </div>
    </MotionConfig>
  );
}
