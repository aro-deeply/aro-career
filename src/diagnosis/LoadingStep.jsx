import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function LoadingStep({ progress = 0, preview = null }) {
  const [timeBasedProgress, setTimeBasedProgress] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const expectedMs = 30000;
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = 95 * (1 - Math.exp(-elapsed / expectedMs));
      setTimeBasedProgress(pct);
    }, 250);
    return () => clearInterval(id);
  }, []);

  // 스트리밍 수신량 기반 진행률이 우선, 첫 응답 전에는 시간 기반 곡선이 바닥을 받친다
  const loadingProgress = Math.max(timeBasedProgress, progress);

  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        background: "#FAFAF7",
        padding: "8rem 1.5rem",
        textAlign: "center",
      }}
    >
      <div className="inline-block">
        <div
          style={{
            fontSize: "0.6875rem",
            letterSpacing: "0.25em",
            color: "#8B7355",
            fontWeight: 700,
            textTransform: "uppercase",
            marginBottom: "1.5rem",
          }}
        >
          DIAGNOSING
        </div>
        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              style={{ width: "8px", height: "8px", background: "#1C1917", borderRadius: "50%" }}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
        <h2
          style={{
            fontSize: "clamp(1.4rem, 3vw, 1.875rem)",
            fontWeight: 700,
            color: "#1C1917",
            marginBottom: "1rem",
            lineHeight: 1.3,
            letterSpacing: "-0.02em",
            wordBreak: "keep-all",
          }}
        >
          평가자 관점으로 문장을 읽고 있습니다.
        </h2>
        <p
          style={{
            color: "#57534E",
            fontSize: "0.9375rem",
            maxWidth: "420px",
            margin: "0 auto",
            lineHeight: 1.7,
          }}
        >
          문제 유형, 위험 문장, 면접 꼬리질문 가능성을 함께 확인합니다. 잠시만 기다려 주세요.
        </p>
        <div style={{ marginTop: "2rem", maxWidth: "280px", margin: "2rem auto 0" }}>
          <div
            style={{
              height: "3px",
              background: "rgba(28,25,23,.1)",
              borderRadius: "99px",
              overflow: "hidden",
            }}
          >
            <motion.div
              style={{ height: "100%", background: "#5E4A36", borderRadius: "99px" }}
              animate={{ width: `${loadingProgress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <div
            style={{
              fontSize: "0.625rem",
              letterSpacing: "0.2em",
              color: "#8B7355",
              fontWeight: 600,
              marginTop: "0.75rem",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            분석 중 · {Math.round(loadingProgress)}%
          </div>
        </div>

        <div aria-live="polite">
          {preview?.keyVerdict && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                marginTop: "2.5rem",
                maxWidth: "480px",
                marginLeft: "auto",
                marginRight: "auto",
                padding: "1.25rem 1.5rem",
                background: "#FFFFFF",
                border: "1px solid rgba(28,25,23,.08)",
                borderRadius: "8px",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  fontSize: "0.625rem",
                  letterSpacing: "0.2em",
                  color: "#B48A5A",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  marginBottom: "0.5rem",
                }}
              >
                핵심 판정 먼저 확인
              </div>
              <div
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "#1C1917",
                  lineHeight: 1.5,
                  wordBreak: "keep-all",
                }}
              >
                {preview.keyVerdict}
              </div>
              {preview.rootDiagnosis && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  style={{
                    marginTop: "0.75rem",
                    fontSize: "0.875rem",
                    color: "#57534E",
                    lineHeight: 1.7,
                    wordBreak: "keep-all",
                  }}
                >
                  {preview.rootDiagnosis}
                </motion.p>
              )}
              <p
                style={{
                  marginTop: "0.75rem",
                  fontSize: "0.75rem",
                  color: "#8B7355",
                }}
              >
                상세 근거와 정리 방향을 계속 분석하고 있습니다…
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
