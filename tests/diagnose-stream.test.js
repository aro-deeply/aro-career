// NDJSON 스트림 리더 테스트. 청크 경계가 이벤트 중간에 걸려도 올바르게 누적해야 한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readDiagnosisStream, parseDiagnosisJson } from "../src/diagnosis/diagnose-stream.js";

function streamOf(chunks) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
}

const delta = (text) => JSON.stringify({ t: "delta", text }) + "\n";

test("delta 이벤트를 순서대로 누적하고 진행 콜백을 호출한다", async () => {
  const body = streamOf([delta('{"a"'), delta(':1}'), '{"t":"done"}\n']);
  const seen = [];
  const acc = await readDiagnosisStream(body, (a) => seen.push(a));
  assert.equal(acc, '{"a":1}');
  assert.deepEqual(seen, ['{"a"', '{"a":1}']);
});

test("청크 경계가 NDJSON 줄 중간에 걸려도 정상 동작한다", async () => {
  const full = delta("앞부분 ") + delta("뒷부분") + '{"t":"done"}\n';
  const mid = Math.floor(full.length / 2) - 3;
  const body = streamOf([full.slice(0, mid), full.slice(mid)]);
  const acc = await readDiagnosisStream(body, null);
  assert.equal(acc, "앞부분 뒷부분");
});

test("error 이벤트는 서버 메시지를 담아 던진다", async () => {
  const body = streamOf([delta("일부"), '{"t":"error","message":"형식 오류입니다."}\n']);
  await assert.rejects(
    () => readDiagnosisStream(body, null),
    (e) => e.userMessage === "형식 오류입니다."
  );
});

test("parseDiagnosisJson은 코드펜스를 제거하고 파싱한다", () => {
  assert.deepEqual(parseDiagnosisJson('```json\n{"x":1}\n```'), { x: 1 });
  assert.deepEqual(parseDiagnosisJson('  {"x":2} '), { x: 2 });
});
