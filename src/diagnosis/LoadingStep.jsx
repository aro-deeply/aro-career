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
      className="xp"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <main className="xp-main">
        <section className="xp-screen">
          <p className="xp-context">써둔 이력서 진단</p>
          <div className="xp-loading">
            <span className="xp-bubble xp-typing" aria-hidden="true"><i /><i /><i /></span>
            <h1 className="xp-center">평가자 관점으로 읽고 있어요</h1>
            <p className="xp-center">문제 유형, 위험 문장, 면접 꼬리질문을 함께 확인해요.</p>
            <div className="xp-meter" role="progressbar" aria-label="진단 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(loadingProgress)}>
              <motion.i animate={{ width: `${loadingProgress}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
            </div>
            <p className="xp-fine">분석 중 · {Math.round(loadingProgress)}%</p>
          </div>

          <div aria-live="polite">
            {preview?.keyVerdict && (
              <motion.div className="xp-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
                <p className="xp-label">핵심 판정 먼저 확인</p>
                <p className="xp-preview-verdict">{preview.keyVerdict}</p>
                {preview.rootDiagnosis && (
                  <motion.p className="xp-preview-root" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                    {preview.rootDiagnosis}
                  </motion.p>
                )}
                <p className="xp-fine">상세 근거와 정리 방향을 계속 분석하고 있어요…</p>
              </motion.div>
            )}
          </div>
        </section>
      </main>
    </motion.div>
  );
}
