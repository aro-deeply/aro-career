# DiagnosisPage Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/diagnosis/main.jsx`의 단일 거대 컴포넌트(680+ 라인의 `DiagnosisPage`)를 step별·section별 작은 컴포넌트로 분해. 임박한 디자인 전면 개편이 컴포넌트 단위로 진행되도록 준비. 동작 변경 0, 단순 분해.

**Architecture:** "Lift state up" 패턴. `DiagnosisPage`는 컨테이너로서 모든 step 전이 상태(`step`, `formData`, `result`, `error`, `consent`, `turnstileToken`)를 보유하고, 자식 컴포넌트들은 props로 값과 콜백을 받는 controlled component. `LoadingStep`과 `ConsultRequestForm`은 자기 화면 안에서만 의미 있는 로컬 상태(`loadingProgress`, 상담 폼 입력값)를 자체 보유. Result 페이지는 `ResultStep` 래퍼로 먼저 추출 후, 6개 섹션 컴포넌트로 차례차례 분해. 각 섹션 추출은 Golden Master(react-dom/server `renderToString`)로 출력 byte-identical 보증.

**Tech Stack:** React 18, Vite 5, framer-motion, Tailwind CSS, react-dom/server, node:test + tsx (이미 셋업됨).

---

## File Structure

**Create:**
- `src/diagnosis/demo-result.js` — `DEMO_RESULT` 객체 (현재 main.jsx 상단의 데모 데이터)
- `src/diagnosis/ConsultRequestForm.jsx` — 상담 신청 폼 (현재 main.jsx 하단의 함수 컴포넌트, 그대로 이전)
- `src/diagnosis/LoadingStep.jsx` — 로딩 화면 (자체 progress 상태)
- `src/diagnosis/InputStep.jsx` — 입력 폼 (props 기반 controlled component, turnstile 마운트는 여기서)
- `src/diagnosis/ResultStep.jsx` — 결과 화면 래퍼 (초기에는 6 섹션 인라인, Tasks 7-12에서 추출)
- `src/diagnosis/DiagnosisPage.jsx` — 컨테이너 (state + 핸들러)
- `src/diagnosis/sections/PatternScoreList.jsx` — 5 패턴 점수 막대
- `src/diagnosis/sections/RootDiagnosisCard.jsx` — 근본 진단 카드
- `src/diagnosis/sections/EvidenceList.jsx` — 인용 근거 카드 목록
- `src/diagnosis/sections/OnePagerSummary.jsx` — 종합 진단 paragraphs
- `src/diagnosis/sections/ReflectionQuestions.jsx` — 자가 성찰 질문 목록
- `src/diagnosis/sections/ResultCTA.jsx` — 다음 단계 CTA
- `tests/result-step.golden.test.jsx` — ResultStep의 Golden Master 테스트
- `tests/__snapshots__/result-step.html` — 자동 생성 스냅샷

**Modify:**
- `src/diagnosis/main.jsx` — 약 700줄 → 약 10줄. `createRoot(...).render(<DiagnosisPage />)`만 남김
- `tests/_fixtures/diagnosis-fixture.js` — Golden Master에서 사용할 결과 페이지 fixture 추가 (선택, 기존 FIXTURE_DIAGNOSIS 재사용 가능)

**Do not modify:**
- `api/diagnose.js`, `api/lead.js`, `shared/*`, `src/shared/*` — 이번 라운드 무관
- 기존 19개 테스트 — 모두 통과 유지

---

## Pre-flight: Working Directory & Branch

```bash
cd projects/aro-career
git status  # → branch refactor/diagnosis-page-decomposition (이미 생성됨)
npm test    # → 19 tests pass (baseline)
```

---

### Task 1: Extract DEMO_RESULT to its own file

`DEMO_RESULT`는 단순 const 데이터. 가장 안전한 첫 분리 작업.

**Files:**
- Create: `src/diagnosis/demo-result.js`
- Modify: `src/diagnosis/main.jsx` (DEMO_RESULT 정의 제거 + import 추가)

- [ ] **Step 1: demo-result.js 생성**

`src/diagnosis/demo-result.js`:
- 현재 `src/diagnosis/main.jsx`의 라인 9-48 (`const DEMO_RESULT = { ... };` 블록 전체)을 그대로 복사
- 파일 상단에 주석 1줄 또는 없음(주석 미장려)
- `export const DEMO_RESULT = { ... }`로 변경

- [ ] **Step 2: main.jsx 정리**

