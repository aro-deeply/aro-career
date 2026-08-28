# ARO 운영 매뉴얼 (RUNBOOK)

운영 중 평소 참조용. 작업 시점은 2026-04-29.

---

## 1. 시스템 한눈에

```
[사용자] → 랜딩 (index.html) → CTA 클릭 → /diagnosis
              ↓
         [diagnosis.html]
              ↓ (Turnstile 통과 + 동의 체크)
         POST /api/diagnose ─→ Cloudflare verify ─→ Anthropic Claude
              ↓ (결과 표시)
         "전문가 상담 신청" 폼
              ↓
         POST /api/lead ─→ Resend ─→ naminimiya@gmail.com 알림
```

- 호스팅: Vercel (정적 + Serverless Functions)
- 모델: `claude-sonnet-4-6`
- 빌드 도구 없음. HTML/JS만 수정 → push → Vercel 자동 배포 (30초~1분)

---

## 2. 자주 하는 작업

### 콘텐츠 수정 (랜딩 문구, 진단 페이지 텍스트)

```
1. 로컬에서 index.html 또는 diagnosis.html 수정
2. git add <파일> && git commit -m "수정 내용"
3. git push
4. Vercel 자동 재배포 (30초~1분)
5. https://aro-career.vercel.app 에서 확인
```

### 진단 응답 구조 — 스트리밍 (2026-08-28~)

`/api/diagnose`는 JSON 한 방이 아니라 **NDJSON 스트리밍**으로 응답한다:
`{"t":"delta","text":...}` 반복 → 마지막에 `{"t":"done"}` 또는 `{"t":"error","message":...}`.
검증 실패·레이트리밋(400/403/429) 등 스트림 시작 전 오류는 기존처럼 JSON 상태 응답.

- 로딩 화면의 진행률은 실제 수신량 기반. `key_verdict`가 도착하면(제출 후 4~6초경) "핵심 판정 먼저 확인" 카드가 뜬다 — 안 뜨면 스트리밍이 죽었다는 신호 (콘솔·Vercel 로그 확인).
- 관련 파일: `api/diagnose.js`(서버 중계) · `src/diagnosis/diagnose-stream.js`(리더) · `stream-preview.js`(미리보기 추출) · `LoadingStep.jsx`(표시)
- 프롬프트의 JSON 스키마는 **필드 순서가 계약**이다 (key_verdict·root_diagnosis가 앞이라 미리보기가 초반에 도착). 스키마 수정 시 순서 유지 + `tests/eval/run-eval.js` 동기화 + eval 재실행.
- 속도 이력: 44초(원본) → 33초(출력 다이어트, cc522dd) + 스트리밍 미리보기(a4e9622). 총 시간을 더 줄이려면 출력 분량 추가 축소가 유일한 레버.

### Anthropic 크레딧 추가 충전

console.anthropic.com → Plans & Billing → Add credits.
**Auto-reload는 OFF 유지** (절대 한도 보호). 수동 충전만.

진단 1회당 약 $0.03~0.05. $20면 약 400~600회.

### 진단 모델 업그레이드 / 변경

`api/diagnose.js` 첫 줄 부근의 `ANTHROPIC_MODEL` 변경 → commit + push.

후보: `claude-sonnet-4-6` (현재) / `claude-opus-4-7` (더 똑똑, 5~10배 비쌈) / `claude-haiku-4-5-20251001` (빠르고 저렴, 품질↓).

> 앤트로픽 모델 ID는 정기적으로 갱신됨. 새 ID 사용 시 한 번 호출 테스트 필수.

### 처리방침 문구 / 보관 기간 변경

`diagnosis.html` 안 동의 체크박스 부근 (`보관 기간: 신청 후 6개월` 텍스트) 검색 후 수정.

### 운영자 메일 주소 변경

수신지/표시 주소가 두 곳에 분리되어 있다. **둘 다 갱신해야 함** (Chrome 익스텐션류 mass-replace는 백엔드를 자주 누락):

