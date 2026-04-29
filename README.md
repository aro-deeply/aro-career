# ARO

면접관 시선의 이력서 AI 진단 + 랜딩페이지.

- 운영: https://aro-career.vercel.app
- 진단: https://aro-career.vercel.app/diagnosis

## 구조

```
index.html         랜딩페이지
diagnosis.html     React 진단 페이지 (Babel CDN, 빌드 도구 없음)
api/diagnose.js    Vercel Serverless · Turnstile + Claude 호출
api/lead.js        Vercel Serverless · Resend 운영자 알림
vercel.json        cleanUrls 설정
```

## 환경변수 (Vercel)

`ANTHROPIC_API_KEY` · `RESEND_API_KEY` · `TURNSTILE_SITE_KEY` · `TURNSTILE_SECRET_KEY`

## 외부 서비스

| 서비스 | 용도 | 콘솔 |
|---|---|---|
| Anthropic | Claude API (진단) | console.anthropic.com |
| Resend | 운영자 알림 메일 | resend.com |
| Cloudflare Turnstile | 봇 차단 | dash.cloudflare.com |

## 자세한 자료

- **[DESIGN.md](DESIGN.md)** — 설계 결정 사항 (왜 이렇게 만들었나)
- **[PLAN.md](PLAN.md)** — 구현 플랜 (어떻게 만들었나)
- **[RUNBOOK.md](RUNBOOK.md)** — 운영 매뉴얼 (앞으로 어떻게 굴릴까) ⭐ 평소 참조
