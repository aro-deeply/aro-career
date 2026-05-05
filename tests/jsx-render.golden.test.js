import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  renderMarkdownBold,
  BOLD_DEFAULT_CLASS,
  BOLD_HIGHLIGHT_CLASS,
} from "../src/shared/render-markdown-bold.jsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = resolve(__dirname, "__snapshots__/jsx-bold.html");

const SAMPLES = [
  { name: "default-class", text: "근본 원인은 **회사 이해 공백**입니다.", cls: BOLD_DEFAULT_CLASS },
  { name: "highlight-class", text: "**본인의 기여 범위가 가려집니다**.", cls: BOLD_HIGHLIGHT_CLASS },
  { name: "no-bold", text: "범용 문구입니다.", cls: BOLD_DEFAULT_CLASS },
  { name: "multiple", text: "**A**와 **B**", cls: BOLD_DEFAULT_CLASS },
  { name: "empty", text: "", cls: BOLD_DEFAULT_CLASS },
];

test("renderMarkdownBold: output matches golden snapshot", () => {
  const rendered = SAMPLES.map(({ name, text, cls }) => {
    const tree = React.createElement("div", { id: name }, renderMarkdownBold(text, cls));
    return `--- ${name} ---\n${renderToString(tree)}\n`;
  }).join("\n");

  if (!existsSync(SNAPSHOT_PATH)) {
    writeFileSync(SNAPSHOT_PATH, rendered, "utf8");
    console.log(`[snapshot created] ${SNAPSHOT_PATH}`);
    return;
  }

  const expected = readFileSync(SNAPSHOT_PATH, "utf8");
  assert.equal(rendered, expected, "JSX 볼드 헬퍼 출력이 스냅샷과 다릅니다.");
});