- **백엔드 실제 수신지**: `api/lead.js`의 `OPERATOR_EMAIL` 상수
- **프론트 표시**: `src/shared/contact.js`의 `OPERATOR_EMAIL` + `index.html`/`blog/index.html` footer mailto + `src/diagnosis/InputStep.jsx`·`ConsultRequestForm.jsx`의 동의 문구 mailto

발송이 가능하려면 **발신지(`from`)가 Resend에서 verified된 도메인을 써야** 임의 수신지로 보낼 수 있음. 코드 default(`onboarding@resend.dev`)는 Resend 공유 샌드박스라 verified 도메인이 있어도 무시되고 Resend 가입 이메일에만 발송 가능. 발신지는 `RESEND_FROM` 환경변수로 지정 (예: `ARO Career Direction <notice@aro-career.com>`).

⚠ `RESEND_FROM`은 **Sensitive로 마킹하지 말 것** — 한 번 저장 후 값을 누구도(대시보드/CLI) 다시 못 봐서 디버깅이 어려워짐. 발신지는 비밀이 아님.

### 레이트리밋(Upstash Redis) 관리

진단 API는 IP당 1분 5회 / 1일 20회 제한 (`api/diagnose.js` + `api/_rate-limit.js`).

- **DB**: Vercel Marketplace 공식 연동으로 프로비저닝된 `aro-career-ratelimit` (Upstash for Redis, iad1, Free 플랜 — 월 500,000 커맨드). Vercel 프로젝트 → Storage에서 관리.
- **환경변수**: 연동이 자동 생성하는 이름은 `UPSTASH_REDIS_REST_*`가 **아니라** `KV_REST_API_URL` / `KV_REST_API_TOKEN` (레거시 Vercel KV 호환 명명, Sensitive라 값 열람 불가). 코드는 `UPSTASH_REDIS_REST_*` → `KV_REST_API_*` 순으로 fallback해서 읽는다. **수동으로 UPSTASH_* 이름을 만들면 연동 값을 가리므로 만들지 말 것.**
- **DB가 또 사라지면**: 진단은 죽지 않는다(fail-open, 레이트리밋만 조용히 꺼짐). Storage에서 새 DB 생성 → 프로젝트 Connect → Redeploy만 하면 코드 수정 없이 복구.
- **작동 검증**: 가짜 Turnstile 토큰으로 `/api/diagnose`에 연속 POST → 5회 403 후 6회째 429면 정상. 계속 403만 나오면 Redis 연결 안 됨(fail-open 상태).

### 커스텀 도메인 연결 (예: aro.kr)

1. 도메인 사두기 (가비아·카페24·Cloudflare Registrar 등)
2. Vercel → 프로젝트 → Settings → Domains → Add → 도메인 입력
3. Vercel이 안내하는 DNS 레코드를 도메인 등록업체에서 설정
4. 보통 5분~수시간 내 적용
5. **Cloudflare Turnstile에 새 도메인도 hostname으로 추가** 필수

### 키 회전 (보안 사고 시)

| 키 | 회전 절차 |
|---|---|
| ANTHROPIC_API_KEY | Console → API Keys → Revoke 옛 키, Create 새 키 → Vercel 환경변수 업데이트 → Redeploy |
| RESEND_API_KEY | Resend Dashboard → API Keys → 옛 키 Revoke + 새 키 발급 → Vercel 업데이트 |
| TURNSTILE_SECRET_KEY | Cloudflare → Turnstile → 위젯 → Rotate Secret → Vercel 업데이트 |
| TURNSTILE_SITE_KEY | 거의 회전 불필요 (공개 키). 필요시 위젯 재생성 후 코드의 sitekey 직접 박힌 곳도 수정 |
| KV_REST_API_TOKEN (Upstash) | Marketplace 연동 관리 변수 — Vercel에서 직접 수정하지 말 것. Upstash 콘솔(Storage → Open in Upstash)에서 토큰 회전하면 연동이 갱신. 이후 Redeploy |

> **Vercel 환경변수 변경 후엔 항상 Redeploy 필요** (자동 안 됨).

---

## 3. 일상 모니터링 — 어디서 무엇을 보나

