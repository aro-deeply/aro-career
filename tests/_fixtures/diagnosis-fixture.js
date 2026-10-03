export const FIXTURE_DIAGNOSIS = {
  root_cause: "pattern_05",
  dominant_pattern: "pattern_05",
  pattern_scores: {
    pattern_01_generic_template: 0.78,
    pattern_02_unsupported_claims: 0.62,
    pattern_03_differentiation_mishandling: 0.41,
    pattern_04_job_fit_mismatch: 0.55,
    pattern_05_industry_context_absence: 0.88,
  },
  evidence: [
    {
      quote: "귀사의 인재상에 부합하는 성실하고 책임감 있는 인재가 되겠습니다.",
      signal: "Pattern 05 · 귀사 호칭 · 범용 문구",
      why: "범용 구문입니다.",
    },
  ],
  root_diagnosis: "근본 원인은 **지원 회사 이해의 공백**입니다.",
  key_verdict: "업계 맥락 부재에서 비롯된 구조입니다.",
  one_pager_summary:
    "근본 원인은 **회사 이해 공백**입니다.\n\n표면 증상은 정형성입니다. **본인의 기여 범위가 가려집니다**.",
  correctability: "교정 가능",
  next_step_recommendation: "Rewrite",
  self_reflection_questions: ["질문 1?", "질문 2?", "질문 3?"],
};

export const FIXTURE_LEAD = {
  name: "테스트 신청자",
  email: "test@example.com",
  submittedAt: "2026-05-05 12:00:00",
  diagnosis: FIXTURE_DIAGNOSIS,
};

