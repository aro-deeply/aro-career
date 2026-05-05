# Shared Diagnosis Dictionary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 진단 결과의 도메인 사전(패턴 라벨, 점수 키 매핑, 마크다운 볼드 파서)을 단일 출처로 통합해 프론트(`src/diagnosis/main.jsx`)와 API(`api/lead.js`)에서 공유하도록 리팩토링한다. 동작 변경 0, 리팩토링만.

**Architecture:** 프로젝트 루트에 `shared/` 디렉토리를 새로 만들어 순수 JS 모듈 2개(`diagnosis-dictionary.js`, `markdown-bold.js`)를 둔다. Vite는 상대 경로로 가져오는 모듈을 번들에 포함하고, Vercel Functions의 esbuild 번들러도 같은 방식으로 처리하므로 추가 설정 없이 양쪽에서 import 가능하다. 테스트는 Node 20 내장 `node:test` 러너(추가 의존성 0)와 `react-dom/server`의 `renderToString`을 사용한 Golden Master 스냅샷으로 진행한다.

**Tech Stack:** Node 20 (`node --test`), Vite 5, React 18, Vercel Functions, Resend, Anthropic SDK. **새로 추가하는 의존성 없음.**

---

## File Structure

**Create:**
- `shared/markdown-bold.js` — 마크다운 `**...**` 파싱 원시 함수 (정규식, split, HTML replace). 외부 의존 없음.
- `shared/diagnosis-dictionary.js` — `PATTERN_LABELS`, `SCORE_KEY_TO_PATTERN`, `NEXT_STEP_LABELS`, `getPatternIdFromScoreKey()`. 외부 의존 없음.
- `tests/markdown-bold.test.js` — `node:test` 단위 테스트.
- `tests/diagnosis-dictionary.test.js` — `node:test` 단위 테스트.
- `tests/email-render.golden.test.js` — `renderEmailHtml`의 Golden Master.
- `tests/jsx-render.golden.test.js` — main.jsx 신규 헬퍼의 React `renderToString` Golden Master.
- `tests/__snapshots__/email.html` — 이메일 출력 스냅샷.
- `tests/__snapshots__/jsx-bold.html` — JSX 출력 스냅샷.

**Modify:**
- `package.json` — `"test": "node --test tests/"` 스크립트 추가.
- `api/lead.js:19-44` — 라벨/매핑 상수와 `renderBold`/`renderParagraphs` 내부를 shared import로 교체.
- `src/diagnosis/main.jsx:119-218` — `patternLabels`, `renderWithBold`, `renderWithHighlight`, score key `startsWith` 인라인을 shared import + 단일 헬퍼로 교체.

**Do not modify:**
- `api/diagnose.js` — 이번 라운드 변경 없음.
- `index.html`, `diagnosis.html`, `vite.config.js`, `vercel.json` — 변경 없음.

---

## Pre-flight: Working Directory

이 플랜의 모든 명령은 `projects/aro-career` 디렉토리 기준으로 실행한다. 시작 전 확인:

```bash
cd projects/aro-career
pwd  # → 끝이 /aro-career 여야 함
```

---

### Task 0: Set Up Test Infrastructure

Node 20 내장 테스트 러너를 활성화하고 `tests/` 디렉토리를 만든다.

**Files:**
- Modify: `package.json` (scripts 섹션)
- Create: `tests/.gitkeep`

- [ ] **Step 1: 현재 package.json scripts 확인**

Run: `cat package.json`
Expected: `"scripts"`에 `"dev"`, `"build"`, `"preview"`만 존재. `"test"` 없음.

- [ ] **Step 2: package.json에 test 스크립트 추가**

`scripts` 섹션을 다음으로 교체:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "node --test tests/"
}
```

- [ ] **Step 3: tests 디렉토리 생성**

```bash
mkdir -p tests/__snapshots__
touch tests/.gitkeep tests/__snapshots__/.gitkeep
```

- [ ] **Step 4: 빈 테스트로 러너 동작 확인**

`tests/_smoke.test.js` 파일 생성:

```js
import { test } from "node:test";
import assert from "node:assert/strict";