| 무엇 | 어디서 | 빈도 |
|---|---|---|
| Anthropic 잔액 | console.anthropic.com → Usage | 주 1회 |
| Vercel 함수 에러 | vercel.com/aro-career → Logs | 신청 안 들어올 때 |
| Resend 발송 통계 | resend.com → Emails | 월 1회 (3,000건 한도) |
| 진단 신청 도착 | naminimiya@gmail.com 메일함 (스팸함 포함) | 매일 |

> 자동 점검 routine 설정됨 (claude.ai/code/routines). 1주 후 자동으로 위 항목 일부를 점검해서 메일로 리포트.

---

## 4. 트러블슈팅 — 만났던 이슈와 해결

> 2026-04-29 작업 중 실제 만난 이슈들. 다시 비슷한 패턴 보이면 여기 먼저 확인.

### 4.1 도메인 충돌 — `aro-landing.vercel.app`이 다른 사람 사이트

- **증상**: 본인 URL이라고 알고 있던 곳에 모르는 사이트(Aro Ceylon 여행사) 표시
- **원인**: Vercel 프로젝트 이름이 점유돼 있으면 다른 형태(`<name>-xxxx.vercel.app` 또는 `<name>-eight`)로 발급. 본인 진짜 URL을 확인 안 함.
- **해결**: Vercel 프로젝트 → Domains 에서 본인 진짜 URL 확인. 필요하면 프로젝트 이름 변경 (도메인도 따라감). 변경 시 Cloudflare Turnstile hostname도 동시 변경 필수.
- **교훈**: 처음 Vercel 배포 후 본인 production URL 정확히 메모. 추정 금지.

### 4.2 Turnstile 위젯이 화면에 안 뜸

- **증상**: 진단 시작 버튼이 회색(disabled)인 상태에서 풀리지 않음. 위젯 영역 자체가 비어 있음.
- **원인**: Cloudflare Turnstile의 `cf-turnstile` 자동 스캔이 React + Babel CDN 환경에서 타이밍이 안 맞아 작동 안 함.
- **해결**: `window.turnstile.render()` 명시 호출 패턴 사용. `useRef` + `useEffect` 안에서 폴링 후 마운트. 코드는 `diagnosis.html`의 `turnstileRef` 부근 참조.
- **교훈**: React에서 외부 위젯 임베드 시 자동 스캔에 의존하지 말고 explicit render 사용.

### 4.3 Site Key 오타 (`O` ↔ `0`)

- **증상**: 콘솔에 `[Cloudflare Turnstile] Error: 400020` (Invalid Sitekey)
- **원인**: Cloudflare 화면에서 Site Key 복사 시 알파벳 대문자 `O`와 숫자 `0`을 시각적으로 구분 못 함. 코드에 `TOP`(O)으로 박혔는데 정답은 `T0P`(0).
- **해결**: 메모장에 붙여넣고 한 글자 대조. 모노스페이스 폰트가 보기 좋음.
- **교훈**: 키/UUID는 항상 모노스페이스에서 검수. `0/O`, `1/l/I`, `5/S` 주의.

### 4.4 Secret Key도 오타 (같은 O/0 문제)

- **증상**: `/api/diagnose` HTTP 403 + "봇 검증에 실패했습니다"
- **원인**: Cloudflare Turnstile siteverify 호출 시 Secret Key 불일치. Site Key와 같은 시각 혼동.
- **해결**: Vercel 환경변수 `TURNSTILE_SECRET_KEY`를 Cloudflare에서 다시 정확히 복사 후 Save → **Redeploy 필수**.
- **교훈**: 환경변수 변경은 자동 적용 안 됨. 매번 Redeploy. 그리고 Cloudflare에서 키 복사할 땐 "Show" 누르고 메모장 검수.

### 4.5 모델 ID 404

- **증상**: Vercel 로그에 `Anthropic call failed: 404 model not found - claude-sonnet-4-20250514`
- **원인**: 처음 코드에 박은 모델 ID가 사용자 Anthropic 계정 티어에서 액세스 불가했음.
- **해결**: 더 안정적 모델 ID로 교체 (`claude-sonnet-4-6`).
- **교훈**: 모델 ID는 Anthropic 공식 문서에서 최신 안정 ID 확인. 첫 호출 테스트 필수.

