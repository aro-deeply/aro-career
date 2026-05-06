import { Resend } from "resend";
import { JWT } from "google-auth-library";
import {
  PATTERN_LABELS,
  SCORE_KEY_TO_PATTERN,
  NEXT_STEP_LABELS,
} from "../shared/diagnosis-dictionary.js";
import { applyBoldHtml } from "../shared/markdown-bold.js";

const OPERATOR_EMAIL = "naminimiya@gmail.com";
// 발신지. 도메인 인증 전에는 onboarding@resend.dev (수신함이 가입 이메일=OPERATOR로 한정).
// Resend 도메인 인증 완료 후, Vercel 환경변수 RESEND_FROM 으로 본인 도메인 발신지로 교체:
//   예) RESEND_FROM="ARO Career Direction <notice@arocareer.com>"
const FROM = process.env.RESEND_FROM || "ARO 진단 신청 <onboarding@resend.dev>";

// Sheets 탭 이름. 한국 계정 기본값은 "시트1". 영문 계정은 "Sheet1". 환경변수로 덮어쓰기 가능.
const SHEETS_TAB_NAME = process.env.GOOGLE_SHEETS_TAB_NAME || "Sheet1";

// ─── Google Sheets 적재 (선택, 환경변수 없으면 자동 비활성화) ────────────────
async function appendToSheet({ submittedAt, name, email, diagnosis }) {
  if (
    !process.env.GOOGLE_SHEETS_ID ||
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  ) {
    return; // 미설정 — 조용히 스킵
  }
  try {
    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const { access_token } = await auth.authorize();

    const d = diagnosis || {};
    const rootLabel = PATTERN_LABELS[d.root_cause] || d.root_cause || "";
    const nextStep = NEXT_STEP_LABELS[d.next_step_recommendation] || d.next_step_recommendation || "";
    const verdict = String(d.key_verdict || "").replace(/\*\*/g, "");

    const range = `${SHEETS_TAB_NAME}!A:G`;
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_ID}` +
      `/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [[submittedAt, name, email, rootLabel, nextStep, d.correctability || "", verdict]],
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error("Google Sheets append failed:", r.status, text.slice(0, 300));
    }
  } catch (e) {
    console.error("Google Sheets append exception:", e?.message || e);
  }
}

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

function renderBold(text) {
  if (!text) return "";
  return applyBoldHtml(escapeHtml(text));
}

