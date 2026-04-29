import { Resend } from "resend";

const OPERATOR_EMAIL = "naminimiya@gmail.com";
const FROM = "ARO 진단 신청 <onboarding@resend.dev>";

function isValidEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PATTERN_LABELS = {
  pattern_01: "규격화된 정형성",
  pattern_02: "근거 부재와 과장",
  pattern_03: "차별화 판단 오류",
  pattern_04: "직무 적합성 어긋남",
  pattern_05: "업계 맥락 부재",
};

const SCORE_KEY_TO_PATTERN = {
  pattern_01_generic_template: "pattern_01",
  pattern_02_unsupported_claims: "pattern_02",
  pattern_03_differentiation_mishandling: "pattern_03",
  pattern_04_job_fit_mismatch: "pattern_04",
  pattern_05_industry_context_absence: "pattern_05",
};

const NEXT_STEP_LABELS = {
  Rewrite: "재작성 (Rewrite)",
  Rehearse: "리허설 (Rehearse)",
  Direct: "직접 컨설팅 (Direct)",
};

function renderBold(text) {
  if (!text) return "";
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

function renderParagraphs(text) {
  if (!text) return "";
  return escapeHtml(text)
    .split(/\n\n+/)
    .map(
      (p) =>
        `<p style="margin:0 0 12px">${p
          .replace(/\n/g, "<br>")
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")}</p>`
    )
    .join("");
}

function renderScoreRow(scoreKey, scoreValue, rootCause) {
  const patternId = SCORE_KEY_TO_PATTERN[scoreKey] || scoreKey;
  const label = PATTERN_LABELS[patternId] || scoreKey;
  const num = typeof scoreValue === "number" ? scoreValue : 0;
  const pct = Math.round(num * 100);
  const isRoot = patternId === rootCause;
  const barColor = isRoot ? "#b8321a" : "#1a47d1";
  const rootBadge = isRoot
    ? ' <span style="color:#b8321a;font-weight:700;font-size:11px">← 근본</span>'
    : "";
  return `
    <tr>
      <td style="padding:4px 8px 4px 0;font-size:13px;width:170px;vertical-align:middle">${escapeHtml(label)}${rootBadge}</td>
      <td style="padding:4px 0;vertical-align:middle">
        <div style="background:#f6f6f4;height:10px;border-radius:5px;overflow:hidden;width:240px">
          <div style="background:${barColor};height:100%;width:${pct}%"></div>
        </div>
      </td>
      <td style="padding:4px 0 4px 8px;font-size:13px;font-family:'Courier New',monospace;text-align:right;width:50px;vertical-align:middle">${num.toFixed(2)}</td>
    </tr>`;
}

function renderEmailHtml({ name, email, submittedAt, diagnosis }) {
  const d = diagnosis || {};
  const scores = d.pattern_scores || {};
  const evidence = Array.isArray(d.evidence) ? d.evidence : [];
  const questions = Array.isArray(d.self_reflection_questions)
    ? d.self_reflection_questions
    : [];
  const rootLabel = PATTERN_LABELS[d.root_cause] || d.root_cause || "";
  const nextStep = NEXT_STEP_LABELS[d.next_step_recommendation] || d.next_step_recommendation || "";
  const json = JSON.stringify(diagnosis, null, 2);

  return `
<div style="font-family:'Apple SD Gothic Neo','Noto Sans KR',-apple-system,sans-serif;line-height:1.7;color:#111;max-width:680px;margin:0 auto;padding:24px">

  <h2 style="margin:0 0 24px;font-size:20px;border-bottom:2px solid #111;padding-bottom:12px">[ARO 진단 신청]</h2>

  <table cellpadding="8" style="border-collapse:collapse;font-size:14px;margin-bottom:32px;width:100%">
    <tr><td style="background:#f6f6f4;width:120px;font-weight:600">신청 시각</td><td>${escapeHtml(submittedAt)}</td></tr>
    <tr><td style="background:#f6f6f4;font-weight:600">이름</td><td>${escapeHtml(name)}</td></tr>
    <tr><td style="background:#f6f6f4;font-weight:600">이메일</td><td><a href="mailto:${escapeHtml(email)}" style="color:#1a47d1">${escapeHtml(email)}</a></td></tr>
  </table>

  <h3 style="margin:0 0 12px;font-size:16px">🎯 핵심 판정</h3>
  <div style="background:#fff8e1;border-left:4px solid #ffd27a;padding:16px;margin-bottom:24px;font-size:15px;font-weight:600">
    ${renderBold(d.key_verdict)}
  </div>

  <table cellpadding="8" style="border-collapse:collapse;font-size:14px;margin-bottom:32px;width:100%">
    <tr><td style="background:#f6f6f4;width:160px;font-weight:600">근본 패턴</td><td><b>${escapeHtml(rootLabel)}</b> <span style="color:#737373;font-size:12px">(${escapeHtml(d.root_cause || "")})</span></td></tr>
    <tr><td style="background:#f6f6f4;font-weight:600">교정 가능성</td><td>${escapeHtml(d.correctability || "")}</td></tr>
    <tr><td style="background:#f6f6f4;font-weight:600">권장 다음 단계</td><td><b>${escapeHtml(nextStep)}</b></td></tr>
  </table>

  <h3 style="margin:0 0 12px;font-size:16px">📊 5개 패턴 점수</h3>
  <table style="border-collapse:collapse;margin-bottom:32px">
    ${Object.entries(scores)
      .map(([k, v]) => renderScoreRow(k, v, d.root_cause))
      .join("")}
  </table>

  <h3 style="margin:24px 0 12px;font-size:16px">🔍 근본 진단</h3>
  <div style="background:#f6f6f4;padding:16px;border-radius:6px;margin-bottom:24px;font-size:14px">
    ${renderBold(d.root_diagnosis)}
  </div>

  <h3 style="margin:24px 0 12px;font-size:16px">📝 종합 진단</h3>
  <div style="background:#fff;border:1px solid #e4e4e0;padding:20px;border-radius:6px;margin-bottom:24px;font-size:14px">
    ${renderParagraphs(d.one_pager_summary)}
  </div>

  <h3 style="margin:24px 0 12px;font-size:16px">🔎 인용 근거 (${evidence.length}건)</h3>
  <div style="margin-bottom:24px">
    ${evidence
      .map(
        (e) => `
    <div style="border-left:3px solid #1a47d1;padding:10px 14px;margin-bottom:10px;background:#edf1ff;font-size:13px">
      <p style="margin:0 0 6px;font-style:italic;color:#1f1f1f">"${escapeHtml(e.quote || "")}"</p>
      <p style="margin:0 0 6px;font-size:12px;color:#737373"><b>${escapeHtml(e.signal || "")}</b></p>
      <p style="margin:0;color:#4a4a4a">${escapeHtml(e.why || "")}</p>
    </div>`
      )
      .join("")}
  </div>

  <h3 style="margin:24px 0 12px;font-size:16px">💭 자가 성찰 질문</h3>
  <ol style="padding-left:20px;margin:0 0 24px;font-size:14px">
    ${questions.map((q) => `<li style="margin-bottom:6px">${escapeHtml(q)}</li>`).join("")}
  </ol>

  <details style="margin-top:32px;padding-top:16px;border-top:1px solid #e4e4e0">
    <summary style="cursor:pointer;color:#737373;font-size:12px">📎 원본 JSON 데이터 (가공/저장용)</summary>
    <pre style="background:#f6f6f4;padding:14px;border-radius:6px;font-size:11px;white-space:pre-wrap;word-break:break-word;margin-top:8px">${escapeHtml(json)}</pre>
  </details>

  <p style="font-size:11px;color:#737373;margin-top:24px;border-top:1px solid #e4e4e0;padding-top:12px">
    이 메일은 ARO 진단 페이지(/diagnosis)의 신청 폼에서 자동 발송된 알림입니다. 회신은 신청자 이메일로 직접 전달됩니다.
  </p>
</div>`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, diagnosis, consent } = req.body || {};

  if (!name || typeof name !== "string" || name.length < 1 || name.length > 50) {
    return res.status(400).json({ error: "이름을 1~50자로 입력해주세요." });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "올바른 이메일 형식이 아닙니다." });
  }
  if (!consent) {
    return res.status(400).json({ error: "개인정보 처리에 동의해야 신청할 수 있습니다." });
  }
  if (!diagnosis || typeof diagnosis !== "object") {
    return res.status(400).json({ error: "진단 결과가 누락되었습니다." });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "서버 설정 오류: RESEND_API_KEY가 설정되지 않았습니다." });
  }

  const submittedAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  const subject = `[ARO 진단 신청] ${name} / ${submittedAt}`;
  const html = renderEmailHtml({ name, email, submittedAt, diagnosis });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [OPERATOR_EMAIL],
      replyTo: email,
      subject,
      html,
    });
    if (error) {
      console.error("Resend error:", error);
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("lead handler failed:", err?.message || err);
    return res.status(200).json({ ok: true });
  }
}
