import React from "react";

const SR_ONLY_STYLE = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

export default function ConsultRequestForm({ result }) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [agree, setAgree] = React.useState(false);
  const [status, setStatus] = React.useState("idle");
  const [errMsg, setErrMsg] = React.useState("");

  async function submit() {
    setErrMsg("");
    if (!name.trim() || !email.trim()) {
      setErrMsg("이름과 이메일을 입력해주세요.");
      return;
    }
    if (!agree) {
      setErrMsg("개인정보 처리에 동의해야 신청할 수 있습니다.");
      return;
    }
    setStatus("sending");
    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), consent: true, diagnosis: result }),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setErrMsg(data?.error || "전송에 실패했습니다. 잠시 후 다시 시도해주세요.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch (e) {
      setErrMsg("네트워크 오류입니다. 잠시 후 다시 시도해주세요.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        style={{
          marginTop: "3rem",
          padding: "2rem",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "12px",
          textAlign: "center",
        }}
      >
        <p style={{ color: "#14532d", fontWeight: 600 }}>잘 접수되었습니다.</p>
        <p style={{ color: "#166534", fontSize: "0.875rem", marginTop: "0.5rem" }}>
          운영자가 확인 후 회신드립니다. (영업일 기준 1~2일)
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: "3rem",
        padding: "clamp(1.5rem, 4vw, 2rem)",
        background: "#F7F1E8",
        border: "1px solid rgba(28,25,23,.1)",
        borderRadius: "12px",
      }}
    >
      <h3
        style={{
          fontSize: "1.125rem",
          fontWeight: 700,
          color: "#1C1917",
          marginBottom: "0.5rem",
          letterSpacing: "-0.015em",
          wordBreak: "keep-all",
        }}
      >
        진단 결과를 바탕으로 상담 문의하기
      </h3>
      <p style={{ fontSize: "0.875rem", color: "#6B625C", marginBottom: "1.5rem", lineHeight: 1.6 }}>
        결과를 보고 더 깊게 정리하고 싶은 경우에만 남겨 주세요. 상담 신청은 선택입니다.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <label htmlFor="consult-name" style={SR_ONLY_STYLE}>이름</label>
        <input
          id="consult-name"
          type="text"
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{
            border: "1px solid rgba(28,25,23,.18)",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "0.9375rem",
            color: "#1C1917",
            background: "#FFFFFF",
            outline: "none",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#5E4A36")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(28,25,23,.18)")}
        />
        <label htmlFor="consult-email" style={SR_ONLY_STYLE}>이메일</label>
        <input
          id="consult-email"
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            border: "1px solid rgba(28,25,23,.18)",
            borderRadius: "8px",
            padding: "10px 14px",
            fontSize: "0.9375rem",
            color: "#1C1917",
            background: "#FFFFFF",
            outline: "none",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#5E4A36")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(28,25,23,.18)")}
        />
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            fontSize: "0.8125rem",
            color: "#57534E",
            lineHeight: 1.6,
          }}
        >
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            style={{ marginTop: "3px", flexShrink: 0 }}
          />
          <span>
            <b>(필수)</b> 위 이름·이메일과 진단 결과가 운영자에게 전달됨에 동의합니다.{" "}
            입력한 정보는 상담 안내와 회신 목적으로만 사용됩니다.{" "}
            보관 기간 6개월. 문의/삭제:{" "}
            <a href="mailto:naminimiya@gmail.com" style={{ textDecoration: "underline" }}>
              naminimiya@gmail.com
            </a>
          </span>
        </label>
        {errMsg && (
          <p role="alert" style={{ color: "#b91c1c", fontSize: "0.875rem" }}>{errMsg}</p>
        )}
        <button
          onClick={submit}
          disabled={status === "sending" || !agree}
          aria-busy={status === "sending"}
          style={{
            background: "#1C1917",
            color: "#FAFAF7",
            padding: "14px",
            borderRadius: "8px",
            fontWeight: 600,
            fontSize: "0.9375rem",
            border: "none",
            cursor: (status === "sending" || !agree) ? "not-allowed" : "pointer",
            opacity: (status === "sending" || !agree) ? 0.5 : 1,
            transition: "background .2s",
          }}
          onMouseOver={(e) => {
            if (status !== "sending" && agree) e.currentTarget.style.background = "#5E4A36";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = "#1C1917";
          }}
        >
          {status === "sending" ? "전송 중..." : "상담 문의 보내기"}
        </button>
      </div>
    </div>
  );
}