### 4.6 `/diagnosis` 라우팅 404

- **증상**: `aro-career.vercel.app/diagnosis` 접속 시 Vercel 404 페이지
- **원인**: Vercel 기본 설정에서 `.html` 확장자 없는 경로가 자동 매핑 안 됨.
- **해결**: 루트에 `vercel.json` 추가, `{ "cleanUrls": true }` 설정.
- **교훈**: 정적 사이트 + 깔끔 URL 원하면 항상 cleanUrls 설정.

### 4.7 메일 본문 JSON 그대로 도착

- **증상**: 운영자 알림 메일이 raw JSON 텍스트로 와서 가독성 낮음.
- **해결**: `api/lead.js`의 `renderEmailHtml`을 카드 형식 HTML로 재작성. JSON 원본은 `<details>` 안에 보존.
- **교훈**: 운영자도 사람. 데이터 보존성 + 가독성 둘 다 챙기기.

### 4.8 메일이 안 도착함 — Resend 403 validation_error

- **증상**: 진단은 정상 처리되는데 운영자/신청자 알림 메일 모두 미도착. Vercel 함수 로그에 `Resend operator email error: { statusCode: 403, name: 'validation_error', message: 'You can only send testing emails to your own email address (...).' }`.
- **원인**: `RESEND_FROM` 미설정 또는 잘못된 형식. 코드 default(`onboarding@resend.dev`)는 Resend 공유 샌드박스라 **verified 도메인이 있어도 무시**되고 Resend 가입 이메일에만 발송 가능. DNS 레코드 박혀 있고 Resend 대시보드에서 Verified 떠도, `from`을 그 도메인으로 실제로 사용해야 무료 티어 제약이 풀림.
- **해결**: Vercel 환경변수 `RESEND_FROM = "ARO Career Direction <notice@aro-career.com>"` 추가 (Sensitive 체크 해제) → Redeploy. 발신 메일박스(`notice@`)는 실제로 만들 필요 없음 (헤더 문자열일 뿐). 답장 경로는 코드 `replyTo`에서 분리됨.
- **교훈**: DNS 인증 ≠ 발신 사용. Resend는 `from`을 보고 무료 티어 제약 적용 여부를 결정한다. 그리고 환경변수 Sensitive 플래그는 비밀 아닌 값에 쓰면 디버깅 자해.

### 4.9 진단 엔진 전면 불통 — Upstash DB 소멸로 500 (2026-08-27)

- **증상**: 진단 제출 시 "일시적 오류가 발생했습니다" 표시. `/api/diagnose`가 HTTP 500. Vercel 로그에 `Error: getaddrinfo ENOTFOUND national-kiwi-70429.upstash.io`.
- **원인**: 두 겹. (1) Upstash 무료 티어가 장기 미사용 DB를 삭제해 레이트리밋용 Redis 호스트가 DNS에서 소멸. (2) `checkRateLimit()`이 try/catch 밖에서 await되어 Redis 예외가 함수 전체를 크래시 — 부가 기능(레이트리밋) 장애가 핵심 기능(진단)을 죽였다. 코드 주석은 "환경변수 누락 시 fail-open"이었지만 "환경변수는 있는데 DB만 죽은" 경우는 fail-closed였음.
- **해결**: ① 판정 로직을 `api/_rate-limit.js`로 추출하고 Redis 예외 시 fail-open (커밋 94ebc71) — 이것만으로 진단 즉시 복구. ② Marketplace 공식 연동으로 새 DB `aro-career-ratelimit` 프로비저닝 + 코드에 `KV_REST_API_*` fallback 추가 (커밋 1e88210). ③ 죽은 DB를 가리키던 수동 `UPSTASH_REDIS_REST_URL/TOKEN` 변수 삭제 (코드가 그 이름을 우선 읽어 새 값을 가리므로).
- **교훈**:
  - 부가 기능의 인프라 장애가 핵심 기능을 죽이면 안 된다. 외부 의존 호출은 fail-open/fail-closed를 명시적으로 설계하고, 주석의 약속("fail-open")과 실제 동작을 일치시킬 것.
  - 무료 티어 DB는 저트래픽 서비스에서 소리 없이 사라질 수 있다. 진단 500이면 Vercel 로그에서 `ENOTFOUND *.upstash.io`부터 확인.
  - Marketplace 연동의 자동 env 이름은 SDK 문서와 다를 수 있다 (Upstash인데 `KV_REST_API_*`). 연동 후 반드시 환경변수 페이지에서 실제 생성된 이름 확인.
  - 429 응답이 곧 헬스체크다: 한도 초과가 발생해야 Redis가 살아있다는 뜻.