`src/diagnosis/main.jsx`에서:
- 라인 6-8의 `// ===` 구분 주석과 라인 9-48의 `const DEMO_RESULT = { ... };` 블록 모두 제거
- import 영역에 추가: `import { DEMO_RESULT } from "./demo-result.js";`
- 다른 곳에서 `DEMO_RESULT` 참조가 있는지 확인 (현재 코드는 참조 없음 — 데모 모드는 미사용 — 그래도 사용처 grep으로 확인)

- [ ] **Step 3: 검증**

```bash
npm test
npm run build
grep -n "DEMO_RESULT" src/diagnosis/main.jsx
```

Expected:
- 19 tests pass
- Build succeeds
- main.jsx의 grep 결과는 import 라인 1건만 (다른 사용처 0)

- [ ] **Step 4: Commit**

```bash
git add src/diagnosis/demo-result.js src/diagnosis/main.jsx
git commit -m "refactor(diagnosis): extract DEMO_RESULT to its own module"
```

---

### Task 2: Extract ConsultRequestForm to its own file

ConsultRequestForm은 이미 main.jsx 안에서 별개 함수 컴포넌트로 정의되어 있음 (라인 609-699 근처). 파일만 분리.

**Files:**
- Create: `src/diagnosis/ConsultRequestForm.jsx`
- Modify: `src/diagnosis/main.jsx`

- [ ] **Step 1: ConsultRequestForm.jsx 생성**

`src/diagnosis/ConsultRequestForm.jsx`:

```jsx
import React from "react";

export default function ConsultRequestForm({ result }) {
  // ... 현재 main.jsx의 ConsultRequestForm 함수 본문을 그대로 복사
}
```

- 함수 본문(`function ConsultRequestForm({ result }) { ... }`의 안쪽)은 한 글자도 바꾸지 않음
- import: `React` 한 줄만 필요 (React.useState 사용)

- [ ] **Step 2: main.jsx에서 ConsultRequestForm 제거**

- main.jsx 하단의 `function ConsultRequestForm({ result }) { ... }` 정의 전체 삭제
- main.jsx 상단의 import 영역에 추가: `import ConsultRequestForm from "./ConsultRequestForm.jsx";`
- ConsultRequestForm 사용처(`<ConsultRequestForm result={result} />`)는 변경 불필요 (기존 호출 그대로 동작)

- [ ] **Step 3: 검증**

```bash
npm test
npm run build
grep -n "function ConsultRequestForm" src/diagnosis/main.jsx
```

Expected:
- 19 tests pass
- Build succeeds
- 함수 정의 grep 0건

- [ ] **Step 4: Commit**

```bash
git add src/diagnosis/ConsultRequestForm.jsx src/diagnosis/main.jsx
git commit -m "refactor(diagnosis): extract ConsultRequestForm to its own component"
```

---

### Task 3: Extract LoadingStep

LoadingStep은 자체 `loadingProgress` 상태와 useEffect를 가짐. 부모로부터 props 0개 받음 (마운트 시점부터 진행률 계산 시작).

**Files:**
- Create: `src/diagnosis/LoadingStep.jsx`
- Modify: `src/diagnosis/main.jsx`

- [ ] **Step 1: LoadingStep.jsx 생성**

`src/diagnosis/LoadingStep.jsx`:

```jsx
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

export default function LoadingStep() {
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const expectedMs = 30000;
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const pct = 95 * (1 - Math.exp(-elapsed / expectedMs));
      setLoadingProgress(pct);
    }, 250);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="py-32 text-center"
    >
      {/* main.jsx의 step === "loading" 블록 안의 JSX를 그대로 이 안에 복사 */}
    </motion.div>
  );
}
```

> 주의: 현재 main.jsx의 useEffect는 `step !== "loading"` 분기에서 `setLoadingProgress(0)` 처리를 하지만, LoadingStep이 step="loading"일 때만 마운트되므로 그 분기 자체가 불필요. 위 코드처럼 단순화.

JSX 본문은 main.jsx의 라인 363~412 근처(`{step === "loading" && (` 안의 motion.div) 내용을 그대로 옮김.

- [ ] **Step 2: main.jsx 정리**

- 상단 import: `import LoadingStep from "./LoadingStep.jsx";`
- DiagnosisPage 내부의 `loadingProgress` state, 그 useEffect 블록(현재 라인 65~84) 삭제
- AnimatePresence 안의 `{step === "loading" && (...)}` 블록을 다음으로 교체:

```jsx
{step === "loading" && <LoadingStep key="loading" />}
```

- [ ] **Step 3: 검증**

```bash
npm test
npm run build
grep -n "loadingProgress" src/diagnosis/main.jsx
```

Expected:
- 19 tests pass
- Build succeeds
- main.jsx에 `loadingProgress` 참조 0건

- [ ] **Step 4: Commit**

