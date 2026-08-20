# Intent Review — 셋업 가이드

## 📦 설치 명세 (Claude가 읽고 자동 실행)

- **종류**: 스킬 (Skill)
- **호출**: 자연어 — `intent-review 돌려줘` 또는 `intent-review <파일경로> 대상으로 돌려줘`
- **원본 본문 파일**: `docs/intent-review-universal/SKILL.md`
- **설치 위치 (프로젝트 로컬)**: `.claude/skills/intent-review/SKILL.md`
- **설치 위치 (글로벌)**: `~/.claude/skills/intent-review/SKILL.md`
- **설치 방법**: 원본을 **그대로 복사** (프론트매터 포함, 가공 불필요)
- **보조 참조 파일**: 없음
- **CLAUDE.md 스니펫**: `docs/intent-review-universal/CLAUDE-SNIPPET.md` — 프로젝트 루트 CLAUDE.md에 원칙 섹션 append 필요 (아래 참조)

사용자가 "이 스킬 설치해줘"라고 요청하면 Claude는 다음 2단계를 수행한다.

### 단계 1 — 스킬 파일 복사

```bash
mkdir -p .claude/skills/intent-review
cp docs/intent-review-universal/SKILL.md .claude/skills/intent-review/
```

### 단계 2 — CLAUDE.md 스니펫 append

프로젝트 루트에 `CLAUDE.md`가 없으면 생성한다. 이미 있으면 **중복 체크 후 append**:

1. `Read` 도구로 `CLAUDE.md`(또는 없으면 빈 내용) 확인
2. `---8<--- BEGIN intent-review-principles ---8<---` 문자열이 이미 존재하면 **건너뛴다** (중복 방지)
3. 존재하지 않으면 `docs/intent-review-universal/CLAUDE-SNIPPET.md`에서 `---8<--- BEGIN` ~ `---8<--- END` 사이의 내용을 `CLAUDE.md` 끝에 `Edit` 또는 `Write` 도구로 append

append 결과 예시:

```markdown
# 프로젝트 CLAUDE.md
(기존 내용...)

---8<--- BEGIN intent-review-principles ---8<---
## 코드 원칙 (상세: ...)
...
---8<--- END intent-review-principles ---8<---
```

BEGIN/END 마커는 **제거하지 않는다** — 다음 번 설치/업데이트 시 중복 감지용.

### 단계 3 — 설치 확인

Claude Code가 `.claude/skills/*/SKILL.md` 패턴을 자동 발견한다. 별도 등록 불필요. CLAUDE.md에 원칙 섹션이 들어갔으니 Claude는 이 프로젝트에서 코딩할 때 intent-review 원칙을 자동으로 의식한다.

---

## 왜 스킬로 두는가

intent-review는 가볍고 자주 쓰이는 점검 도구다. Description 한 줄 정도의 상시 컨텍스트 비용이 있지만, 자동 트리거 가능성(리팩토링 직후 자동 점검 등)이 그 비용을 상쇄한다. 반면 `/architecture-review`와 `/service-design`은 무겁고 드물게 쓰이므로 커맨드로 분리.

---

## 보조 자동화 (선택)

아래는 **선택 설치**다. 기본 설치만으로 스킬은 완전히 작동한다.

### 2. 스크립트 생성 (선택)

스크립트는 1차 필터 역할을 하여 Claude가 읽어야 할 코드 범위를 좁혀준다.

Claude에게 요청:
```
이 프로젝트에 맞는 intent-review 스크립트를 만들어줘
```

Claude에게 알려줄 정보:
- 프로젝트 주요 언어 (함수 선언 패턴이 달라짐)
- 소스 디렉토리 구조 (`src/`, `lib/`, `app/` 등)
- 제외할 파일 패턴 (테스트, 생성 파일, 타입 선언 등)
- 프로젝트 고유 반복 패턴이 있다면 (선택)

### 생성되는 스크립트

#### `scan.sh` — 전수 스캔

**입력**: 대상 경로 (기본: `src/`)
**출력**: 탐지 결과 파일 (`findings/scan-YYYYMMDD-HHMMSS.txt`)

**탐지 항목** (프로젝트 언어에 맞게 패턴 조정):

| 카테고리 | 탐지 대상 | 방법 |
|----------|-----------|------|
| A. Long Functions | 50줄+ 함수 (함수 선언 간 거리로 근사) | awk |
| B. Generic Verbs | `process/handle/manage/do/check/run/execute` 함수명 | grep |
| C. Conjunction Names | `And/With/Also` 포함 함수명 | grep |
| D. Multi-concern Files | 섹션 구분 주석 3개+ 파일 | grep + count |
| D-2. Multi-concern Functions | 함수 내부 섹션 마커 2개+ | awk |
| I. Deep Nesting | 들여쓰기 6단계+ | grep |