---

## 5. 응급 절차

### API 키 노출 (GitHub에 실수로 커밋했거나 외부 노출)

1. **즉시** 해당 서비스에서 키 Revoke
2. 새 키 발급
3. Vercel 환경변수 업데이트 + Redeploy
4. (선택) git history에서 키 제거 (BFG Repo-Cleaner 등) — 어차피 revoke했으면 큰 위험은 없음
5. Anthropic이면 잔액 즉시 확인 (악용 흔적)

### 진단 서비스 다운 (Anthropic 5xx 빈발)

1. https://status.anthropic.com 확인
2. Anthropic 장애면 — 일시적, 사용자에게 "잠시 후 다시 시도" 안내 (이미 그렇게 표시됨)
3. 우리 코드 문제면 — Vercel Logs 보고 디버그
4. 장기 다운 시 — 진단 페이지에 정적 안내 띄우기 (수동 배포)

### 비용 폭탄 (예상치 못한 청구)

1. Anthropic Console → Usage에서 어떤 모델/일자에 발생했는지
2. 봇 트래픽 의심 → Cloudflare Turnstile 검증 강도 ↑ ("Managed" → "Invisible Challenge")
3. Resend 폭증 → IP 차단 또는 서비스 일시 중단

---

## 6. 작업 이력 (2026-04-29 단일 세션)

이 시스템이 어떻게 만들어졌는지의 commit 흐름:

```
6b7e739  Initial commit: ARO landing page (랜딩만)
61ce929  docs: DESIGN.md (설계 결정 합의)
8979e94  docs: PLAN.md (구현 플랜)
8ba1e24  chore: package.json + .gitignore
26b8e83  feat: api/diagnose.js (Claude 호출 백엔드)
9c8e2d6  feat: api/lead.js (Resend 알림)
7ad393d  chore: diagnosis.html 복사 (archive → 루트)
2ea9f91  WIP: T5 작업 중 학교에서 중단
6492a7e  refactor: Anthropic 직접 호출 → /api/diagnose
58a993f  feat: 동의 체크박스 + Turnstile + 신청 폼
27d74b8  feat: 랜딩 CTA 4곳 → /diagnosis
b04822b  feat: Turnstile site key 박기
d44556e  chore: aro-landing → aro-career 이름 변경
618df41  fix: vercel.json (cleanUrls) — /diagnosis 404 해결
1368772  fix: Turnstile explicit render (자동 스캔 실패 우회)
b3e7328  fix: Site key 오타 (TOP → T0P, O → 0)
20faffd  fix: 모델 ID claude-sonnet-4-6 (4-20250514 404)
4b71e77  feat: 메일 카드 형식 (raw JSON → 사람 친화적)
```

총 18 commit. 디버깅 6번 (4.1~4.6).

---

## 7. 향후 후보 작업 (필요할 때)

- 진단 페이지 디자인을 본인 랜딩에 맞춰 통일 (현재는 Tailwind 스타일이라 약간 따로 놂)
- Resend 본인 도메인 인증 (운영자 메일 주소 자유롭게 변경 가능)
- Google Sheets 연동 (Resend 메일 외에 명단 자동 누적)
- 진단 결과 → 사용자에게도 PDF로 발송 (옵션)
- ~~사용량 ↑ 시 IP 기반 일일 제한 추가 (Upstash Redis)~~ → 완료 (1분 5회 / 1일 20회, 2장 "레이트리밋 관리" 참조)
- 다국어 (영어 진단 옵션)
