<!--
이 파일은 프로젝트 루트의 CLAUDE.md에 추가될 스니펫이다.
설치 시 Claude가 아래 "---8<---" 사이의 내용을 CLAUDE.md에 append한다.
이미 동일 섹션이 있으면 추가하지 않는다.
-->

---8<--- BEGIN intent-review-principles ---8<---

## 코드 원칙 (상세: `docs/intent-review-universal/GUIDE.md`)

> "이 코드를 주석으로 설명해야 한다면, 함수로 추출하라."

함수명은 약속이다. 함수명과 실제 동작이 일치할수록 AI와 동료가 코드를 오해하지 않는다. `intent-review` 스킬이 이 원칙을 기준으로 코드를 점검한다.

### 기본 규칙

- **도메인 규칙은 명명 함수로 분리**한다. 인라인 `if`가 중요한 규칙을 담고 있다면 함수로 뽑아 이름을 붙인다.
- **버그 수정 후 자문**한다: "이 수정이 도메인 규칙인가?" YES면 명명 함수로 분리해 재발 방지.
- **함수 이름과 속이 맞는지** 늘 점검한다. 이름이 약속하는 것보다 더 많은 일을 하는 함수는 리팩토링 후보다.

### 사용 방법

함수를 크게 수정했거나 새 기능을 추가했을 때:

```
intent-review 돌려줘
```

또는 특정 파일만:

```
intent-review <파일경로> 대상으로 돌려줘
```

보고서 끝에 "분산된 의도 ≥ 3건" 권고가 뜨면 `/architecture-review`로 넘어갈 타이밍.

### 상세 참고

- 평가 기준(별점, CQS), 판별 플로우차트, 예측 가능성 프레임워크: **`docs/intent-review-universal/GUIDE.md`**
- 스킬 실행 규약, 보고서 템플릿: `.claude/skills/intent-review/SKILL.md`

---8<--- END intent-review-principles ---8<---