test("smoke: node test runner works", () => {
  assert.equal(1 + 1, 2);
});
```

Run: `npm test`
Expected: `tests 1`, `pass 1`, `fail 0` 가 출력됨.

- [ ] **Step 5: smoke 테스트 제거 (목적 달성)**

```bash
rm tests/_smoke.test.js
```

- [ ] **Step 6: Commit**

```bash
git add package.json tests/
git commit -m "chore: add node:test runner and tests scaffolding"
```

---

### Task 1: shared/markdown-bold.js (TDD)

마크다운 `**...**`를 다루는 순수 함수 4개. **HTML 문자열용**과 **JSX 토큰화용** 모두 지원.

**Files:**
- Create: `shared/markdown-bold.js`
- Test: `tests/markdown-bold.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/markdown-bold.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyBoldHtml,
  splitByBold,
  isBoldToken,
  stripBoldDelimiters,
} from "../shared/markdown-bold.js";

test("applyBoldHtml: converts **text** to <strong>text</strong>", () => {
  assert.equal(applyBoldHtml("hello **world**"), "hello <strong>world</strong>");
});

test("applyBoldHtml: leaves plain text untouched", () => {
  assert.equal(applyBoldHtml("no bold here"), "no bold here");
});

test("applyBoldHtml: handles multiple bold spans", () => {
  assert.equal(
    applyBoldHtml("**a** middle **b**"),
    "<strong>a</strong> middle <strong>b</strong>"
  );
});

test("applyBoldHtml: empty string returns empty string", () => {
  assert.equal(applyBoldHtml(""), "");
});

test("splitByBold: returns alternating plain/bold parts", () => {
  assert.deepEqual(
    splitByBold("hello **world** and **friend**"),
    ["hello ", "**world**", " and ", "**friend**", ""]
  );
});

test("splitByBold: returns single plain part when no bold", () => {
  assert.deepEqual(splitByBold("plain"), ["plain"]);
});

test("isBoldToken: true for **wrapped**", () => {
  assert.equal(isBoldToken("**hi**"), true);
});

test("isBoldToken: false for plain text", () => {
  assert.equal(isBoldToken("hi"), false);
});

test("isBoldToken: false for half-wrapped", () => {
  assert.equal(isBoldToken("**hi"), false);
  assert.equal(isBoldToken("hi**"), false);
});

