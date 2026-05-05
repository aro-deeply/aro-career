import React from "react";

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
      <div className="mt-12 p-8 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
        <p className="text-emerald-900 font-semibold">잘 접수되었습니다.</p>
        <p className="text-emerald-700 text-sm mt-2">운영자가 확인 후 회신드립니다. (영업일 기준 1~2일)</p>
      </div>
    );
  }

  return (
    <div className="mt-12 p-8 bg-neutral-50 border border-neutral-200 rounded-lg">
      <h3 className="text-xl font-bold mb-2">전문가 상담 신청</h3>
      <p className="text-sm text-neutral-600 mb-6">
        진단 결과를 바탕으로 한 1:1 상담을 신청합니다. 위 진단 결과가 운영자에게 함께 전달됩니다.
      </p>
      <div className="grid gap-3">
        <input
          type="text"
          placeholder="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2"
        />
        <input
          type="email"
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-neutral-300 rounded px-3 py-2"
        />
        <label className="flex items-start gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-1"
          />
          <span>
            <b>(필수)</b> 위 이름·이메일과 진단 결과가 운영자에게 전달됨에 동의합니다.
            보관 기간 6개월. 문의/삭제: <a href="mailto:naminimiya@gmail.com" className="underline">naminimiya@gmail.com</a>
          </span>
        </label>
        {errMsg && <p className="text-red-600 text-sm">{errMsg}</p>}
        <button
          onClick={submit}
          disabled={status === "sending" || !agree}
          className="bg-neutral-900 text-white py-3 rounded font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "sending" ? "전송 중..." : "상담 신청"}
        </button>
      </div>
    </div>
  );
}
