import React from "react";
import { track } from "@vercel/analytics";

// ResultStep 안에 들어가는 작은 피드백 카드.
// 별점 1~5 + 선택 코멘트. 제출 시 /api/feedback 으로 전송 + Vercel Analytics 이벤트.
export default function FeedbackCard({ result }) {
  const [score, setScore] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [status, setStatus] = React.useState("idle"); // idle | sending | sent | error
  const [errMsg, setErrMsg] = React.useState("");

  async function submit() {
    if (score < 1) {
      setErrMsg("별점을 선택해주세요.");
      return;
    }
    setErrMsg("");
    setStatus("sending");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score,
          comment: comment.trim().slice(0, 500),
          rootCause: result?.root_cause || "",
          keyVerdict: (result?.key_verdict || "").replace(/\*\*/g, "").slice(0, 200),
        }),
      });
      if (!r.ok) {
        setStatus("error");
        setErrMsg("전송에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      // Vercel Analytics 커스텀 이벤트
      try {
        track("feedback_submit", { score, hasComment: comment.trim().length > 0 ? 1 : 0 });
      } catch (e) {
        // analytics 실패는 무시
      }
      setStatus("sent");
    } catch (e) {
      setStatus("error");
      setErrMsg("네트워크 오류입니다. 잠시 후 다시 시도해주세요.");
    }
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        style={{
          marginTop: "2rem",
          padding: "1.25rem 1.5rem",
          background: "#F2EFE9",
          border: "1px solid rgba(28,25,23,.08)",
          borderRadius: "12px",
          fontSize: "0.875rem",
          color: "#5E4A36",
          textAlign: "center",
        }}
      >
        피드백 감사합니다. 더 나은 진단으로 반영하겠습니다.
      </div>
    );
  }

  return (
    <section
      aria-label="진단 정확도 피드백"
      style={{
        marginTop: "2rem",
        padding: "1.5rem",
        background: "rgba(255,255,255,.7)",
        border: "1px solid rgba(28,25,23,.08)",
        borderRadius: "12px",
      }}
    >
      <h3
        style={{
          fontSize: "0.95rem",
          fontWeight: 700,
          color: "#1C1917",
          margin: "0 0 6px",
          letterSpacing: "-0.01em",
        }}
      >
        이 진단이 정확하다고 느끼시나요?
      </h3>
      <p style={{ margin: "0 0 14px", fontSize: "0.78rem", color: "#8B7355" }}>
        익명으로 수집되며, 진단 엔진 개선에만 사용합니다.
      </p>

      {/* 별점 */}
      <div
        role="radiogroup"
        aria-label="진단 정확도 별점"
        style={{ display: "flex", gap: "4px", marginBottom: "12px" }}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = (hover || score) >= n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={score === n}
              aria-label={`${n}점`}
              onClick={() => setScore(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              style={{
                fontSize: "1.5rem",
                lineHeight: 1,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: filled ? "#B48A5A" : "rgba(28,25,23,.18)",
                padding: "2px 4px",
                transition: "color .15s",
              }}
            >
              ★
            </button>
          );
        })}
        <span style={{ marginLeft: "8px", fontSize: "0.78rem", color: "#8B7355", alignSelf: "center" }}>
          {score === 0 && "별점을 선택"}
          {score === 1 && "전혀 아닙니다"}
          {score === 2 && "거의 아닙니다"}
          {score === 3 && "보통입니다"}
          {score === 4 && "대체로 맞습니다"}
          {score === 5 && "정확합니다"}
        </span>
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 500))}
        placeholder="어떤 부분이 도움됐는지 / 어디가 어색했는지 한 줄이면 충분합니다 (선택)"
        rows={2}
        aria-label="피드백 코멘트"
        style={{
          width: "100%",
          border: "1px solid rgba(28,25,23,.18)",
          borderRadius: "8px",
          padding: "10px 12px",
          fontSize: "0.875rem",
          color: "#1C1917",
          background: "#FFFFFF",
          outline: "none",
          lineHeight: 1.6,
          resize: "vertical",
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
      />

      {errMsg && (
        <p role="alert" style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "#b91c1c" }}>
          {errMsg}
        </p>
      )}

      <div style={{ marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.72rem", color: "#8B7355" }}>{comment.length}/500</span>
        <button
          type="button"
          onClick={submit}
          disabled={status === "sending" || score < 1}
          style={{
            background: score < 1 ? "rgba(28,25,23,.2)" : "#1C1917",
            color: "#FAFAF7",
            padding: "10px 20px",
            border: "none",
            borderRadius: "8px",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: score < 1 ? "not-allowed" : "pointer",
            transition: "background .2s",
          }}
        >
          {status === "sending" ? "전송 중..." : "피드백 보내기"}
        </button>
      </div>
    </section>
  );
}