```bash
git add src/diagnosis/LoadingStep.jsx src/diagnosis/main.jsx
git commit -m "refactor(diagnosis): extract LoadingStep with self-contained progress"
```

---

### Task 4: Extract InputStep

InputStep은 입력 폼 + Turnstile 마운트. Controlled component — 부모(DiagnosisPage)로부터 state와 setter를 props로 받음.

**Files:**
- Create: `src/diagnosis/InputStep.jsx`
- Modify: `src/diagnosis/main.jsx`

- [ ] **Step 1: InputStep.jsx 생성**

`src/diagnosis/InputStep.jsx`:

```jsx
import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const SITUATIONS = [
  "신입 취업",
  "동종업계 이직",
  "경력 전환",
  "업종 변경",
  "경력 단절 재취업",
  "팀장·임원급 설계",
];

export default function InputStep({
  formData,
  setFormData,
  consent,
  setConsent,
  turnstileToken,
  setTurnstileToken,
  error,
  onSubmit,
}) {
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    function tryMount() {
      if (cancelled) return;
      if (window.turnstile && turnstileRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: "0x4AAAAAADFpsfyi_rcbyT0P",
          callback: (token) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(null),
          "error-callback": () => setTurnstileToken(null),
        });
      } else {
        setTimeout(tryMount, 200);
      }
    }
    tryMount();
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch (e) {}
      }
    };
  }, [setTurnstileToken]);

  return (
    <motion.div
      key="input"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4 }}
    >
      {/* 현재 main.jsx의 step === "input" 블록 내용 전체를 옮김 */}
      {/* situations.map → SITUATIONS.map 으로 변경 (모듈 상수 사용) */}
    </motion.div>
  );
}
```

- main.jsx의 `step === "input" && (...)` 블록 (라인 238~361 근처)의 JSX 내용을 그대로 옮김
- 다음 변경 적용:
  - `formData.jobTarget` 등 → 그대로 (props로 받은 formData 사용)
  - `setFormData(...)` 호출 → 그대로 (props 콜백 사용)
  - `consent`, `setConsent` → 그대로 (props 사용)
  - `error` 표시 → 그대로 (props로 받음)
  - `setError(null)` 같은 부모 상태 직접 변경 불가 → 제거. 검증과 setError는 부모의 onSubmit 안에서 처리
  - "진단 시작" 버튼: `onClick={runDiagnosis}` → `onClick={onSubmit}`
  - `disabled={!consent || !turnstileToken}` → 그대로 (props로 받음)
  - `situations` 로컬 변수 → 모듈 상수 `SITUATIONS` 사용

- [ ] **Step 2: main.jsx 정리**

- 상단 import: `import InputStep from "./InputStep.jsx";`
- DiagnosisPage 내부에서 제거:
  - `turnstileRef`, `widgetIdRef` ref 선언 (LoadingStep 추출하면서 이미 정리됐을 수 있음 — 한 번 더 확인)
  - turnstile 마운트 useEffect (현재 라인 86~108)
  - 로컬 `situations` 배열 (라인 110~117)
- `runDiagnosis` 함수는 DiagnosisPage에 그대로 유지 (state 접근 필요)
- AnimatePresence 안의 `{step === "input" && (...)}` 블록을 다음으로 교체:

```jsx
{step === "input" && (
  <InputStep
    key="input"
    formData={formData}
    setFormData={setFormData}
    consent={consent}
    setConsent={setConsent}
    turnstileToken={turnstileToken}
    setTurnstileToken={setTurnstileToken}
    error={error}
    onSubmit={runDiagnosis}
  />
)}
```

- [ ] **Step 3: 검증**

```bash
npm test
npm run build
grep -n "turnstile.render" src/diagnosis/main.jsx
```

Expected:
- 19 tests pass
- Build succeeds
- main.jsx에서 turnstile 마운트 코드 0건

- [ ] **Step 4: 수동 스모크 (조건부)**

브라우저에서 `npm run dev` → `/diagnosis.html` 입력 폼 정상 표시, Turnstile 위젯 정상 로드 확인. AbortError 등 콘솔 에러 0건. 5초 안에 끝남.

- [ ] **Step 5: Commit**

```bash
git add src/diagnosis/InputStep.jsx src/diagnosis/main.jsx
git commit -m "refactor(diagnosis): extract InputStep with turnstile mount"
```

---

### Task 5: Extract ResultStep wrapper

ResultStep은 결과 화면의 6개 섹션을 포함하는 래퍼. 이 단계에서는 6 섹션을 모두 인라인 JSX로 둠 — 분해는 Tasks 7-12에서.

**Files:**
- Create: `src/diagnosis/ResultStep.jsx`
- Modify: `src/diagnosis/main.jsx`

