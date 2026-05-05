# Architecture Review — 2026-05-05

## 컨텍스트 (자동 추론 + 사용자 확인)

- **서비스**: 면접관 시선의 이력서 AI 진단 + 랜딩페이지. 사용자가 이력서를 입력하면 Claude가 5개 패턴으로 진단 → 결과 페이지 표시 → 본 상담 신청 시 Resend로 운영자 메일 발송. [확인됨]
- **코드베이스 규모**: 3개 핵심 파일(api/diagnose.js, api/lead.js, src/diagnosis/main.jsx), 약 1,100라인. JS/JSX. [추론]
- **주요 도메인(추정)**: 이력서 진단(5 패턴), 운영자 알림 메일, 봇 검증(Turnstile). [추론]
- **주 사용자**: 이직/취업 준비 중 개인 지원자 + 운영자(naminimiya). [확인됨]
- **다음 기능**: 없음. [확인됨]

> ℹ️ 이 컨텍스트는 이번 진단 한 번에만 사용됩니다. 누적된 원칙 문서가 필요해지면 `service-design` 스킬을 실행하세요.

---

## 요약

- 진단 대상: 3개 파일 / 약 1,100라인
- 주요 증상: **진단 결과 도메인 사전(패턴 라벨·점수 키 매핑·볼드 파서)이 단일 출처 없이 프론트와 API에 각자 정의됨**
- 권장 패턴: **Single Source of Truth (공유 도메인 사전 모듈)**
- 플랜 스킬 호출 필요 여부: **Yes**

---

## 상태 지도

| 값의 정체성 | 쓰기 지점 | 읽기 지점 | 중복 여부 |
|---|---|---|---|
| 이력서 입력값 (formData) | main.jsx:55 setFormData | runDiagnosis fetch body | 단일 (OK) |
| 진단 step (input/loading/result) | main.jsx:54 setStep | AnimatePresence 분기 | 단일 (OK) |
| 진단 결과 객체 (result) | main.jsx:169 setResult | (a) 결과 화면 렌더 (b) ConsultRequestForm props (c) /api/lead body (d) lead.js 이메일 HTML 렌더 | 단일 보유 / **다중 해석** |
| **패턴 라벨 사전** | main.jsx:119 `patternLabels` (key=`pattern_01_generic_template`) | 결과 화면 | **lead.js:19 `PATTERN_LABELS`(key=`pattern_01`)와 키 체계·값 형식 모두 다름** |
| **score key → pattern id 매핑** | (정의 없음, startsWith로 인라인 추출) | main.jsx:431/459/460 | **lead.js:27 `SCORE_KEY_TO_PATTERN` dispatch와 두 방식 공존** |
| **마크다운 `**...**` 파서** | (없음, 호출부마다 정규식 인라인) | main.jsx:192/207, lead.js:43/54 | **4곳에 각각 인라인 구현** |
| 사용자 동의 | main.jsx:63 setConsent / 612 setAgree | 두 폼의 제출 가드 | 의미 동일·상태 분리 (OK, 폼 격리) |
| Turnstile 토큰 | main.jsx:64 setTurnstileToken | runDiagnosis | 단일 (OK) |

→ **중복 정체성: 3건** (라벨 사전 / 키 매핑 / 볼드 파서). 모두 "진단 결과의 표현 규칙" 도메인.

---

## 이벤트 지도

| 이벤트 | 핸들러 위치 | 해석 일관성 |
|---|---|---|
| 폼 제출 | `runDiagnosis()` (main.jsx:127), `ConsultRequestForm.submit()` (main.jsx:616) | "검증 → setStatus/loading → fetch → 응답 분기 → 에러 setState" 흐름이 거의 동일하게 두 번 인라인 |
| Turnstile 콜백 | useEffect 폴링 마운트 (main.jsx:86) | 단일 |
| AI 응답 수신 (서버) | diagnose.js:175 코드펜스 strip + JSON.parse | 단일 (단, 도메인 규칙이 인라인) |
| 진단 결과 렌더 | 프론트 결과 섹션 5개 + lead.js 이메일 템플릿 | **같은 결과 객체를 두 렌더러가 각자 해체** (라벨 다름, 강조 클래스 다름) |

→ 이벤트 자체의 분산보다 **결과 객체 해석의 분산**이 더 큰 위험.

---

## 의존 방향 지도 (문제 있는 관계 발췌)

```
src/diagnosis/main.jsx ──┐
                         ├── 진단 결과 JSON 스키마 (root_cause, pattern_scores, evidence, ...)
api/diagnose.js   ───────┤    └── 단일 출처 없음. 세 파일이 각자 필드를 직접 접근
api/lead.js       ──────-┘
```

- 직접 내부 접근(필드 해체) ≥ 3건: `pattern_scores`, `evidence`, `root_cause`, `next_step_recommendation`, `correctability`, `key_verdict`, `one_pager_summary`, `self_reflection_questions` — 동일 필드를 main.jsx와 lead.js가 각자 디스트럭처링
- 순환 의존: 없음
- 핵심 문제: **진단 결과 도메인의 "단일 사전(라벨·매핑·강조 규칙)"이 어디에도 없음** → 프론트와 백엔드가 각자 자기 사전을 들고 있음

---

## 선택된 패턴 및 근거

### 패턴: **Single Source of Truth (공유 도메인 사전 모듈)**

