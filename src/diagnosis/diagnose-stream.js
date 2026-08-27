// /api/diagnose의 NDJSON 스트림을 읽어 delta 텍스트를 누적한다.
// 이벤트 규약: {"t":"delta","text":...} 반복 후 {"t":"done"} 또는 {"t":"error","message":...}.
// error 이벤트는 서버가 보낸 사용자용 메시지를 담은 예외(userMessage)로 던진다.

export async function readDiagnosisStream(body, onProgress) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = "";
  let accumulated = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    lineBuffer += decoder.decode(value, { stream: true });

    let newlineIdx;
    while ((newlineIdx = lineBuffer.indexOf("\n")) >= 0) {
      const line = lineBuffer.slice(0, newlineIdx).trim();
      lineBuffer = lineBuffer.slice(newlineIdx + 1);
      if (!line) continue;

      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.t === "delta") {
        accumulated += event.text;
        if (onProgress) onProgress(accumulated);
      } else if (event.t === "error") {
        const err = new Error(event.message || "일시적 오류가 발생했습니다.");
        err.userMessage = event.message;
        throw err;
      }
    }
  }
  return accumulated;
}

export function parseDiagnosisJson(accumulated) {
  const cleaned = accumulated
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  return JSON.parse(cleaned);
}
