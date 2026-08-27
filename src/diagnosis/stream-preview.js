// 스트리밍 중 도착한 미완성 JSON 텍스트에서 "완성된" 문자열 필드만 추출한다.
// 로딩 화면의 핵심 판정 미리보기에 사용 — 값이 아직 절반만 도착한 필드는 건드리지 않는다.

// JSON 문자열 리터럴이 닫혔을 때만 매치: 이스케이프(\")를 문자열 종료로 오인하지 않는다.
function extractCompletedStringField(text, field) {
  const m = text.match(new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  if (!m) return null;
  try {
    return JSON.parse(`"${m[1]}"`);
  } catch {
    return null;
  }
}

function stripBoldMarkers(text) {
  if (text == null) return null;
  return text.replace(/\*\*/g, "");
}

export function extractStreamPreview(partialText) {
  return {
    keyVerdict: stripBoldMarkers(extractCompletedStringField(partialText, "key_verdict")),
    rootDiagnosis: stripBoldMarkers(extractCompletedStringField(partialText, "root_diagnosis")),
  };
}
