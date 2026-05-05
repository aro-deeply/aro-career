import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { renderEmailHtml } from "../api/lead.js";
import { FIXTURE_LEAD } from "./_fixtures/diagnosis-fixture.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = resolve(__dirname, "__snapshots__/email.html");

test("renderEmailHtml: output matches golden snapshot", () => {
  const html = renderEmailHtml(FIXTURE_LEAD);

  if (!existsSync(SNAPSHOT_PATH)) {
    writeFileSync(SNAPSHOT_PATH, html, "utf8");
    console.log(`[snapshot created] ${SNAPSHOT_PATH}`);
    return;
  }

  const expected = readFileSync(SNAPSHOT_PATH, "utf8");
  assert.equal(html, expected, "이메일 HTML 출력이 스냅샷과 다릅니다.");
});
