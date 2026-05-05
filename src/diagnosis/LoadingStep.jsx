import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function LoadingStep() {
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const expectedMs = 30000;
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = 95 * (1 - Math.exp(-elapsed / expectedMs));
      setLoadingProgress(pct);
    }, 250);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="py-32 text-center"
    >
      <div className="inline-block">
        <div className="text-[11px] tracking-[0.25em] text-neutral-500 font-semibold mb-6">
          DIAGNOSING
        </div>
        <div className="flex items-center justify-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-neutral-900 rounded-full"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 mb-4 leading-tight">
          평가자 관점으로 문장을 읽고 있습니다.
        </h2>
        <p className="text-neutral-600 text-sm md:text-base max-w-md mx-auto leading-relaxed">
          문제 유형, 위험 문장, 면접 꼬리질문 가능성을 함께 확인합니다. 약 20초에서 40초가 소요될 수 있습니다.
        </p>
        <div className="mt-8 max-w-xs mx-auto">
          <div className="h-1 bg-neutral-100 overflow-hidden rounded-full">
            <motion.div
              className="h-full bg-neutral-900"
              animate={{ width: `${loadingProgress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <div className="text-[10px] tracking-[0.2em] text-neutral-500 font-medium mt-3 tabular-nums">
            분석 중 · {Math.round(loadingProgress)}%
          </div>
        </div>
      </div>
    </motion.div>
  );
}