function renderParagraphs(text) {
  if (!text) return "";
  return escapeHtml(text)
    .split(/\n\n+/)
    .map((p) => `<p style="margin:0 0 12px">${applyBoldHtml(p.replace(/\n/g, "<br>"))}</p>`)
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

// ─── Applicant confirmation email (sent to user, NOT operator) ───────────────
// 신청자에게는 진단 핵심 판정 + 회신 안내만 전달. 전체 JSON·인용 근거는 운영자 메일에만.
export function renderApplicantEmailHtml({ name, diagnosis }) {
  const d = diagnosis || {};
  const rootLabel = PATTERN_LABELS[d.root_cause] || "";
  const nextStep = NEXT_STEP_LABELS[d.next_step_recommendation] || "";

  const verdictBlock = d.key_verdict
    ? `<div style="background:#fff8e1;border-left:4px solid #B48A5A;padding:14px 18px;margin:24px 0;font-size:14px"><div style="font-size:10px;letter-spacing:0.18em;color:#5E4A36;margin-bottom:8px;text-transform:uppercase;font-weight:700">핵심 판정</div><div style="font-weight:600">${renderBold(d.key_verdict)}</div></div>`
    : "";

  const rootRow = rootLabel
    ? `<tr><td style="padding:6px 0;color:#8B7355;width:120px">근본 패턴</td><td style="padding:6px 0;font-weight:600">${escapeHtml(rootLabel)}</td></tr>`
    : "";

  const nextStepRow = nextStep
    ? `<tr><td style="padding:6px 0;color:#8B7355">권장 다음 단계</td><td style="padding:6px 0;font-weight:600">${escapeHtml(nextStep)}</td></tr>`
    : "";

  return `<div style="font-family:'Apple SD Gothic Neo','Noto Sans KR',-apple-system,sans-serif;line-height:1.7;color:#1C1917;max-width:560px;margin:0 auto;padding:0;background:#FAFAF7">
  <div style="background:#1C1917;color:#FAFAF7;padding:14px 24px;font-size:11px;letter-spacing:0.22em;font-weight:700;text-transform:uppercase">ARO · CAREER DIRECTION</div>
  <div style="padding:24px">
    <h2 style="font-size:18px;margin:0 0 14px;letter-spacing:-0.01em;color:#1C1917">${escapeHtml(name)}님, 진단 신청이 접수되었습니다.</h2>
    <p style="margin:0 0 24px;font-size:14px;color:#57534E">평가자 관점의 진단 결과를 함께 검토한 뒤, 영업일 기준 1~2일 안에 본 메일 주소로 회신드립니다.</p>
    ${verdictBlock}
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:20px 0">${rootRow}${nextStepRow}</table>
    <hr style="border:0;border-top:1px solid rgba(28,25,23,.08);margin:28px 0">
    <p style="font-size:13px;color:#57534E;margin:0 0 12px"><strong style="color:#1C1917">회신 안내.</strong> 본 메일에 직접 답장하거나, <a href="mailto:${OPERATOR_EMAIL}" style="color:#5E4A36">${OPERATOR_EMAIL}</a> 으로 문의하실 수 있습니다. 진단의 상세 해석과 정리 방향은 회신 메일에 포함됩니다.</p>
    <p style="font-size:12px;color:#8B7355;margin:20px 0 0">상담 전환은 결과 회신을 받은 뒤 선택하실 수 있습니다. 1:1 단일 상담(90분, 18만원), 1:1 패키지(총 3회, 50만원) 중 필요한 깊이만큼만 결정하시면 됩니다.</p>
    <p style="font-size:11px;color:#8B7355;margin:32px 0 0;border-top:1px solid rgba(28,25,23,.08);padding-top:16px">입력 정보는 신청 후 6개월 자동 폐기됩니다. · ARO Career Direction · <a href="https://aro-career.vercel.app" style="color:#5E4A36">aro-career.vercel.app</a></p>
  </div>
</div>`;
}

export function renderEmailHtml({ name, email, submittedAt, diagnosis }) {
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
  const operatorSubject = `[ARO 진단 신청] ${name} / ${submittedAt}`;
  const operatorHtml = renderEmailHtml({ name, email, submittedAt, diagnosis });
  const applicantSubject = `[ARO] ${name}님, 진단 신청이 접수되었습니다`;
  const applicantHtml = renderApplicantEmailHtml({ name, diagnosis });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // 1. 운영자 알림 메일 (전체 진단 결과 포함)
    const operatorResult = await resend.emails.send({
      from: FROM,
      to: [OPERATOR_EMAIL],
      replyTo: email,
      subject: operatorSubject,
      html: operatorHtml,
    });
    if (operatorResult.error) {
      console.error("Resend operator email error:", operatorResult.error);
    }

    // 2. 신청자 확인 메일 (요약만 포함). 실패해도 사용자 응답에 영향 X.
    // ⚠ 도메인 미인증 + Resend 무료 티어에서는 가입 이메일(=OPERATOR_EMAIL) 외 발송이 차단됨.
    //    도메인 인증 후에만 신청자에게 실제로 도착함. 미인증 상태에서는 시도만 하고 로그.
    try {
      const applicantResult = await resend.emails.send({
        from: FROM,
        to: [email],
        replyTo: OPERATOR_EMAIL,
        subject: applicantSubject,
        html: applicantHtml,
      });
      if (applicantResult.error) {
        console.error("Resend applicant email error:", applicantResult.error);
      }
    } catch (e) {
      console.error("Applicant email failed (non-blocking):", e?.message || e);
    }

    // 3. Google Sheets 적재 (실패해도 사용자 응답에 영향 X)
    await appendToSheet({ submittedAt, name, email, diagnosis });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("lead handler failed:", err?.message || err);
    return res.status(200).json({ ok: true });
  }
}
