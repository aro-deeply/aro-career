import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import ResultStep from "../src/diagnosis/ResultStep.jsx";
import { FIXTURE_DIAGNOSIS } from "./_fixtures/diagnosis-fixture.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = resolve(__dirname, "__snapshots__/result-step.html");

const noop = () => {};

test("ResultStep: output matches golden snapshot", () => {
  const html = renderToString(
    React.createElement(ResultStep, { result: FIXTURE_DIAGNOSIS, onReset: noop })
  );

  if (!existsSync(SNAPSHOT_PATH)) {
    writeFileSync(SNAPSHOT_PATH, html, "utf8");
    console.log(`[snapshot created] ${SNAPSHOT_PATH}`);
    return;
  }

  const expected = readFileSync(SNAPSHOT_PATH, "utf8");
  assert.equal(html, expected, "ResultStep 출력이 스냅샷과 다릅니다.");
});