- [ ] **Step 1: ResultStep.jsx 생성**

`src/diagnosis/ResultStep.jsx`:

```jsx
import React from "react";
import { motion } from "framer-motion";
import {
  PATTERN_LABELS,
  getPatternIdFromScoreKey,
  getPatternLabel,
} from "../../shared/diagnosis-dictionary.js";
import {
  renderMarkdownBold,
  BOLD_HIGHLIGHT_CLASS,
} from "../shared/render-markdown-bold.jsx";
import ConsultRequestForm from "./ConsultRequestForm.jsx";

const PATTERN_LABELS_DISPLAY = {
  pattern_01_generic_template: `Pattern 01 · ${PATTERN_LABELS.pattern_01}`,
  pattern_02_unsupported_claims: `Pattern 02 · ${PATTERN_LABELS.pattern_02}`,
  pattern_03_differentiation_mishandling: `Pattern 03 · ${PATTERN_LABELS.pattern_03}`,
  pattern_04_job_fit_mismatch: `Pattern 04 · ${PATTERN_LABELS.pattern_04}`,
  pattern_05_industry_context_absence: `Pattern 05 · ${PATTERN_LABELS.pattern_05}`,
};

export default function ResultStep({ result, onReset }) {
  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-16"
    >
      {/* main.jsx의 step === "result" && result && (...) 블록 안 motion.div 내용을 그대로 이전 */}
      {/* patternLabels → PATTERN_LABELS_DISPLAY 로 이름 변경 (외부 PATTERN_LABELS와 충돌 회피) */}
      {/* resetForm() 호출 → onReset() 로 변경 */}
    </motion.div>
  );
}
```

JSX 본문은 main.jsx의 `{step === "result" && result && (...)}` 블록의 motion.div 내부(라인 414~596 근처) 전체를 그대로 옮김.

다음 치환 적용:
- 모든 `patternLabels[...]` 참조 → `PATTERN_LABELS_DISPLAY[...]`
- "다시 진단하기" 버튼의 `onClick={resetForm}` → `onClick={onReset}`
- `<ConsultRequestForm result={result} />`는 그대로

- [ ] **Step 2: main.jsx 정리**

- 상단 import에서 제거 가능: `PATTERN_LABELS`, `getPatternIdFromScoreKey`, `getPatternLabel`, `renderMarkdownBold`, `BOLD_HIGHLIGHT_CLASS`, `ConsultRequestForm`, framer-motion의 motion (단, AnimatePresence는 유지)
- DiagnosisPage 내부의 로컬 `patternLabels` 객체 정의 제거
- AnimatePresence 안의 `{step === "result" && result && (...)}` 블록을 다음으로 교체:

```jsx
{step === "result" && result && (
  <ResultStep key="result" result={result} onReset={resetForm} />
)}
```

- 상단에 import 추가: `import ResultStep from "./ResultStep.jsx";`

- [ ] **Step 3: 검증**

```bash
npm test
npm run build
grep -n "patternLabels" src/diagnosis/main.jsx
```

Expected:
- 19 tests pass
- Build succeeds
- main.jsx에 `patternLabels` 0건

- [ ] **Step 4: Commit**

```bash
git add src/diagnosis/ResultStep.jsx src/diagnosis/main.jsx
git commit -m "refactor(diagnosis): extract ResultStep wrapper"
```

---

### Task 6: Capture Golden Master for ResultStep

이제 ResultStep이 단독 컴포넌트가 됐으니 출력 스냅샷을 떠서 Tasks 7-12 섹션 추출의 안전망을 구축.

**Files:**
- Create: `tests/result-step.golden.test.jsx`
- Auto-generated: `tests/__snapshots__/result-step.html`

- [ ] **Step 1: Golden Master 테스트 작성**

`tests/result-step.golden.test.jsx`:

```jsx
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
```

- [ ] **Step 2: 첫 실행으로 스냅샷 생성**

```bash
npm test
```

Expected:
- 20 tests total (19 + 1 new)
- 새 스냅샷 자동 생성: `tests/__snapshots__/result-step.html`
- 콘솔에 `[snapshot created]`

- [ ] **Step 3: 두 번째 실행으로 스냅샷 비교 검증**

```bash
npm test
```

Expected: 20 tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/result-step.golden.test.jsx tests/__snapshots__/result-step.html
git commit -m "test: add golden master snapshot for ResultStep"
```

---

### Task 7: Extract PatternScoreList section

5 패턴 점수 막대 영역. ResultStep의 첫 섹션.

**Files:**
- Create: `src/diagnosis/sections/PatternScoreList.jsx`
- Modify: `src/diagnosis/ResultStep.jsx`

- [ ] **Step 1: PatternScoreList.jsx 생성**

`src/diagnosis/sections/PatternScoreList.jsx`:

```jsx
import React from "react";
import { motion } from "framer-motion";
import {
  PATTERN_LABELS,
  getPatternIdFromScoreKey,
} from "../../../shared/diagnosis-dictionary.js";

