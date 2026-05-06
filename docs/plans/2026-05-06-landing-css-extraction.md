# 랜딩 페이지 CSS·JS 분리 마이그레이션 플랜

- 작성일: 2026-05-06
- 대상 파일: `index.html` (현재 1,761줄, 인라인 CSS·JS 포함)
- 목적: 디자인 개편 시 영향 범위 축소, 캐시 효율, 유지보수성

---

## 현재 구조

```
index.html (~82KB)
├── 1~135  : <head> 메타 + JSON-LD + 외부 폰트
├── 136~1183 : <style>...</style>  ← 약 1,050줄 인라인 CSS
├── 1184~1626 : <body> 마크업
└── 1628~1759 : <script>...</script>  ← 약 130줄 인라인 JS (탭, 모바일 nav, IntersectionObserver)
```

## 목표 구조

```
index.html  (~50줄, 마크업만)
src/landing.css  ← 분리된 스타일 (CSS 변수, 컴포넌트별 섹션)
src/landing.js   ← 분리된 스크립트 (탭, nav, reveal)
```

---

## 단계별 작업

### Step 1 — JS 분리 (가장 안전, 영향 범위 작음)

1. `src/landing.js` 생성
2. `index.html`의 `<script>` 태그 안 IIFE 본문을 그대로 옮김
3. `index.html`에서 해당 `<script>` 블록을 다음으로 교체:
   ```html
   <script type="module" src="/src/landing.js"></script>
   ```
4. `vite.config.js`의 `rollupOptions.input.main`은 그대로 (index.html이 entry이므로 vite가 자동으로 번들).
5. `npm run build` → `dist/` 안에 해시된 `landing-*.js`가 생성되고 index.html에 반영되는지 확인.
6. `vercel dev` 또는 `npm run preview`로 탭 클릭·모바일 nav·reveal 애니메이션 모두 동작 확인.
7. 커밋: `refactor(landing): extract inline JS to src/landing.js`

### Step 2 — CSS 변수·base 분리 (점진적)

1. `src/landing.css` 생성
2. 먼저 `:root { ... }` (CSS 변수, 약 30줄)와 `body`/`*` 같은 base 셀렉터만 옮김
3. `index.html` `<head>`에 추가:
   ```html
   <link rel="stylesheet" href="/src/landing.css">
   ```
4. 인라인 `<style>`에서 옮긴 부분만 삭제. 나머지 컴포넌트별 스타일은 일단 유지.
5. 빌드 + 시각적 회귀 없는지 확인.
6. 커밋: `refactor(landing): extract CSS variables and base styles`

### Step 3 — 섹션별 CSS 분리 (반복)

다음 순서로 한 번에 한 섹션씩:
- `.nav` / `.hero` (헤더·히어로)
- `.problems` / `.preview` (셀프체크·프리뷰)
- `.evaluator` / `.cases` (평가자·사례)
- `.method` / `.director` (방식·디렉터)
- `.appendix` / `.final` / `footer` (프로그램·FAQ·최종 CTA)

각 단계마다:
1. 해당 섹션 CSS를 `src/landing.css`에 옮김 (구역별 주석 추가)
2. 인라인 `<style>`에서 삭제
3. 빌드 + 해당 섹션 시각 확인
4. 커밋

### Step 4 — 마지막 정리

1. 인라인 `<style>` 블록 완전히 제거 (혹은 critical CSS 일부만 남기는 옵션 검토)
2. `index.html` ≤ 200줄 수준으로 정리
3. README에 "랜딩 스타일은 `src/landing.css`에서 관리" 명시

---

## 주의사항

- **시각 회귀를 막기 위해 단계마다 시각 확인 필수.** 한 번에 다 옮기면 어디서 깨졌는지 추적이 어렵습니다.
- 미디어 쿼리(`@media`)는 같은 셀렉터의 base 스타일과 함께 옮기세요. 분리되면 cascade 순서가 어긋날 수 있습니다.
- `body`/`html`의 폰트 설정은 base에서 한 번만 적용 — 중복 선언 주의.
- Pretendard CDN, Noto Serif CDN 같은 외부 폰트 import는 인라인 유지 (HTML preload 효과 유지).

## 예상 소요

- Step 1 (JS): 30분 (작업) + 15분 (검증)
- Step 2 (CSS base): 20분
- Step 3 (섹션별): 섹션당 약 20분 × 5 = 100분
- Step 4 (정리): 30분
- **총 약 3~4시간을 1~2회 분할 진행 권장**

## 완료 지표

- `index.html` 파일 크기 < 30KB
- `src/landing.css` 외부 캐시 가능 (다음 방문 빠름)
- `npm run build`가 통과
- 시각적 차이 0 (Lighthouse 점수 동일·CLS 변동 없음)