// 바뀐 보고서 형식(format 2). 합성 이력서(tests/eval/inputs.js case-01)에 대한 실제 엔진 출력을 검사한 결과다.
export const FIXTURE_DIAGNOSIS_V2 = {
  "format": 2,
  "key_verdict": "'귀사'와 '성실, 책임감'만 보여 어느 브랜드에도 낼 수 있는 글이에요",
  "root_diagnosis": "'귀사의 인재상에 부합하는 성실하고 책임감 있는 인재'는 어느 회사에 내도 똑같이 성립하는 문장이라서, 이 브랜드와 MD 직무를 이해하고 썼다는 인상이 남지 않아요. 전공, 동아리, 아르바이트가 모두 '능력을 키웠습니다'로만 끝나 무엇을 직접 했는지 보이지 않고, MD가 하는 일(상품 기획, 수요 예측, 판매 분석)과 연결된 대목도 찾기 어려워요. 경험이 적다는 고민보다, 있는 경험을 MD 업무의 언어로 풀지 않은 점이 더 크게 걸려요.",
  "root_cause": "pattern_05",
  "dominant_pattern": "pattern_05",
  "pattern_scores": {
    "pattern_01_generic_template": 0.85,
    "pattern_02_unsupported_claims": 0.55,
    "pattern_03_differentiation_mishandling": 0.3,
    "pattern_04_job_fit_mismatch": 0.7,
    "pattern_05_industry_context_absence": 0.92
  },
  "evidence": [
    {
      "quote": "귀사의 인재상에 부합하는 성실하고 책임감 있는 인재가 되겠습니다.",
      "pattern": "pattern_05",
      "why": "'귀사'라는 호칭과 '인재상'이라는 말만 있고 어떤 브랜드인지 드러나지 않아, 복사해서 붙인 문장으로 읽혀요.",
      "fill": "지원하는 브랜드의 타깃 고객, 주력 카테고리, 최근 시즌 상품 중 직접 살펴본 것은 무엇이고, 그중 MD 관점에서 눈에 들어온 점은 무엇이었나요?",
      "signal": "업계 맥락 부재"
    },
    {
      "quote": "학교 동아리에서 의류 박람회를 기획하며 책임감과 적극성을 키웠고",
      "pattern": "pattern_02",
      "why": "기획했다는 사실은 좋은데, 맡은 역할과 결과가 없어 '책임감'이라는 주장만 남아요.",
      "fill": "박람회에서 본인이 직접 맡은 일은 무엇이었고, 그 과정에서 내린 판단이나 확인할 수 있는 결과(참가 규모, 판매, 방문 등)는 무엇이었나요?",
      "signal": "근거 부재와 과장"
    },
    {
      "quote": "의류 매장 아르바이트를 통해 고객 응대 능력을 길렀습니다.",
      "pattern": "pattern_04",
      "why": "MD는 고객이 무엇을 사고 무엇을 두고 가는지 읽는 직무인데, 응대 능력으로만 쓰면 직무와의 연결이 약해요.",
      "fill": "매장에서 어떤 상품이 잘 팔리거나 안 팔렸고, 그 이유를 어떻게 파악했나요?",
      "signal": "직무 적합성 어긋남"
    }
  ],
  "interview_questions": [
    {
      "question": "지원한 브랜드가 경쟁 브랜드와 다른 점은 무엇이라고 보세요?",
      "checks": "브랜드와 시장에 대한 실제 이해도를 확인하려는 질문이에요.",
      "answer_point": "브랜드 매장, 온라인몰, 시즌 상품을 직접 살펴본 내용만 근거로 준비해 보세요. 본 적 없는 내용을 아는 것처럼 말하지 않는 편이 안전해요."
    },
    {
      "question": "동아리 박람회 기획에서 본인이 직접 맡은 역할은 무엇이었나요?",
      "checks": "팀 성과와 개인 기여를 구분해서 말할 수 있는지 확인하려는 질문이에요.",
      "answer_point": "결론, 맡은 일, 판단한 순간 순서로 짧게 말하는 연습을 해 보세요. 답이 길어지는 문제는 시간순으로 다 설명하려는 습관에서 나와요."
    },
    {
      "question": "매장 아르바이트에서 상품이나 고객에 대해 알게 된 점이 있다면 무엇인가요?",
      "checks": "현장 경험을 MD 관점의 관찰로 바꿔 말할 수 있는지 확인하려는 질문이에요.",
      "answer_point": "실제로 본 장면 하나를 골라 관찰, 해석, 배운 점 순서로 준비해 보세요. 수치를 부풀리지 말고 아는 사실만 쓰세요."
    }
  ],
  "plan": {
    "drop": "'귀사', '성실하고 책임감 있는 인재', '다양한 과제', '소통 능력을 키웠습니다', '어떤 업무가 주어지더라도 빠르게 적응하여' 같은 어느 회사에나 맞는 표현은 지워 보세요.",
    "keep": "앞세울 근거는 의류 박람회 기획 경험과 매장 아르바이트예요. 다만 지금은 역할과 결과가 비어 있어서, 각각 직접 한 일을 채우면 쓸 수 있어요.",
    "rebuild": "첫 문장에서 지원 브랜드와 MD 직무를 향한 관점을 먼저 보여 주세요. 이어서 박람회와 매장 경험을 '시작, 내가 직접 한 일, 지금 남은 것' 순서로 짜고, 상품·고객·판매를 본 장면 중심으로 쓰면 신입 MD에게 맞는 열정과 도전이 드러나요."
  },
  "correctability": "교정 가능하나 재검토 필요",
  "next_step_recommendation": "Rewrite",
  "self_reflection_questions": [
    "지원한 브랜드가 경쟁 브랜드와 다른 점은 무엇이라고 보세요?",
    "동아리 박람회 기획에서 본인이 직접 맡은 역할은 무엇이었나요?",
    "매장 아르바이트에서 상품이나 고객에 대해 알게 된 점이 있다면 무엇인가요?"
  ],
  "one_pager_summary": "**버릴 표현** '귀사', '성실하고 책임감 있는 인재', '다양한 과제', '소통 능력을 키웠습니다', '어떤 업무가 주어지더라도 빠르게 적응하여' 같은 어느 회사에나 맞는 표현은 지워 보세요.\n\n**살릴 근거** 앞세울 근거는 의류 박람회 기획 경험과 매장 아르바이트예요. 다만 지금은 역할과 결과가 비어 있어서, 각각 직접 한 일을 채우면 쓸 수 있어요.\n\n**다시 짤 방향** 첫 문장에서 지원 브랜드와 MD 직무를 향한 관점을 먼저 보여 주세요. 이어서 박람회와 매장 경험을 '시작, 내가 직접 한 일, 지금 남은 것' 순서로 짜고, 상품·고객·판매를 본 장면 중심으로 쓰면 신입 MD에게 맞는 열정과 도전이 드러나요."
};