const PATTERN_LABELS_DISPLAY = {
  pattern_01_generic_template: `Pattern 01 · ${PATTERN_LABELS.pattern_01}`,
  pattern_02_unsupported_claims: `Pattern 02 · ${PATTERN_LABELS.pattern_02}`,
  pattern_03_differentiation_mishandling: `Pattern 03 · ${PATTERN_LABELS.pattern_03}`,
  pattern_04_job_fit_mismatch: `Pattern 04 · ${PATTERN_LABELS.pattern_04}`,
  pattern_05_industry_context_absence: `Pattern 05 · ${PATTERN_LABELS.pattern_05}`,
};

export default function PatternScoreList({ patternScores, dominantPattern, rootCause }) {
  return (
    <section>
      <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-8">
        01 · 5개 패턴 진단 점수
      </div>
      <div className="space-y-5">
        {Object.entries(patternScores).map(([key, score]) => {
          const patternId = getPatternIdFromScoreKey(key);
          const isDominant = patternId === dominantPattern;
          const isRoot = patternId === rootCause;
          return (
            <div key={key}>
              <div className="flex justify-between items-baseline mb-2.5">
                <div className="text-sm md:text-base text-neutral-900 font-semibold flex items-center gap-2 flex-wrap">
                  {PATTERN_LABELS_DISPLAY[key]}
                  {isRoot && <span className="text-[9px] tracking-widest font-bold bg-neutral-900 text-white px-2 py-0.5">ROOT</span>}
                  {isDominant && !isRoot && <span className="text-[9px] tracking-widest font-bold border border-neutral-900 text-neutral-900 px-2 py-0.5">DOMINANT</span>}
                </div>
                <div className="text-sm text-neutral-600 tabular-nums font-medium">
                  {(score * 100).toFixed(0)}
                </div>
              </div>
              <div className="h-1.5 bg-neutral-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${score * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className={`h-full ${score > 0.7 ? "bg-neutral-900" : score > 0.4 ? "bg-neutral-600" : "bg-neutral-400"}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: ResultStep.jsx 정리**

- 상단 import: `import PatternScoreList from "./sections/PatternScoreList.jsx";`
- ResultStep 내부에서 `<section>...01 · 5개 패턴 진단 점수...</section>` 블록을 다음으로 교체:

```jsx
<PatternScoreList
  patternScores={result.pattern_scores}
  dominantPattern={result.dominant_pattern}
  rootCause={result.root_cause}
/>
```

- ResultStep에서 더 이상 쓰이지 않는 import 정리 (`getPatternIdFromScoreKey`가 ResultStep 안에서 다른 곳에 쓰이지 않으면 import 삭제)

- [ ] **Step 3: Golden Master 검증**

```bash
npm test
```

Expected: 20 tests pass. **`ResultStep: output matches golden snapshot`이 PASS여야 한다.** 만약 FAIL이면 출력이 바뀐 것 — 스냅샷 비교 결과 살펴서 클래스명/공백/순서 차이 찾아 고침. **스냅샷을 절대 갱신하지 말 것** (이번 라운드의 안전 보증).

- [ ] **Step 4: Commit**

```bash
git add src/diagnosis/sections/PatternScoreList.jsx src/diagnosis/ResultStep.jsx
git commit -m "refactor(diagnosis): extract PatternScoreList section"
```

---

### Task 8: Extract RootDiagnosisCard section

근본 진단 카드. 02 섹션.

**Files:**
- Create: `src/diagnosis/sections/RootDiagnosisCard.jsx`
- Modify: `src/diagnosis/ResultStep.jsx`

- [ ] **Step 1: RootDiagnosisCard.jsx 생성**

```jsx
import React from "react";
import {
  renderMarkdownBold,
  BOLD_HIGHLIGHT_CLASS,
} from "../../shared/render-markdown-bold.jsx";

export default function RootDiagnosisCard({ rootDiagnosis }) {
  return (
    <section>
      <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-6">
        02 · 근본 진단
      </div>
      <div className="bg-neutral-50 border-l-4 border-neutral-900 px-7 py-7">
        <p className="text-lg md:text-xl text-neutral-800 leading-[1.8]">
          {renderMarkdownBold(rootDiagnosis, BOLD_HIGHLIGHT_CLASS)}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: ResultStep.jsx 정리**

- import: `import RootDiagnosisCard from "./sections/RootDiagnosisCard.jsx";`
- 02 섹션 블록을 `<RootDiagnosisCard rootDiagnosis={result.root_diagnosis} />`로 교체

- [ ] **Step 3: 검증**

```bash
npm test
```

Expected: 20 tests pass, ResultStep snapshot 일치.

- [ ] **Step 4: Commit**

```bash
git add src/diagnosis/sections/RootDiagnosisCard.jsx src/diagnosis/ResultStep.jsx
git commit -m "refactor(diagnosis): extract RootDiagnosisCard section"
```

---

### Task 9: Extract EvidenceList section

원문 근거 카드 목록. 03 섹션.

**Files:**
- Create: `src/diagnosis/sections/EvidenceList.jsx`
- Modify: `src/diagnosis/ResultStep.jsx`

- [ ] **Step 1: EvidenceList.jsx 생성**

```jsx
import React from "react";

export default function EvidenceList({ evidence }) {
  return (
    <section>
      <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-8">
        03 · 원문 근거
      </div>
      <div className="space-y-4">
        {evidence.map((e, i) => (
          <div key={i} className="bg-white border border-neutral-200 p-6 md:p-7">
            <div className="text-[10px] tracking-[0.15em] text-neutral-500 font-semibold mb-4 uppercase">
              #{String(i + 1).padStart(2, "0")} · {e.signal}
            </div>
            <blockquote className="text-base md:text-lg text-neutral-900 mb-5 pl-4 border-l-2 border-neutral-400 leading-relaxed font-medium">
              "{e.quote}"
            </blockquote>
            <p className="text-sm md:text-base text-neutral-700 leading-relaxed">
              {e.why}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: ResultStep.jsx 정리**

- import + 03 섹션 블록 교체: `<EvidenceList evidence={result.evidence} />`

- [ ] **Step 3: 검증** (`npm test` — 20 tests, snapshot 일치)

- [ ] **Step 4: Commit**

```bash
git add src/diagnosis/sections/EvidenceList.jsx src/diagnosis/ResultStep.jsx
git commit -m "refactor(diagnosis): extract EvidenceList section"
```

---

### Task 10: Extract OnePagerSummary section

종합 진단 단락 영역. 04 섹션.

**Files:**
- Create: `src/diagnosis/sections/OnePagerSummary.jsx`
- Modify: `src/diagnosis/ResultStep.jsx`

- [ ] **Step 1: OnePagerSummary.jsx 생성**

```jsx
import React from "react";
import {
  renderMarkdownBold,
  BOLD_HIGHLIGHT_CLASS,
} from "../../shared/render-markdown-bold.jsx";

export default function OnePagerSummary({ summary }) {
  return (
    <section>
      <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-6">
        04 · 종합 진단
      </div>
      <div className="bg-stone-50 border border-stone-200 p-8 md:p-12">
        <div className="space-y-6">
          {summary
            .split(/\n\n+/)
            .filter((p) => p.trim())
            .map((paragraph, idx) => (
              <p
                key={idx}
                className="text-base md:text-[17px] text-neutral-800 leading-[1.95]"
              >
                {idx === 0 && (
                  <span className="inline-block w-8 h-8 bg-neutral-900 text-white text-xs font-bold text-center leading-8 mr-3 -mt-1 align-middle tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                )}
                {idx > 0 && (
                  <span className="inline-block w-8 h-8 border-2 border-neutral-900 text-neutral-900 text-xs font-bold text-center leading-[28px] mr-3 -mt-1 align-middle tabular-nums">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                )}
                {renderMarkdownBold(paragraph, BOLD_HIGHLIGHT_CLASS)}
              </p>
            ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: ResultStep.jsx 정리**

- import + 04 섹션 블록 교체: `<OnePagerSummary summary={result.one_pager_summary} />`

- [ ] **Step 3: 검증** (`npm test` — 20 tests, snapshot 일치)

- [ ] **Step 4: Commit**

```bash
git add src/diagnosis/sections/OnePagerSummary.jsx src/diagnosis/ResultStep.jsx
git commit -m "refactor(diagnosis): extract OnePagerSummary section"
```

---

### Task 11: Extract ReflectionQuestions section

자가 성찰 질문 목록. 05 섹션.

**Files:**
- Create: `src/diagnosis/sections/ReflectionQuestions.jsx`
- Modify: `src/diagnosis/ResultStep.jsx`

- [ ] **Step 1: ReflectionQuestions.jsx 생성**

```jsx
import React from "react";

export default function ReflectionQuestions({ questions }) {
  return (
    <section>
      <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-8">
        05 · 다음 상담 전 자가 성찰 질문
      </div>
      <div className="space-y-6">
        {questions.map((q, i) => (
          <div key={i} className="flex gap-5 items-start">
            <div className="text-3xl font-bold text-neutral-300 leading-none tabular-nums flex-shrink-0">
              {String(i + 1).padStart(2, "0")}
            </div>
            <p className="text-base md:text-lg text-neutral-900 leading-relaxed pt-1 font-medium">
              {q}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: ResultStep.jsx 정리**

- import + 05 섹션 블록 교체: `<ReflectionQuestions questions={result.self_reflection_questions} />`

- [ ] **Step 3: 검증** (`npm test` — 20 tests, snapshot 일치)

- [ ] **Step 4: Commit**

```bash
git add src/diagnosis/sections/ReflectionQuestions.jsx src/diagnosis/ResultStep.jsx
git commit -m "refactor(diagnosis): extract ReflectionQuestions section"
```

---

### Task 12: Extract ResultCTA section

다음 단계 CTA (30분 사전 진단 신청 / 다시 진단하기 버튼).

**Files:**
- Create: `src/diagnosis/sections/ResultCTA.jsx`
- Modify: `src/diagnosis/ResultStep.jsx`

- [ ] **Step 1: ResultCTA.jsx 생성**

```jsx
import React from "react";

export default function ResultCTA({ onReset }) {
  return (
    <section className="border-t border-neutral-200 pt-10 mt-16">
      <div className="text-[11px] tracking-[0.2em] text-neutral-500 font-semibold mb-4">
        다음 단계
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 leading-tight tracking-tight mb-5">
        이제 실제 교정으로 넘어가십시오.
      </h2>
      <p className="text-neutral-600 leading-relaxed mb-8 max-w-2xl text-base md:text-lg">
        본 진단은 자동 생성된 1차 분석입니다. 30분 1:1 사전 진단에서는 본인의 실제 경험과 상황에 맞춘 심화 분석이 이어집니다. 본 상담 전환은 전제되지 않습니다.
      </p>
      <div className="flex flex-col md:flex-row gap-3">
        <a
          href="index.html#final"
          className="bg-neutral-900 hover:bg-black text-white px-8 py-4 text-sm font-semibold tracking-[0.15em] text-center transition-colors"
        >
          30분 무료 사전 진단 신청 →
        </a>
        <button
          onClick={onReset}
          className="border border-neutral-300 hover:border-neutral-900 text-neutral-700 hover:text-neutral-900 px-8 py-4 text-sm font-semibold tracking-[0.15em] transition-colors"
        >
          다시 진단하기
        </button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: ResultStep.jsx 정리**

- import + "다음 단계" 섹션 블록 교체: `<ResultCTA onReset={onReset} />`

이 시점에서 ResultStep.jsx는 6개 컴포넌트 import + 짧은 헤더 div + 6개 컴포넌트 호출 + ConsultRequestForm 호출로 구성된 짧은 파일이 되어야 함 (약 50줄 이하).

- [ ] **Step 3: 검증** (`npm test` — 20 tests, snapshot 일치. **`PATTERN_LABELS_DISPLAY` 등 ResultStep에서 더 이상 쓰이지 않는 const는 정리**.)

- [ ] **Step 4: Commit**

```bash
git add src/diagnosis/sections/ResultCTA.jsx src/diagnosis/ResultStep.jsx
git commit -m "refactor(diagnosis): extract ResultCTA section"
```

---

### Task 13: Move DiagnosisPage to its own file; slim main.jsx

마지막 정리. DiagnosisPage를 자체 파일로, main.jsx는 entry-point만.

**Files:**
- Create: `src/diagnosis/DiagnosisPage.jsx`
- Modify: `src/diagnosis/main.jsx`

- [ ] **Step 1: DiagnosisPage.jsx 생성**

`src/diagnosis/DiagnosisPage.jsx`:

```jsx
import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import InputStep from "./InputStep.jsx";
import LoadingStep from "./LoadingStep.jsx";
import ResultStep from "./ResultStep.jsx";

const FONT_STACK =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';

export default function DiagnosisPage() {
  // ... 현재 main.jsx의 DiagnosisPage 함수 본문 그대로 이전
  // ... runDiagnosis, resetForm 등 핸들러 포함
  // ... return JSX는 header + main(AnimatePresence + 3 step) + footer 구조 유지
}
```

main.jsx의 DiagnosisPage 함수 본문 전체를 그대로 옮긴다. 이제 main.jsx는 createRoot 호출만 남는다.

- [ ] **Step 2: main.jsx 슬림화**

`src/diagnosis/main.jsx` 전체:

```jsx
import { createRoot } from "react-dom/client";
import DiagnosisPage from "./DiagnosisPage.jsx";
import "../index.css";

createRoot(document.getElementById("root")).render(<DiagnosisPage />);
```

이 4줄만 남아야 한다. import 문과 mount 호출 외의 모든 것은 다른 파일로 이전됨.

- [ ] **Step 3: 검증**

```bash
npm test
npm run build
wc -l src/diagnosis/main.jsx
wc -l src/diagnosis/DiagnosisPage.jsx
wc -l src/diagnosis/ResultStep.jsx
```

Expected:
- 20 tests pass
- Build succeeds
- main.jsx ≤ 10줄
- DiagnosisPage.jsx 100~200줄 (state + 핸들러 + 짧은 layout JSX)
- ResultStep.jsx ≤ 50줄

- [ ] **Step 4: Commit**

```bash
git add src/diagnosis/DiagnosisPage.jsx src/diagnosis/main.jsx
git commit -m "refactor(diagnosis): move DiagnosisPage to own file; main.jsx becomes thin entry"
```

---

### Task 14: Manual smoke test

**Files:** (없음)

- [ ] **Step 1: dev 서버 시작**

```bash
npm run dev
```

- [ ] **Step 2: 진단 페이지 정상 동작 확인**

브라우저에서 표시된 URL `+ /diagnosis.html` 접속.

확인:
- 입력 화면 정상 표시
- 입력 폼 onChange 동작 (각 필드 입력 가능)
- 6개 상황 버튼 선택 가능
- 텍스트영역 글자수 카운터 동작
- 동의 체크박스 동작
- Turnstile 위젯 정상 로드 및 토큰 수령
- "진단 시작" 버튼 비활성/활성 전환 (consent + turnstile)

- [ ] **Step 3: 실제 진단 1회 (선택, 로컬에 ANTHROPIC_API_KEY가 있을 때)**

진단 실행 후:
- 로딩 화면 진행률 막대 95%까지 부드럽게 차오름
- 결과 화면 5개 패턴 점수 막대 + ROOT/DOMINANT 배지 표시
- 근본 진단 노란 강조 텍스트
- 인용 근거 카드들
- 종합 진단 단락 (번호 매겨짐)
- 자가 성찰 질문
- "30분 무료 사전 진단 신청" / "다시 진단하기" 버튼
- "전문가 상담 신청" 폼 정상 표시
- "다시 진단하기" 클릭 시 입력 화면으로 복귀, 폼 초기화

- [ ] **Step 4: dev 서버 종료**

Ctrl+C.

---

## Self-Review Checklist (작성자 셀프 점검)

- [x] **Spec coverage**: 분해 대상 모두 task에 포함 (3 step + 6 section + ConsultRequestForm + DEMO_RESULT + DiagnosisPage 자체).
- [x] **Golden Master**: Task 6에서 ResultStep 단계 직후 도입, Tasks 7-12 안전망. (입력/로딩 화면은 Golden Master 없음 — 수동 스모크가 안전망.)
- [x] **State organization**: DiagnosisPage가 컨테이너로 모든 step 전이 상태 보유. LoadingStep과 ConsultRequestForm은 자기 화면 내 로컬 상태만. Lift state up 패턴.
- [x] **No new dependencies**: 추가 패키지 0. 기존 react-dom/server, tsx, node:test 그대로 사용.
- [x] **Type/이름 일관성**: 모든 컴포넌트 PascalCase, props는 camelCase. `result.pattern_scores` 등 진단 JSON 필드는 그대로 (원본 데이터 형식 유지).
- [x] **Placeholder 없음**: 각 task에 코드 블록과 정확한 명령 포함.
- [x] **Out of scope**: api/* 변경 없음. shared/* 변경 없음. 동작 변경 0 (디자인 변경은 다음 라운드).
- [x] **이번 라운드 위험 식별**:
  - InputStep의 turnstile 마운트 로직이 자식 컴포넌트로 이동 — useRef + useEffect 동작이 라이프사이클 변화에 영향받을 수 있음. Step 4 수동 스모크로 검증.
  - ResultStep의 Golden Master는 framer-motion의 `motion.div` 서버 렌더링 동작에 의존. tsx + react-dom/server가 motion을 어떻게 직렬화하는지 첫 실행 결과 확인 필요.

---

## Execution Handoff

플랜 저장 위치: `docs/superpowers/plans/2026-05-05-diagnosis-page-decomposition.md`

두 가지 실행 옵션:

**1. Subagent-Driven (권장)** — 각 Task별로 새 subagent 디스패치, task 사이마다 spec + quality 리뷰. 빠른 반복.
**2. Inline Execution** — 같은 세션에서 task를 순차 실행하면서 체크포인트마다 검토.

이전 라운드와 동일하게 Subagent-Driven으로 진행하는 것을 추천.
