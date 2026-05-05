# Intent Review — 2026-05-05

## 요약

- 스캔: 3개 파일 (`api/diagnose.js`, `api/lead.js`, `src/diagnosis/main.jsx`), 약 18개 함수/컴포넌트
- 후보: 7건 (high 4 / medium 2 / low 1)
- 최대 이슈: **마크다운 볼드 파싱(`**...**` → strong)이 4곳에 각각 인라인 구현되어 있음** — 진단 결과 텍스트 강조라는 단일 도메인 규칙이 분산됨

---

## 🔴 High Priority

### 1. `renderWithBold()` / `renderWithHighlight()` — ⭐⭐⭐ — `src/diagnosis/main.jsx:190, 205`

**실제 책임**: 동일한 정규식(`/(\*\*[^*]+\*\*)/g`)으로 텍스트를 split → strong 노드로 매핑. 차이는 `<strong>` 의 `className`뿐.

**문제**: 두 함수가 본질적으로 같은 일을 하면서 별도 정의되어 있음. 04 종합 진단 섹션(line 543)에서는 `renderWithBold(paragraph, "font-bold ... bg-yellow-100 px-1")`로 호출해 사실상 highlight 동작을 재현하고 있어, 두 함수의 경계가 흐려진 상태.

**추출 제안**:

```jsx
// Before — 두 함수로 분리, 차이는 className뿐
function renderWithBold(text, boldClass = "font-bold text-neutral-900") { ... }
function renderWithHighlight(text) { /* 같은 split, 다른 className */ }

// After — 단일 함수로 통합
const HIGHLIGHT_CLASS = "font-bold text-neutral-900 bg-yellow-100 px-1";
const BOLD_CLASS = "font-bold text-neutral-900";

function renderMarkdownBold(text, className = BOLD_CLASS) {
  if (!text) return null;
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className={className}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}
```

호출부에서 `renderMarkdownBold(text, HIGHLIGHT_CLASS)`로 의도를 명시.

---

### 2. `renderBold()` / `renderParagraphs()` 내부 인라인 — ⭐⭐⭐ — `api/lead.js:41, 46`

**실제 책임**: 같은 마크다운 볼드 규칙을 HTML 문자열용으로 처리. `renderParagraphs()` 안에는 동일 정규식이 또 다시 인라인되어 있음 (line 54).

**문제**: 한 파일 안에서 같은 도메인 규칙(볼드 마크다운 → `<strong>`)이 두 번 구현됨. `renderParagraphs`에서는 escapeHtml 후 다시 같은 정규식을 돌리므로, 추후 강조 규칙이 바뀌면 두 곳을 모두 손봐야 함.

**추출 제안**:

```js
// Before
function renderBold(text) {
  if (!text) return "";
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
function renderParagraphs(text) {
  if (!text) return "";
  return escapeHtml(text)
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 12px">${p
      .replace(/\n/g, "<br>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")}</p>`)
    .join("");
}

// After
function applyBoldMarkdown(escapedHtml) {
  return escapedHtml.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}
function renderBold(text) {
  if (!text) return "";
  return applyBoldMarkdown(escapeHtml(text));
}
function renderParagraphs(text) {
  if (!text) return "";
  return escapeHtml(text)
    .split(/\n\n+/)
    .map(p => `<p style="margin:0 0 12px">${applyBoldMarkdown(p.replace(/\n/g, "<br>"))}</p>`)
    .join("");
}
```

---

### 3. `DiagnosisPage()` — ⭐⭐ — `src/diagnosis/main.jsx:53`

**실제 책임**: 입력 폼, 로딩 화면, 결과 화면(5개 섹션), CTA를 한 컴포넌트(554줄)에서 모두 처리. 거기에 turnstile 마운트, 진행률 점근 계산, 폼 검증, fetch 호출, 패턴 라벨 룩업까지 포함.

**문제**: God Component. step state(`"input" | "loading" | "result"`)에 따라 거의 다른 화면 3개를 한 함수가 다룬다. 80줄 즉시 분해 임계를 7배 초과. 한 단락만 만져도 전체 컨텍스트를 짊어져야 함.

**추출 제안**: step별로 컴포넌트 분리.

```jsx
// After — 하위 컴포넌트로 절단
function InputStep({ formData, setFormData, onSubmit, error, ... }) { ... }
function LoadingStep({ progress }) { ... }
function ResultStep({ result, onReset }) { ... }

function DiagnosisPage() {
  const [step, setStep] = useState("input");
  // ... 상태만 보유, 화면은 하위에 위임
}
```

부수적으로 `runDiagnosis()` 안의 검증 4종(필수항목/길이/동의/턴스타일)도 `validateDiagnosisInput(formData, consent, turnstileToken)` 하나로 추출하면 도메인 규칙(진단 시작 전제 조건)이 명시화됨.

---

### 4. AI 응답 코드 펜스 제거 — ⭐⭐⭐ — `api/diagnose.js:180-184`

**실제 책임**: AI가 ` ```json ... ``` ` 형태로 감싸 보내는 경우를 대비해 코드 펜스를 벗기고 trim.

**문제**: 도메인 규칙("AI는 마크다운 코드 펜스로 JSON을 감쌀 수 있다")이 핸들러 본문에 인라인됨. 함수명이 없으니 의도가 코드 형태로만 전달되어, 향후 다른 엔드포인트가 같은 처리를 다시 인라인할 위험.

**추출 제안**:

```js
// Before
const cleaned = text
  .trim()
  .replace(/^```json\s*/i, "")
  .replace(/```\s*$/, "")
  .trim();

