# ARO 진단 엔진 통합 설계 문서

- 작성일: 2026-04-29
- 대상 레포: [aro-deeply/aro-career](https://github.com/aro-deeply/aro-career)
- 상태: **브레인스토밍 완료** — 설계 합의 완료. 구현 플랜 작성 단계로 이동 예정.
- 작성 도구: Claude Code (brainstorming 스킬)

---

## 1. 목표

랜딩페이지(`index.html`)의 CTA 3곳을 클릭하면 AI 진단 페이지로 이동하고, 거기서 사용자가 이력서를 진단받은 뒤 상담 신청까지 이어지게 한다. **API 키는 절대 클라이언트(브라우저)에 노출되지 않는** 보안 구조로 구현한다.

---

## 2. 결정 사항 (브레인스토밍 합의)

| # | 항목 | 결정 |
|---|---|---|
| 1 | 통합 방식 | **같은 사이트의 다른 경로** (`aro-career.vercel.app/diagnosis`). 한 레포·한 Vercel 프로젝트로 통합. |
| 2 | 결과 후 흐름 | 결과 화면 하단에 **"전문가 상담 신청" 폼** 노출 → 이름·이메일 입력 → 운영자에게 즉시 메일 알림 |
| 3 | 명단 받는 방식 | **C-1 / Resend 이메일 알림** (DB 없음, 신청 들어올 때마다 본인 메일함으로 즉시 도착) |
| 4 | 알림 받을 운영자 메일 | `naminimiya@gmail.com` (= Resend 가입 시 사용할 이메일과 동일해야 함. 무료/도메인 미인증 시 Resend는 가입 이메일로만 발송 가능) |
| 5 | 진단 결과 받는 범위 | **(a) 결과 전체** + 안전장치 1+2 적용 |
| 6 | 안전장치 1 (식별정보 마스킹) | AI 시스템 프롬프트에 한 덩어리 추가 → `evidence` 인용 시 이름·회사명·학교명·연락처 등 식별정보 자동 제외 / 마스킹 |
| 7 | 안전장치 2 (사용자 동의) | 진단 시작 폼에 **동의 체크박스 + 간단한 처리방침 문구** 노출 |
| 8 | 비용·남용 방지 | **3-2 옵션 변형**: Anthropic은 **Prepaid 크레딧 $20이 절대 한도**(Auto-reload OFF) + Cloudflare Turnstile 봇 차단 |
| 9 | 모델 | 현행 유지 (`claude-sonnet-4-20250514`). 추후 업그레이드 검토. |

---

## 3. 시스템 구조

### 3.1 파일 구조

```
aro-career/                       ← GitHub 레포 (현재 운영 중)
├── index.html                    ← 랜딩페이지. 기존 CTA 3곳을 "/diagnosis"로 링크
├── diagnosis.html                ← 진단 페이지 (archive/aro-diagnosis.html을 옮겨오고 수정)
├── api/
│   ├── diagnose.js               ← 백엔드 함수 ①: Claude API 호출
│   └── lead.js                   ← 백엔드 함수 ②: 상담 신청자 정보 Resend로 발송
├── .gitignore                    ← .env*, node_modules 등 차단
├── package.json                  ← Vercel 함수에서 쓸 SDK 의존성 (Anthropic, Resend)
├── DESIGN.md                     ← 본 문서
└── README.md (선택)
```

- 정적 HTML 2개 + Vercel Serverless Function 2개
- 별도 서버, 별도 빌드 도구, 별도 DB 없음
- `/api/*` 폴더는 Vercel이 자동으로 백엔드 함수로 인식
- `diagnosis.html`은 현재 `aro-diagnosis.html`처럼 React + Tailwind + Babel CDN 구조 유지 (빌드 도구 없음). API 호출 부분만 백엔드 경로로 교체.

### 3.2 데이터 흐름

```
[사용자] 랜딩페이지 index.html
   │ CTA 클릭 (3곳 어디서든)
   ↓
[사용자] /diagnosis 진입
   │ 4필드 입력 (목표 직무 / 상황 / 이력서 본문 / 탈락 사유)
   │ 동의 체크박스 ON
   │ Cloudflare Turnstile 통과 ("나는 사람입니다")
   │ "진단 시작" 클릭
   ↓
[브라우저] POST /api/diagnose
   │ 본문: 입력값 4개 + Turnstile 토큰
   ↓
[Vercel 함수: diagnose.js]
   ├─ Turnstile 토큰 검증 (봇 차단)
   ├─ 환경변수에서 ANTHROPIC_API_KEY 꺼냄  ← 키는 여기서만 존재. 브라우저에 절대 안 감
   ├─ Anthropic Claude API 호출
   │   - 시스템 프롬프트 (식별정보 마스킹 지시 포함)
   │   - 사용자 입력
   └─ JSON 결과 반환
   ↓
[브라우저] 결과 화면 표시
   │ 결과 하단 "전문가 상담 신청" 폼: 이름 + 이메일 + 동의
   │ 제출 클릭
   ↓
[브라우저] POST /api/lead
   │ 본문: 이름·이메일 + 방금 받은 진단 결과 JSON 전체
   ↓
[Vercel 함수: lead.js]
   ├─ 환경변수에서 RESEND_API_KEY 꺼냄
   └─ Resend API로 운영자 메일 발송
       └─ 받는 사람: naminimiya@gmail.com
           제목: "[ARO 진단 신청] 이름 / 시각"
           본문: 신청자 이름·이메일·신청 시각 + 진단 결과 전체
   ↓
[사용자] "잘 접수되었습니다" 토스트
[운영자] 메일함에 신규 진단 신청 도착 (스팸함도 확인 권장 — 도메인 미인증 시 onboarding@resend.dev 발신)
```

### 3.3 핵심 보안 원칙

- API 키 3개 (Anthropic, Resend, Turnstile Secret) 전부 **Vercel 환경변수에만 보관**
- 코드(GitHub)에 키 절대 안 들어감
- `.env*` 파일은 `.gitignore`로 차단
- 브라우저에 직접 노출되는 건 **Turnstile Site Key 1개뿐** (이 키는 공개되어도 안전한 종류)

### 3.4 라우팅 · URL

- 사용자 URL은 `/diagnosis` (확장자 없는 깔끔한 형태). Vercel이 정적 파일을 자동으로 확장자 없이 라우팅함 → `diagnosis.html` 파일이지만 사용자에겐 `/diagnosis`로 보임. 별도 설정 불필요.
- `aro-diagnosis.html`은 **루트의 `archive/` 폴더에 그대로 보존** (백업·이력 차원). 운영용은 새로 만든 루트의 `diagnosis.html` 한 파일만 작동.

---

## 4. 보안 · 에러 처리 · 동작 시나리오

### 4.1 환경변수 (총 4개)

Vercel 대시보드 → Settings → Environment Variables 에 등록:

| 환경변수 이름 | 값 | 어디서 받음 | 어디서 쓰임 |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Anthropic Console (이미 발급함) | `api/diagnose.js` |
| `RESEND_API_KEY` | `re_...` | Resend 가입 후 발급 | `api/lead.js` |
| `TURNSTILE_SECRET_KEY` | (Cloudflare 발급) | Cloudflare Turnstile 사이트 등록 후 발급 | `api/diagnose.js` (검증용) |
| `TURNSTILE_SITE_KEY` | (Cloudflare 발급) | 위와 같이 발급 | `diagnosis.html` (브라우저에 노출되어도 안전) |

### 4.2 식별정보 마스킹 (안전장치 1)

진단 페이지의 `systemPrompt`에 다음 한 덩어리 추가:

```
【evidence 작성 규칙 · 매우 중요】
evidence의 quote는 이력서 원문에서 발췌하되, 다음 정보는 반드시 제외하거나 마스킹합니다:
- 이름·회사명·학교명·기관명·소속명
- 전화번호·이메일·주소·생년월일·SNS ID
- 기타 고유명사로 개인을 특정할 수 있는 정보
식별정보가 포함된 문장이라면 해당 부분을 [...]로 가리거나, 식별정보가 없는 다른 문장을 발췌합니다.
```

### 4.3 동의 체크박스 + 처리방침 (안전장치 2)

진단 페이지 입력 폼에 추가될 문구:

```
☐ (필수) 입력한 정보가 AI 진단 처리에 사용되며,
   '전문가 상담 신청' 시 입력 내용이 운영자에게 전달됨에 동의합니다.
   · 보관 기간: 신청 후 6개월
   · 문의 / 삭제 요청: naminimiya@gmail.com
```

체크 안 하면 "진단 시작" 버튼 비활성화.

### 4.4 에러 처리 시나리오

| 상황 | 사용자에게 보이는 것 | 백엔드 동작 |
|---|---|---|
| Turnstile 검증 실패 (봇 의심) | "봇 검증에 실패했습니다. 다시 시도해주세요" | API 호출 안 함. 비용 0. |
| Anthropic API 호출 실패 (네트워크/타임아웃) | "일시적 오류입니다. 잠시 후 다시 시도해주세요" + 재시도 버튼 | 에러 로그 남김 |
| Anthropic이 잘못된 JSON 반환 | 동일하게 재시도 안내 | 1회 자동 재시도 후 실패 시 사용자에게 알림 |
| Anthropic 크레딧 소진 ($20 한도 도달) | "현재 진단 서비스 점검 중입니다. 잠시 후 다시 시도해주세요" | 운영자가 잔액 확인 후 추가 충전. (참고: Anthropic Console → Billing → Notifications 에서 잔액 임계 알림 이메일 설정 권장) |
| Resend 발송 실패 (운영자 알림) | 사용자에게는 "접수되었습니다" 표시 (사용자 책임 아니므로) | 콘솔 로그에 기록. 사용자는 진단 결과 자체는 봤음 |
| 이메일 형식 잘못 | 폼 단계에서 즉시 빨간 안내 | 백엔드 도달 안 함 |
| 입력 누락 (이력서 빈칸 등) | 폼 단계에서 즉시 안내 | 백엔드 도달 안 함 |

### 4.5 동작 모드: 데모 vs 실제

- **개발 환경** (`vercel dev` 로컬 실행): 환경변수 없으면 자동 데모 결과 출력 (빠른 UI 테스트용)
- **운영 환경**: 환경변수 있고 정상 호출 → 진짜 결과. 호출 실패 → 에러 메시지 (데모 fallback 안 함, 사용자 혼란 방지)

### 4.6 테스트 방식

- **로컬**: Vercel CLI 설치 후 `vercel dev` → `localhost:3000/diagnosis` 접속 → UI 확인
- **스테이징**: Vercel은 PR마다 자동으로 미리보기 URL 생성 → 거기서 실제 키로 테스트
- **운영**: `main` 브랜치 푸시 시 자동 배포. 첫 배포 후 본인이 시나리오 끝까지 한 번 돌려서 운영자 메일 도착하는지 확인

---

## 5. 사용자 액션 항목 (본인이 직접 하실 단계)

> 코드 작업은 다음 단계(구현 플랜)에서 Claude가 다 합니다. 아래는 외부 서비스 가입 및 키 발급.
> 구현 시작 전에만 끝나면 됩니다.

### 5.1 Anthropic Console — 자동 충전 OFF 확인 ⏱ 2분

> Prepaid $20 크레딧이 절대 한도가 되도록 설정.

1. https://console.anthropic.com 로그인
2. **Plans & Billing** → **Auto-reload** 항목 확인
3. **OFF 상태인지 확인**. 켜져 있으면 끔.

> 이렇게 하면 $20 다 쓰는 순간 자동으로 호출이 멈춥니다 (= 본인 카드는 안 빠짐). 진단 호출 1회당 약 $0.03~0.05이라 약 400~600회 가능.

### 5.2 Resend 가입 + API 키 발급 ⏱ 5~10분

> 운영자 알림 메일 발송용. 무료 티어로 충분.

1. https://resend.com → **Sign Up** (구글 로그인 가능)
2. **반드시 `naminimiya@gmail.com` 으로 가입.** 
   (도메인 미인증 + 무료 티어 상태에서는 Resend가 가입 이메일로만 발송 가능. 우리 시나리오는 운영자=본인=naminimiya@gmail.com 이므로 일치 필요)
3. 대시보드 → **API Keys** → **+ Create API Key**
4. 이름: `aro-landing` (아무거나) / Permission: **Full access**
5. 발급된 `re_...` 키 즉시 복사해 안전한 곳에 메모 (창 닫으면 다시 못 봄)
6. 도메인 인증은 하지 않아도 됨. 발신자가 `onboarding@resend.dev`로 표시되지만 본인 메일함 도착엔 문제없음. 첫 발송은 스팸함도 확인.

### 5.3 Cloudflare Turnstile 가입 + 사이트 등록 ⏱ 15~20분

> 봇 차단용. 무료.

1. https://www.cloudflare.com → 가입 (이미 계정 있으면 로그인)
2. 좌측 메뉴 → **Turnstile** → **Add site**
3. 입력값:
   - **Site name**: `aro-landing` (아무거나)
   - **Domain**: 본인 Vercel 운영 URL (예: `aro-career.vercel.app`)
   - 추가 도메인 칸에 `localhost` 도 넣기 (로컬 테스트용)
   - **Widget Mode**: **Managed** 선택
4. 생성 완료되면 **Site Key** 와 **Secret Key** 두 개 발급됨 → 둘 다 메모

> Site Key는 브라우저에 노출되어도 안전. Secret Key는 백엔드용이라 절대 노출 X.

### 5.4 Vercel 환경변수 등록 ⏱ 5분

> 위에서 받은 키들을 Vercel 대시보드에 등록.

1. https://vercel.com 로그인 → `aro-landing` 프로젝트 선택
2. **Settings** → **Environment Variables**
3. 4개 키를 하나씩 추가:

| Name | Value | Environment |
|---|---|---|
| `ANTHROPIC_API_KEY` | (Anthropic의 `sk-ant-...`) | Production, Preview, Development 모두 체크 |
| `RESEND_API_KEY` | (Resend의 `re_...`) | 모두 체크 |
| `TURNSTILE_SITE_KEY` | (Cloudflare Site Key) | 모두 체크 |
| `TURNSTILE_SECRET_KEY` | (Cloudflare Secret Key) | 모두 체크 |

4. 모두 등록 후 → **Deployments** 탭 → 최신 배포의 **"..."** 메뉴 → **Redeploy** 클릭 (환경변수 적용 위해 한 번 재배포 필요)

### 5.5 (선택) Vercel CLI 로컬 테스트 ⏱ 10분

> 본인이 로컬에서 직접 테스트해보고 싶으실 경우만. 건너뛰어도 무방.

```bash
npm install -g vercel
cd C:\Users\user\Desktop\aro-landing
vercel link        # 본인 Vercel 프로젝트랑 폴더 연결 (한 번만)
vercel env pull    # 환경변수를 .env.local로 다운로드 (자동 .gitignore됨)
vercel dev         # localhost:3000에서 백엔드 함수 포함 미리보기
```

### 5.6 본인이 메모해두실 키 4개

```
□ ANTHROPIC_API_KEY    : sk-ant-...
□ RESEND_API_KEY       : re_...
□ TURNSTILE_SITE_KEY   : (Cloudflare Site Key)
□ TURNSTILE_SECRET_KEY : (Cloudflare Secret Key)
```

⚠️ 이 키들을 메신저나 메일에 평문으로 보내지 말 것. 비밀번호 관리자(1Password, Bitwarden) 또는 로컬 메모장에 보관.

---

## 6. 다음 단계

본 문서가 사용자 검토를 통과하면 → Claude의 `writing-plans` 스킬로 **단계별 구현 플랜**을 작성. 이후 그 플랜에 따라 코드 작업 진행.

---

## 7. 변경 이력

- 2026-04-29: 초안 생성. 섹션 1 합의.
- 2026-04-29: 섹션 2(보안·에러 처리), 섹션 3(사용자 액션 항목) 합의 및 추가. Anthropic 결제 구조를 Prepaid $20 절대한도 + Auto-reload OFF로 명확화. Resend 가입 이메일 = 운영자 이메일 일치 필요 명시.
