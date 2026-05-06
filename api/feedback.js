import { JWT } from "google-auth-library";

// 피드백 시트 탭 이름. 환경변수로 덮어쓰기 가능.
const SHEETS_FEEDBACK_TAB_NAME = process.env.GOOGLE_SHEETS_FEEDBACK_TAB_NAME || "Feedback";

async function appendFeedbackToSheet({ submittedAt, score, comment, rootCause, keyVerdict }) {
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

    const range = `${SHEETS_FEEDBACK_TAB_NAME}!A:E`;
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
        values: [[submittedAt, score, comment || "", rootCause || "", keyVerdict || ""]],
      }),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      console.error("Feedback Sheets append failed:", r.status, text.slice(0, 300));
    }
  } catch (e) {
    console.error("Feedback Sheets append exception:", e?.message || e);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { score, comment, rootCause, keyVerdict } = req.body || {};

  // 검증
  const scoreNum = Number(score);
  if (!Number.isInteger(scoreNum) || scoreNum < 1 || scoreNum > 5) {
    return res.status(400).json({ error: "별점은 1~5 사이의 정수여야 합니다." });
  }
  if (typeof comment !== "undefined" && comment !== null && (typeof comment !== "string" || comment.length > 500)) {
    return res.status(400).json({ error: "코멘트는 500자 이내의 문자열이어야 합니다." });
  }

  const submittedAt = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  await appendFeedbackToSheet({
    submittedAt,
    score: scoreNum,
    comment: typeof comment === "string" ? comment : "",
    rootCause: typeof rootCause === "string" ? rootCause.slice(0, 50) : "",
    keyVerdict: typeof keyVerdict === "string" ? keyVerdict.slice(0, 200) : "",
  });

  return res.status(200).json({ ok: true });
}