// After
function stripJsonCodeFence(text) {
  return text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
}
const cleaned = stripJsonCodeFence(text);
```

---

## 🟡 Medium / 🟢 Low

| 파일:라인 | 함수명 | 별점 | 실제 책임 (1줄) | 추출 가치 |
|-----------|--------|------|-----------------|-----------|
| `api/diagnose.js:130` | `handler()` | ⭐⭐⭐⭐ | POST 검증 → turnstile → Anthropic 호출 → 응답 파싱 | medium (검증 블록과 응답 파싱 블록만 명명 함수로 추출하면 핸들러가 오케스트레이션만 남음) |
| `api/lead.js:161` | `handler()` | ⭐⭐⭐⭐ | 입력 검증 → HTML 렌더 → Resend 발송 | medium |
| `src/diagnosis/main.jsx:69` | useEffect (loading 진행률) | ⭐⭐⭐⭐ | 로딩 95%까지 점근적으로 차오르게 setInterval 설정 | low (1회성, 응집도 높음 — False Positive 후보지만 매직넘버 30000은 상수로 빼면 좋음) |

---

## 패턴 분석

### 분산된 의도

**(1) 마크다운 볼드 파싱(`**...**` → `<strong>`)** — 4곳에 분산
- `api/lead.js:43` `renderBold()`
- `api/lead.js:54` `renderParagraphs()` 내부
- `src/diagnosis/main.jsx:192` `renderWithBold()`
- `src/diagnosis/main.jsx:207` `renderWithHighlight()`

통합 제안: `src/shared/markdownBold.js` 같은 모듈 또는 각 환경별(HTML 문자열용 / React JSX용) 명명 함수 단일화. 강조 클래스 차이는 인자로 받는다.

**(2) 패턴 ID ↔ 점수 키 매핑** — 두 가지 방식이 공존
- `api/lead.js:27` `SCORE_KEY_TO_PATTERN` dispatch table (정석)
- `src/diagnosis/main.jsx:431, 459, 460` `key.startsWith(result.root_cause)` / `Object.keys(patternLabels).find(k => k.startsWith(...))` (인라인 startsWith 매칭)

통합 제안: 같은 dispatch table을 main.jsx에서도 import해 쓰거나, 공유 상수 파일로 이동. `startsWith` 의존은 키 명명이 바뀌면 깨지는 암묵 규칙 — 명시 매핑으로 전환.

**(3) 패턴 라벨 정의** — 두 곳에 다른 키 체계로 정의
- `api/lead.js:19` `PATTERN_LABELS` (key: `pattern_01`, value: `"규격화된 정형성"`)
- `src/diagnosis/main.jsx:119` `patternLabels` (key: `pattern_01_generic_template`, value: `"Pattern 01 · 규격화된 정형성"`)

통합 제안: 동일 라벨 사전을 공유 상수 파일로 분리해 한 쪽이 수정될 때 다른 쪽도 자동 반영되도록 한다. 표시 형식만 호출부에서 가공.

### 표면적 중복

- `runDiagnosis()`(main.jsx:127)와 `ConsultRequestForm.submit()`(main.jsx:616): "검증 → 상태 변경 → fetch → 응답 분기 → 에러 메시지 set" 패턴이 거의 동일. 추후 fetch 헬퍼(`postJson(url, body)`) 또는 hook(`useApiSubmit`) 추출 후보.

### 새 모듈 후보

- `shared/diagnosisFormat.js` — 패턴 라벨 사전, score key↔pattern id 매핑, 마크다운 볼드 파서. 프론트/API 양쪽에서 import.
- `shared/markdownBold.js` — HTML/JSX 두 변환을 한 곳에 모음.

---

## 아키텍처 제안

1. **공유 상수/포맷 모듈을 절단**: 패턴 라벨·매핑·강조 규칙은 진단 결과의 도메인 규칙이지 화면별 관심사가 아니다. 한 소스로 통합하지 않으면 향후 패턴 6번 추가 시 두 파일을 모두 수정해야 한다.
2. **DiagnosisPage 분해**: step별 컴포넌트 분리(InputStep / LoadingStep / ResultStep). 결과 화면 5개 섹션도 각각 함수형 컴포넌트(`PatternScoreList`, `EvidenceCard`, `OnePagerSummary` 등)로 빼면 기여 범위가 분명해진다.
3. **API 응답 정규화 레이어**: `stripJsonCodeFence`처럼 "AI 응답 후처리" 규칙은 한 함수에 모아 향후 모델 교체나 추가 엔드포인트에 재사용.

---

## 다음 단계 권장

이번 검토에서 분산된 의도가 **3건** 발견되었습니다 (마크다운 볼드 파싱, 패턴 ID 매핑, 패턴 라벨 사전). 이는 함수 단위를 넘어선 **아키텍처 차원의 경로 설계 문제** — 즉 "프론트와 API가 같은 도메인 사전을 공유할 단일 출처가 없다" — 일 가능성이 큽니다.

→ 다음 단계로 `/architecture-review` 커맨드 실행을 권장합니다.