**프로젝트 특화 카테고리** (필요시 추가):
- 중복 패턴: 프로젝트에서 반복되는 특정 코드 패턴
- 매직 넘버: 도메인 상수가 리터럴로 사용된 곳
- 하드코딩 문자열: 특정 접두어의 문자열이 5회+ 반복

**한계 (AI 검증 필요)**: 마지막 함수는 파일 끝까지 길이를 잡으므로 과대평가. Grep은 문자열 매칭만 하므로 의미 판정 불가.

#### `quick-check.sh` — 단일 파일 빠른 검사

**입력**: 파일 경로 1개+
**출력**: 표준출력에 색상 경고

| 색상 | 의미 |
|------|------|
| 🔴 적색 | 80줄+ 함수 — 즉시 분해 고려 |
| 🟡 황색 | 50-79줄 함수 — 검토 필요 |
| 🔵 청색 | 3개+ 섹션 — 다중 관심사 의심 |

#### `delta-check.sh` — 커밋 간 변화량 추적

**입력**: base commit, head commit (기본: HEAD~1, HEAD)
**출력**: 변경된 함수의 길이/섹션 변화량

| 색상 | 의미 |
|------|------|
| 🔴 적색 | +20줄 이상 증가 |
| 🟡 황색 | +10줄 이상 증가 |
| 🟢 녹색 | 20줄+ 감소 (개선) |

---

## 자동화 설정

### 3. Claude Code Hook (권장)

> **전제**: 스크립트 생성(2단계)을 먼저 완료해야 한다. 스크립트 없이 Hook만 설정하면 세션 최초 Edit 시 스크립트 생성을 안내하는 컨텍스트가 표시된다.

코드 수정 시 `quick-check.sh`를 자동 실행한다.

`.claude/settings.local.json` (또는 `.claude/settings.json`)에 추가:

**TypeScript 예시** (`.ts` 파일 대상):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty'); case \"$f\" in *.test.ts|*.spec.ts|*.d.ts) exit 0;; *.ts) ;; *) exit 0;; esac; SCRIPT=.claude/skills/intent-review/quick-check.sh; if [ ! -f \"$SCRIPT\" ]; then SENTINEL=/tmp/intent-review-notified-$PPID; if [ ! -f \"$SENTINEL\" ]; then touch \"$SENTINEL\"; echo '{\"hookSpecificOutput\":{\"hookEventName\":\"PostToolUse\",\"additionalContext\":\"[intent-review] quick-check.sh가 아직 생성되지 않았습니다. SETUP.md를 참조하여 스크립트를 생성하거나, 사용자에게 intent-review 스크립트 만들어줘 라고 요청하도록 안내하세요.\"}}'; fi; exit 0; fi; [ -f \"$f\" ] && bash \"$SCRIPT\" \"$f\" 2>/dev/null || true",
            "timeout": 10,
            "statusMessage": "intent-review quick-check..."
          }
        ]
      }
    ]
  }
}
```

**다른 언어로 변경할 때**: `*.test.ts|*.spec.ts|*.d.ts`와 `*.ts` 부분을 교체

| 언어 | 대상 | 제외 |
|------|------|------|
| TypeScript | `*.ts` | `*.test.ts`, `*.spec.ts`, `*.d.ts` |
| Python | `*.py` | `*_test.py`, `*test_*.py` |
| Go | `*.go` | `*_test.go` |
| Rust | `*.rs` | `*_test.rs` (또는 tests/ 디렉토리) |

**동작 방식**:
1. Claude가 Edit/Write로 파일 수정
2. Hook이 파일 확장자 확인 (대상 언어만 통과)
3. `quick-check.sh` 존재 확인
   - 없으면: 세션당 1회 안내 메시지 출력 → 종료
   - 있으면: 해당 파일 스캔
4. 경고 출력 또는 조용히 통과
5. **비차단** — 경고가 있어도 작업은 계속 진행

### 4. Git pre-commit hook (선택)

Claude Code 외 일반 개발 워크플로우에서도 검사하려면:

```
intent-review pre-commit hook 설치해줘
```

Claude가 `install-hook.sh`를 생성하고 실행한다. 비차단 정책 — 경고만 출력, 커밋은 항상 진행.

---

## Hook vs CLAUDE.md 텍스트 지시

| 방식 | 장점 | 단점 |
|------|------|------|
| **Hook** | 확실하게 매번 실행됨 | 스크립트 + 설정 필요 |
| **CLAUDE.md 텍스트** | 설정 불필요, 즉시 사용 | Claude가 빠뜨릴 수 있음 |

**권장**: Hook으로 자동 실행 + CLAUDE.md에는 코드 원칙만 참조

---

## CLAUDE.md 연동 예시

프로젝트 CLAUDE.md에 코드 원칙을 참조하고 싶다면:

```markdown
## 코드 원칙 (상세: `.claude/skills/intent-review/SKILL.md`)

- 도메인 규칙 → 명명 함수로 추출
- 함수 수정 후 자가 검증: PostToolUse hook이 자동 실행
```