test("stripBoldDelimiters: removes the surrounding **", () => {
  assert.equal(stripBoldDelimiters("**hello**"), "hello");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: `Cannot find module '../shared/markdown-bold.js'` 또는 import 에러로 fail.

- [ ] **Step 3: 최소 구현 작성**

`shared/markdown-bold.js`:

```js
const BOLD_REPLACE_PATTERN = /\*\*([^*]+)\*\*/g;
const BOLD_SPLIT_PATTERN = /(\*\*[^*]+\*\*)/g;

export function applyBoldHtml(text) {
  if (!text) return "";
  return text.replace(BOLD_REPLACE_PATTERN, "<strong>$1</strong>");
}

export function splitByBold(text) {
  if (!text) return [""];
  return text.split(BOLD_SPLIT_PATTERN);
}

export function isBoldToken(s) {
  return typeof s === "string" && s.startsWith("**") && s.endsWith("**") && s.length >= 4;
}

export function stripBoldDelimiters(s) {
  return s.slice(2, -2);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: 10개 테스트 모두 pass.

- [ ] **Step 5: Commit**

```bash
git add shared/markdown-bold.js tests/markdown-bold.test.js
git commit -m "feat(shared): add markdown-bold parsing primitives"
```

---

### Task 2: shared/diagnosis-dictionary.js (TDD)

5개 진단 패턴 라벨, 점수 키 ↔ 패턴 ID 매핑, 다음 단계 라벨을 한 곳에 정의.

**Files:**
- Create: `shared/diagnosis-dictionary.js`
- Test: `tests/diagnosis-dictionary.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/diagnosis-dictionary.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PATTERN_LABELS,
  SCORE_KEY_TO_PATTERN,
  NEXT_STEP_LABELS,
  getPatternIdFromScoreKey,
  getPatternLabel,
} from "../shared/diagnosis-dictionary.js";

test("PATTERN_LABELS: 5 patterns with short labels", () => {
  assert.equal(PATTERN_LABELS.pattern_01, "규격화된 정형성");
  assert.equal(PATTERN_LABELS.pattern_02, "근거 부재와 과장");
  assert.equal(PATTERN_LABELS.pattern_03, "차별화 판단 오류");
  assert.equal(PATTERN_LABELS.pattern_04, "직무 적합성 어긋남");
  assert.equal(PATTERN_LABELS.pattern_05, "업계 맥락 부재");
});

test("SCORE_KEY_TO_PATTERN: maps long score keys to short pattern ids", () => {
  assert.equal(SCORE_KEY_TO_PATTERN.pattern_01_generic_template, "pattern_01");
  assert.equal(SCORE_KEY_TO_PATTERN.pattern_05_industry_context_absence, "pattern_05");
});

test("NEXT_STEP_LABELS: maps Rewrite/Rehearse/Direct", () => {
  assert.equal(NEXT_STEP_LABELS.Rewrite, "재작성 (Rewrite)");
  assert.equal(NEXT_STEP_LABELS.Rehearse, "리허설 (Rehearse)");
  assert.equal(NEXT_STEP_LABELS.Direct, "직접 컨설팅 (Direct)");
});

test("getPatternIdFromScoreKey: returns pattern_NN for long key", () => {
  assert.equal(getPatternIdFromScoreKey("pattern_03_differentiation_mishandling"), "pattern_03");
});

test("getPatternIdFromScoreKey: returns the input unchanged if not in dictionary", () => {
  assert.equal(getPatternIdFromScoreKey("unknown_key"), "unknown_key");
});

test("getPatternLabel: returns short label for known id", () => {
  assert.equal(getPatternLabel("pattern_02"), "근거 부재와 과장");
});

test("getPatternLabel: returns the id unchanged if not in dictionary", () => {
  assert.equal(getPatternLabel("pattern_99"), "pattern_99");
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: `Cannot find module '../shared/diagnosis-dictionary.js'`로 fail.

- [ ] **Step 3: 최소 구현 작성**

`shared/diagnosis-dictionary.js`:

```js
export const PATTERN_LABELS = {
  pattern_01: "규격화된 정형성",
  pattern_02: "근거 부재와 과장",
  pattern_03: "차별화 판단 오류",
  pattern_04: "직무 적합성 어긋남",
  pattern_05: "업계 맥락 부재",
};

export const SCORE_KEY_TO_PATTERN = {
  pattern_01_generic_template: "pattern_01",
  pattern_02_unsupported_claims: "pattern_02",
  pattern_03_differentiation_mishandling: "pattern_03",
  pattern_04_job_fit_mismatch: "pattern_04",
  pattern_05_industry_context_absence: "pattern_05",
};

export const NEXT_STEP_LABELS = {
  Rewrite: "재작성 (Rewrite)",
  Rehearse: "리허설 (Rehearse)",
  Direct: "직접 컨설팅 (Direct)",
};

export function getPatternIdFromScoreKey(scoreKey) {
  return SCORE_KEY_TO_PATTERN[scoreKey] || scoreKey;
}

export function getPatternLabel(patternId) {
  return PATTERN_LABELS[patternId] || patternId;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: 모든 테스트 pass (이전 markdown-bold 10건 + 7건).

- [ ] **Step 5: Commit**

```bash
git add shared/diagnosis-dictionary.js tests/diagnosis-dictionary.test.js
git commit -m "feat(shared): add diagnosis dictionary (labels, score-key mapping)"
```

---

### Task 3: Capture Email Golden Master Snapshot

`api/lead.js`의 `renderEmailHtml`이 현재 어떤 HTML을 생성하는지 스냅샷을 떠서, 이후 리팩토링이 출력을 바꾸지 않았다는 보증을 만든다.

**Files:**
- Create: `tests/email-render.golden.test.js`
- Create: `tests/__snapshots__/email.html` (스크립트가 자동 생성)
- Create: `tests/_fixtures/diagnosis-fixture.js`

- [ ] **Step 1: 고정 입력 생성**

`tests/_fixtures/diagnosis-fixture.js`:

```js
export const FIXTURE_DIAGNOSIS = {
  root_cause: "pattern_05",
  dominant_pattern: "pattern_05",
  pattern_scores: {
    pattern_01_generic_template: 0.78,
    pattern_02_unsupported_claims: 0.62,
    pattern_03_differentiation_mishandling: 0.41,
    pattern_04_job_fit_mismatch: 0.55,
    pattern_05_industry_context_absence: 0.88,
  },
  evidence: [
    {
      quote: "귀사의 인재상에 부합하는 성실하고 책임감 있는 인재가 되겠습니다.",
      signal: "Pattern 05 · 귀사 호칭 · 범용 문구",
      why: "범용 구문입니다.",
    },
  ],
  root_diagnosis: "근본 원인은 **지원 회사 이해의 공백**입니다.",
  key_verdict: "업계 맥락 부재에서 비롯된 구조입니다.",
  one_pager_summary:
    "근본 원인은 **회사 이해 공백**입니다.\n\n표면 증상은 정형성입니다. **본인의 기여 범위가 가려집니다**.",
  correctability: "교정 가능",
  next_step_recommendation: "Rewrite",
  self_reflection_questions: ["질문 1?", "질문 2?", "질문 3?"],
};

export const FIXTURE_LEAD = {
  name: "테스트 신청자",
  email: "test@example.com",
  submittedAt: "2026-05-05 12:00:00",
  diagnosis: FIXTURE_DIAGNOSIS,
};
```

- [ ] **Step 2: lead.js의 renderEmailHtml을 테스트에서 호출 가능하게 export 추가**

`api/lead.js` 상단의 `function renderEmailHtml(...)`을 `export function renderEmailHtml(...)`로 변경. 다른 어떤 변경도 하지 않는다 (현재 구현 그대로).

- [ ] **Step 3: Golden Master 테스트 작성 (스냅샷 부재 시 자동 생성)**

`tests/email-render.golden.test.js`:

```js
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
```

- [ ] **Step 4: 첫 실행으로 스냅샷 생성**

Run: `npm test`
Expected: 첫 실행은 스냅샷 파일을 만들고 PASS. 콘솔에 `[snapshot created]` 출력.

- [ ] **Step 5: 두 번째 실행으로 스냅샷 비교 동작 검증**

Run: `npm test`
Expected: 모든 테스트 pass. 스냅샷 비교가 통과함.

- [ ] **Step 6: Commit**

```bash
git add api/lead.js tests/email-render.golden.test.js tests/_fixtures/ tests/__snapshots__/email.html
git commit -m "test: add golden master snapshot for renderEmailHtml"
```

---

### Task 4: Migrate api/lead.js to Shared Modules

`api/lead.js`의 라벨/매핑/볼드 로직을 `shared/`에서 import. **출력은 1바이트도 변하지 않아야 한다** — Task 3의 Golden Master로 즉시 검증.

**Files:**
- Modify: `api/lead.js:1-57` (상수 정의 및 render 헬퍼 영역)

- [ ] **Step 1: import 추가 및 로컬 상수 제거**

`api/lead.js` 상단 import 영역을 다음으로 변경:

```js
import { Resend } from "resend";
import {
  PATTERN_LABELS,
  SCORE_KEY_TO_PATTERN,
  NEXT_STEP_LABELS,
} from "../shared/diagnosis-dictionary.js";
import { applyBoldHtml } from "../shared/markdown-bold.js";

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
```

원래 파일에 있던 다음 블록 **삭제** (이제 import로 대체됨):
- `const PATTERN_LABELS = { ... };` (lines 19-25)
- `const SCORE_KEY_TO_PATTERN = { ... };` (lines 27-33)
- `const NEXT_STEP_LABELS = { ... };` (lines 35-39)

- [ ] **Step 2: renderBold/renderParagraphs를 applyBoldHtml로 위임**

원래의 `renderBold`와 `renderParagraphs` 함수를 다음으로 교체:

```js
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
```

> ⚠️ **주의**: `escapeHtml(text)` → `applyBoldHtml(...)` 순서가 반드시 유지되어야 한다 (XSS 방어). 입력은 escape된 상태에서 볼드 마크다운만 풀어야 한다.

- [ ] **Step 3: Golden Master로 출력 동일성 확인**

Run: `npm test`
Expected: 모든 테스트 pass. **`renderEmailHtml: output matches golden snapshot`이 PASS여야 한다.** 만약 FAIL이면 출력이 바뀐 것 — 즉시 롤백 또는 차이 분석.

- [ ] **Step 4: Commit**

```bash
git add api/lead.js
git commit -m "refactor(api/lead): use shared diagnosis dictionary and bold parser"
```

---

### Task 5: Capture JSX Bold Helper Golden Master

`main.jsx`를 손대기 전, 새 헬퍼 `renderMarkdownBold`의 출력을 `react-dom/server`로 스냅샷. 그 다음 main.jsx의 두 함수(`renderWithBold`, `renderWithHighlight`)를 새 헬퍼로 교체해도 출력이 동일해야 함.

**Files:**
- Create: `tests/jsx-render.golden.test.js`
- Create: `src/shared/render-markdown-bold.jsx`
- Create: `tests/__snapshots__/jsx-bold.html` (자동 생성)

- [ ] **Step 1: JSX 헬퍼 작성**

`src/shared/render-markdown-bold.jsx`:

```jsx
import React from "react";
import {
  splitByBold,
  isBoldToken,
  stripBoldDelimiters,
} from "../../shared/markdown-bold.js";

export const BOLD_DEFAULT_CLASS = "font-bold text-neutral-900";
export const BOLD_HIGHLIGHT_CLASS = "font-bold text-neutral-900 bg-yellow-100 px-1";

export function renderMarkdownBold(text, className = BOLD_DEFAULT_CLASS) {
  if (!text) return null;
  return splitByBold(text).map((part, i) =>
    isBoldToken(part) ? (
      <strong key={i} className={className}>
        {stripBoldDelimiters(part)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
```

- [ ] **Step 2: Golden Master 테스트 작성**

`tests/jsx-render.golden.test.js`:

```js
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
```

> ℹ️ Node 22+의 `--experimental-strip-types`나 별도 JSX 빌드 없이 이 테스트가 동작하려면 Node가 `.jsx`를 직접 실행할 수 있어야 함. **만약 실행 불가 시 Step 2-bis로 진행**.

- [ ] **Step 2-bis: (조건부) JSX 변환이 필요할 경우**

`npm test` 실행 시 `.jsx` 파싱 에러가 나면, `vite-node`를 사용하도록 test 스크립트 변경:

```bash
npm install --save-dev vite-node
```

그리고 `package.json`의 test 스크립트를:
```json
"test": "node --test --import vite-node/register tests/"
```
로 변경. 다시 Step 3로.

- [ ] **Step 3: 첫 실행으로 스냅샷 생성**

Run: `npm test`
Expected: 새 스냅샷 자동 생성 + 모든 테스트 pass.

- [ ] **Step 4: 두 번째 실행으로 스냅샷 비교 검증**

Run: `npm test`
Expected: 모든 테스트 pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/render-markdown-bold.jsx tests/jsx-render.golden.test.js tests/__snapshots__/jsx-bold.html
git commit -m "test: add JSX markdown-bold helper with golden snapshot"
```

---

### Task 6: Migrate main.jsx — Patterns and Bold Renderers

`src/diagnosis/main.jsx`의 로컬 정의를 shared import로 교체. JSX 출력은 Golden Master로 보장됨.

**Files:**
- Modify: `src/diagnosis/main.jsx:1-218` (import 영역 + DiagnosisPage 내부 헬퍼)

- [ ] **Step 1: import 추가**

`src/diagnosis/main.jsx` 상단:

```jsx
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  PATTERN_LABELS,
  getPatternIdFromScoreKey,
  getPatternLabel,
} from "../../shared/diagnosis-dictionary.js";
import {
  renderMarkdownBold,
  BOLD_DEFAULT_CLASS,
  BOLD_HIGHLIGHT_CLASS,
} from "../shared/render-markdown-bold.jsx";
import "../index.css";
```

- [ ] **Step 2: 로컬 patternLabels 교체**

원본의 `const patternLabels = { ... };` (line 119 근처)를 다음으로 교체:

```jsx
const patternLabels = {
  pattern_01_generic_template: `Pattern 01 · ${PATTERN_LABELS.pattern_01}`,
  pattern_02_unsupported_claims: `Pattern 02 · ${PATTERN_LABELS.pattern_02}`,
  pattern_03_differentiation_mishandling: `Pattern 03 · ${PATTERN_LABELS.pattern_03}`,
  pattern_04_job_fit_mismatch: `Pattern 04 · ${PATTERN_LABELS.pattern_04}`,
  pattern_05_industry_context_absence: `Pattern 05 · ${PATTERN_LABELS.pattern_05}`,
};
```

> 라벨 본문은 shared에서 가져오되, "Pattern NN · " 표시 접두는 main.jsx에서만 가공한다 (lead.js는 접두를 쓰지 않음).

- [ ] **Step 3: renderWithBold / renderWithHighlight 제거 후 호출부 교체**

원본의 `renderWithBold` (line 190~203)와 `renderWithHighlight` (line 205~218) 함수 정의 **둘 다 삭제**.

호출부 교체:
- `renderWithHighlight(result.root_diagnosis)` → `renderMarkdownBold(result.root_diagnosis, BOLD_HIGHLIGHT_CLASS)`
- `renderWithBold(paragraph, "font-bold text-neutral-900 bg-yellow-100 px-1")` → `renderMarkdownBold(paragraph, BOLD_HIGHLIGHT_CLASS)`

(이 두 호출이 main.jsx 내 유일한 사용처. 검색해서 모두 교체.)

- [ ] **Step 4: score key startsWith 인라인을 shared 헬퍼로 교체**

원본 line 431 근처:

```jsx
// Before
핵심 원인: {patternLabels[Object.keys(patternLabels).find(k => k.startsWith(result.root_cause))]?.split(" · ")[1] || result.root_cause}

// After — getPatternLabel은 short label("규격화된 정형성")을 반환
핵심 원인: {getPatternLabel(result.root_cause)}
```

원본 line 459-460:

```jsx
// Before
const isDominant = key.startsWith(result.dominant_pattern);
const isRoot = key.startsWith(result.root_cause);

// After
const patternId = getPatternIdFromScoreKey(key);
const isDominant = patternId === result.dominant_pattern;
const isRoot = patternId === result.root_cause;
```

- [ ] **Step 5: 단위 테스트 통과 확인**

Run: `npm test`
Expected: 모든 테스트 pass (markdown-bold, dictionary, email Golden Master, JSX Golden Master). main.jsx 변경이 새 헬퍼와 shared 모듈만 사용하므로 기존 스냅샷은 영향 없음.

- [ ] **Step 6: 빌드 검증**

Run: `npm run build`
Expected: 에러 없이 `dist/` 디렉토리에 빌드 성공. shared 모듈이 번들에 포함됨.

- [ ] **Step 7: Commit**

```bash
git add src/diagnosis/main.jsx
git commit -m "refactor(diagnosis): use shared dictionary and unified bold renderer"
```

---

### Task 7: Manual Smoke Test

자동 테스트로 잡지 못하는 시각적 회귀를 사람 눈으로 확인.

**Files:** (없음 — 코드 변경 0)

- [ ] **Step 1: 개발 서버 시작**

Run: `npm run dev`
Expected: Vite가 `http://localhost:5173` (또는 표시된 포트)에서 시작.

- [ ] **Step 2: 진단 페이지 접속 및 데모 확인**

브라우저에서 `http://localhost:5173/diagnosis.html` 열기. 입력 폼이 정상 표시되는지 확인.

- [ ] **Step 3: 결과 화면 시각 확인** (선택)

실제 진단을 돌리거나, 임시로 `setStep("result")`와 `setResult(DEMO_RESULT)`을 주석 해제해 결과 화면을 보고 다음 항목 확인:
- 5개 패턴 점수 막대가 정상 표시되는가
- ROOT/DOMINANT 배지가 올바른 위치에 붙는가 (이전과 동일)
- 근본 진단·종합 진단의 **볼드 강조**가 노란색 배경으로 보이는가
- 핵심 원인 라벨이 "규격화된 정형성" 등으로 표시되는가

- [ ] **Step 4: 개발 서버 종료**

Ctrl+C.

- [ ] **Step 5: (선택) 이메일 발송 회귀 확인**

운영 환경에서만 가능. 배포 전이면 skip. 배포 후 신청 폼으로 1회 진단 신청 → 운영자 메일함에서 이전과 동일한 레이아웃인지 확인.

- [ ] **Step 6: 변경 사항이 없으면 커밋 없음**

(코드 수정 없는 검증 단계)

---

## Self-Review Checklist (작성자 셀프 점검)

- [x] **Spec coverage**: architecture-review의 적용 범위 3건(라벨 / 키 매핑 / 볼드 파서) 모두 Task 1-2-4-6에 매핑됨.
- [x] **Golden Master**: 이메일(Task 3), JSX(Task 5)의 두 스냅샷으로 동작 불변 보증 확보.
- [x] **No new dependencies (default)**: Node 20 내장 `node:test`만 사용. (Task 5 Step 2-bis는 조건부 fallback.)
- [x] **Type/이름 일관성**: `getPatternIdFromScoreKey`, `getPatternLabel`, `applyBoldHtml`, `renderMarkdownBold`, `BOLD_DEFAULT_CLASS`, `BOLD_HIGHLIGHT_CLASS`가 정의 task와 사용 task에서 동일 명칭으로 사용됨.
- [x] **Placeholder 없음**: 모든 step에 실제 코드/명령/예상 출력 포함.
- [x] **주의점 반영**: lead.js의 `escapeHtml → applyBoldHtml` 순서 명시, 라벨 키 체계 차이(`pattern_01` vs `pattern_01_generic_template`)는 main.jsx 측에서 접두 가공.
- [x] **대기 리스트는 손대지 않음**: DiagnosisPage 분해, 폼 제출 hook 추출, 코드펜스 strip 등은 이번 플랜 밖.

---

## Execution Handoff

플랜 저장 위치: `docs/superpowers/plans/2026-05-05-shared-diagnosis-dictionary.md`

두 가지 실행 옵션:

**1. Subagent-Driven (권장)** — 각 Task별로 새 subagent를 디스패치하고 task 사이마다 리뷰. 빠른 반복.
**2. Inline Execution** — 같은 세션에서 task를 순차 실행하면서 체크포인트마다 검토.

어느 쪽으로 진행하시겠어요?