**왜 이 패턴인가**
- 중복된 "정체성"이 셋 모두 표현 규칙(라벨/매핑/강조). 데이터 흐름을 뒤엎을 필요는 없고, **표현 사전만 한 출처로 모으면** 분산이 사라진다.
- Command Pattern이나 Event Emission은 이번 증상에 비해 과한 도구다. 이벤트 자체는 단순(폼 제출 2개)하고 자식이 부모 내부를 직접 호출하는 경우도 없다.

**왜 지금인가**
- 운영 중인 서비스(2026-04-29 출시)이며, 향후 패턴 6번 추가나 강조 규칙 변경 시 "한 쪽만 수정 → 다른 쪽 어긋남" 사고가 일어날 위치가 이미 형성되어 있다.
- 신규 기능 계획이 없으므로(=확장 압력 낮음) **지금이 가장 안전한 정리 시점**. 기능 추가가 끼어들면 사전 통합 작업의 충돌 위험이 커진다.

**적용 시 영향 범위 개괄**
- 새 모듈 1~2개 신설 (예: `src/shared/diagnosis-dictionary.js`, `src/shared/markdown-bold.js`)
- 변경 파일: main.jsx(라벨 import 교체, 볼드 함수 통합), lead.js(라벨/볼드 import), diagnose.js는 변동 없음
- 동작 변경 없음 — 표현이 바뀌지 않는 순수 리팩토링이 목표. 라벨 문자열·매핑 결과·HTML 출력이 동일해야 함

---

## 방향 제안

- **패턴**: Single Source of Truth
- **적용 범위**:
  - 패턴 라벨 사전 (main.jsx:119 `patternLabels` ↔ lead.js:19 `PATTERN_LABELS`)
  - 점수 키 → 패턴 ID 매핑 (main.jsx의 `startsWith` 인라인 ↔ lead.js의 `SCORE_KEY_TO_PATTERN`)
  - 마크다운 `**...**` 파서 (main.jsx의 renderWithBold/renderWithHighlight ↔ lead.js의 renderBold/renderParagraphs)

- **개괄 접근**: 먼저 공유 사전 모듈을 **새로 만들고**(라벨·매핑·볼드 파서를 한 곳에 정의), 두 호출처가 새 모듈을 import해 사용하도록 **호출을 이전한다**. 이전이 끝나면 main.jsx와 lead.js 안의 중복 정의를 **제거한다**. 사전 모듈은 프론트/서버 양쪽에서 import 가능해야 하므로 빌드 시스템(Vite)과 Vercel Functions 양쪽에서 사용 가능한 형태(순수 JS, 외부 의존 없음)로 둔다.

- **주의점**:
  - 두 곳의 라벨이 **키 체계가 다르다**(긴 키 vs 짧은 키). 통합 시 한쪽에 맞추면 다른 쪽 호출부도 따라가야 한다 — 정렬 방향을 먼저 정한 뒤 한 번에 옮긴다.
  - 라벨 표시 형식도 다르다(main.jsx는 `"Pattern 01 · 규격화된 정형성"`, lead.js는 `"규격화된 정형성"`). 사전은 짧은 라벨만 보유하고, "Pattern 01 · " 접두는 호출부에서 가공한다.
  - 마크다운 파서는 **JSX 반환형**과 **HTML 문자열 반환형** 두 변종이 필요하다. 한 사전 모듈에 두 함수를 두되 입력이 같은 정규식임을 명시.
  - lead.js의 `renderBold`는 `escapeHtml`을 먼저 거치고 볼드를 적용한다. 순서를 바꾸면 XSS가 생긴다 — 이전 시 입력이 이미 escape된 상태인지 명확히 구분.

- **Golden Master 필요**: **Yes** (테스트가 없는 상태. 이메일 HTML 출력과 결과 화면 렌더링이 이전 후에도 동일해야 한다.)

---

## 대기 리스트 (이번 라운드 적용 안 함)

- **DiagnosisPage 컴포넌트 분해** (554줄 → step별 InputStep/LoadingStep/ResultStep). 의도는 명확하지만 React 렌더링 변경 위험이 크고 관찰 도구가 없다. SSoT 정리 후 다음 라운드에서 재평가.
- **폼 제출 흐름 추출** (`runDiagnosis`와 `ConsultRequestForm.submit`의 검증→fetch→분기 패턴). 두 호출 흐름의 차이(필요 검증 항목, 에러 메시지 톤)가 있어 섣불리 통합하면 도메인 의도가 흐려진다.
- **AI 응답 코드펜스 제거 명명 함수화** (diagnose.js:180). intent-review에서 이미 식별. 작은 작업이라 SSoT 라운드와 함께 묶어 처리해도 무방하지만, 이번 라운드의 패턴(SSoT)과 무관하므로 분리.
- **`renderEmailHtml` 분해**. 78줄 단일 함수. 응집도 높아 false positive 후보. 보류.

→ 다음 라운드에서 우선순위 재평가.

---

## 다음 단계 — 플랜 작성

이 방향 제안을 실행 가능한 plan으로 변환하려면 `superpowers:writing-plans` 스킬을 호출하세요.
플랜 스킬이 다음을 작성합니다:
- 라운드별 독립 plan 파일
- 단계별 task + 검증 절차
- Golden Master 시나리오 구체 목록 (이메일 HTML 스냅샷 / 결과 화면 렌더 스냅샷)
- 커밋 계획

본 방향 제안 문서를 플랜 스킬의 입력으로 전달하면 됩니다.
