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

`api/lead.js` 의 `OPERATOR_EMAIL` 상수 변경. **단, Resend 가입 이메일과 일치해야 발송 가능** (도메인 인증 안 한 무료 티어 제약).

도메인 인증을 진행하면 임의 발신/수신 가능.

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
- 사용량 ↑ 시 IP 기반 일일 제한 추가 (Upstash Redis)
- 다국어 (영어 진단 옵션)
