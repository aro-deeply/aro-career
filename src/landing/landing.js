import { KAKAO_CHANNEL_URL, OPERATOR_EMAIL } from "../shared/contact.js";
import { parseLandingRoute, getPreviousLandingRoute } from "./flow.js";

const content = document.querySelector("#landing-content");
const startMarkup = content.innerHTML;

const EXAMPLES = {
  resume: {
    label: "서류에 쓸 내용",
    title: "이 문장에, 내 역할이 보이나요?",
    statement: "프로젝트를 성공적으로 진행했습니다.",
    question: "진행 중 어떤 문제를 직접 맡았나요?",
    checking: "맡은 일, 선택한 이유, 확인할 자료",
    explanation: "팀의 결과와 내가 한 일을 나눠 살펴봐요.",
    note: "내가 맡은 부분은?",
    number: "01",
  },
  portfolio: {
    label: "포트폴리오 속 내 역할",
    title: "결과물 옆에, 내 선택이 보이나요?",
    statement: "팀과 함께 서비스 화면을 만들었습니다.",
    question: "어떤 화면을 맡고, 왜 그렇게 구성했나요?",
    checking: "담당 범위와 결정 과정이 담긴 기록",
    explanation: "기술 평가와 디자인 제작은 범위를 먼저 확인해요.",
    note: "내가 결정한 부분은?",
    number: "02",
  },
  interview: {
    label: "면접에서 경험 설명하기",
    title: "답변 속, 선택의 이유를 짚어봐요.",
    statement: "소통을 통해 갈등을 해결했습니다.",
    question: "의견이 달랐을 때, 무엇을 기준으로 정했나요?",
    checking: "당시 상황, 직접 한 말, 이후 확인된 변화",
    explanation: "평가자가 물어볼 지점을 질문으로 확인해요.",
    note: "왜 그렇게 판단했나요?",
    number: "03",
  },
  unsure: {
    label: "막히는 지점 찾기",
    title: "경험 하나부터, 함께 살펴봐요.",
    statement: "여러 경험 중 무엇을 써야 할지 모르겠어요.",
    question: "지원하는 일과 맞닿은 경험은 무엇인가요?",
    checking: "지원 공고, 맡은 일, 설명하기 막힌 지점",
    explanation: "공고가 아직 없으면 관심 있는 일부터 살펴봐요.",
    note: "먼저 살펴볼 경험은?",
    number: "04",
  },
};

const METHOD_STEPS = {
  1: {
    label: "상담 전",
    title: "먼저, 물어볼 지점을 찾습니다.",
    description: "지원 공고와 경험을 함께 읽어요.<br />더 확인할 내용을 질문으로 준비해요.",
    documentTitle: "상담 전 질문 메모",
    documentLabel: "준비 방식 제안",
    rows: [
      ["지원 공고", "어떤 일을 맡게 되나요?"],
      ["내 경험", "직접 한 일은 어디까지인가요?"],
      ["확인할 것", "선택의 이유를 설명할 수 있나요?"],
    ],
    next: "#method/2",
    nextLabel: "상담 중에는요?",
  },
  2: {
    label: "상담 중",
    title: "내가 한 일과 판단을 짚습니다.",
    description: "본인이 맡은 일과 선택한 이유를 물어요.<br />그 설명을 뒷받침할 근거도 함께 살펴봐요.",
    documentTitle: "경험을 살펴보는 세 질문",
    documentLabel: "대화 방식 제안",
    rows: [
      ["내 역할", "팀의 일 중 직접 맡은 일은 무엇인가요?"],
      ["내 판단", "다른 방법 대신, 왜 그 방법을 골랐나요?"],
      ["확인할 근거", "그 과정을 확인할 기록이 있나요?"],
    ],
    next: "#method/3",
    nextLabel: "상담 후에는요?",
  },
  3: {
    label: "상담 후",
    title: "다음에 할 일을 기록으로 남깁니다.",
    description: "함께 고른 경험과 빠진 사실을 정리해요.<br />이어서 준비할 일을 기록하는 방식이에요.",
    documentTitle: "상담 후 정리 노트",
    documentLabel: "새 제공 방식 제안",
    rows: [
      ["고른 경험", "지원하는 일과 연결할 경험"],
      ["더 확인할 사실", "아직 근거가 부족한 내용"],
      ["다음 행동", "직접 보완하거나 연습할 일"],
    ],
    next: "#offer",
    nextLabel: "상담 방식·비용 보기",
  },
};

function renderBackLink(route) {
  return `<a class="back-link" href="${getPreviousLandingRoute(route)}"><span aria-hidden="true">←</span> 이전으로</a>`;
}

function renderExample(route) {
  const example = EXAMPLES[route.situation];
  return `
    <section class="content-screen example-screen" aria-labelledby="page-title">
      ${renderBackLink(route)}
      <div class="screen-heading">
        <p class="eyebrow"><span class="small-rule" aria-hidden="true"></span>${example.label}</p>
        <h1 id="page-title" tabindex="-1">${example.title}</h1>
      </div>
      <div class="example-layout">
        <figure class="example-figure">
          <figcaption class="caption">설명을 위한 가상 예시</figcaption>
          <div class="example-paper">
            <div class="paper-topline"><span>작성한 문장</span><span aria-hidden="true">${example.number} / ARO</span></div>
            <blockquote>“${example.statement}”</blockquote>
            <div class="paper-lines" aria-hidden="true"><i></i><i></i><i></i></div>
            <div class="paper-annotation"><span class="annotation-rule" aria-hidden="true"></span>${example.note}</div>
          </div>
        </figure>
        <div class="example-reading">
          <p class="eyebrow">함께 짚어볼 질문</p>
          <h2>${example.question}</h2>
          <div class="verification-note">
            <p class="caption">답을 쓰기 전, 확인할 것</p>
            <p>${example.checking}</p>
          </div>
          <p class="muted">${example.explanation}</p>
        </div>
      </div>
      <div class="actions">
        <a class="button button--primary" href="#method/1">이렇게 상담해요 <span aria-hidden="true">→</span></a>
        <a class="button button--text" href="#start">다른 고민 고르기</a>
      </div>
    </section>`;
}

function renderMethodDisclosure(step) {
  if (step === 1) {
    return `<details class="quiet-details">
      <summary>누가 함께 보나요?</summary>
      <div class="details-body"><p class="lead">약 16년, 기업 HR(인사) 경험</p>
      <p>채용·평가·교육·인사제도를 기획하고 운영했어요.<br />개인 구직자 취업·면접 상담 경험이 있어요.</p></div>
    </details>`;
  }
  if (step === 2) {
    return `<details class="quiet-details">
      <summary>AI는 어떻게 활용하나요?</summary>
      <div class="details-body"><p class="caption">활용 방향 제안</p>
      <p>AI(인공지능)는 정리를 돕는 용도로 제안해요.<br />경험의 의미와 준비 방향은 사람이 함께 판단해요.</p></div>
    </details>`;
  }
  return `<p class="method-note">기록의 상세 항목과 제공 범위는 문의 후 확인해요.</p>`;
}

function renderMethod(route) {
  const method = METHOD_STEPS[route.step];
  const progress = Object.entries(METHOD_STEPS).map(([step, item]) =>
    `<li><a href="#method/${step}" ${Number(step) === route.step ? 'aria-current="step"' : ""}><span>${step.padStart(2, "0")}</span>${item.label}</a></li>`
  ).join("");
  const rows = method.rows.map(([term, detail]) =>
    `<div class="note-row"><dt>${term}</dt><dd>${detail}</dd></div>`
  ).join("");
  return `
    <section class="content-screen method-screen" aria-labelledby="page-title">
      ${renderBackLink(route)}
      <nav aria-label="상담의 세 단계"><ol class="method-progress">${progress}</ol></nav>
      <div class="method-layout">
        <div class="method-intro">
          <p class="eyebrow">상담 방식 제안 · ${route.step} / 3</p>
          <h1 id="page-title" tabindex="-1">${method.title}</h1>
          <p class="lead">${method.description}</p>
          ${renderMethodDisclosure(route.step)}
        </div>
        <div class="method-paper">
          <p class="paper-topline"><span>${method.documentLabel}</span><span aria-hidden="true">ARO</span></p>
          <h2>${method.documentTitle}</h2>
          <dl class="note-rows">${rows}</dl>
          <div class="paper-bottomline" aria-hidden="true"><span></span><span>${String(route.step).padStart(2, "0")}</span></div>
        </div>
      </div>
      <div class="actions"><a class="button button--primary" href="${method.next}">${method.nextLabel} <span aria-hidden="true">→</span></a></div>
    </section>`;
}

function renderOffer(route) {
  return `
    <section class="content-screen offer-screen" aria-labelledby="page-title">
      ${renderBackLink(route)}
      <div class="screen-heading">
        <p class="eyebrow"><span class="small-rule" aria-hidden="true"></span>상담 방식·비용</p>
        <h1 id="page-title" tabindex="-1">범위와 비용을 먼저 확인해요.</h1>
      </div>
      <div class="offer-layout">
        <div class="price-panel">
          <p class="eyebrow">1:1 단일 상담</p>
          <p class="session-length">90분 · 1회</p>
          <p class="price">18<span>만원</span></p>
          <div class="price-note"><p>현재 사이트에 안내된 금액입니다.</p><p>실제 범위와 일정은 문의 후 확인해요.</p></div>
          <a class="button button--primary" href="#contact">상담 가능 여부 문의하기 <span aria-hidden="true">→</span></a>
        </div>
        <div class="offer-scope">
          <p class="eyebrow">제공 범위 제안</p>
          <h2>한 번의 상담에서 함께 볼 것</h2>
          <ul class="scope-list">
            <li><span class="list-number" aria-hidden="true">01</span><div><strong>지원 공고 1개</strong><p>어떤 일을 맡을 사람인지 함께 살펴봐요.</p></div></li>
            <li><span class="list-number" aria-hidden="true">02</span><div><strong>내 경험 2개</strong><p>직접 한 일과 판단의 근거를 짚어요.</p></div></li>
            <li><span class="list-number" aria-hidden="true">03</span><div><strong>다음 준비 행동</strong><p>보완할 사실과 이어서 할 일을 정리해요.</p></div></li>
          </ul>
        </div>
      </div>
      <div class="offer-boundaries">
        <h2>이 범위에 포함하지 않는 일</h2>
        <p>서류 전체 대필 · 디자인 완성 · 무제한 수정 · 취업 보장</p>
        <p class="muted">기술 평가와 포트폴리오 전문 검토는 먼저 문의해요.</p>
      </div>
      <details class="quiet-details legacy-offer">
        <summary>기존 3회 상담 안내 보기</summary>
        <div class="details-body"><p class="lead">3회 · 50만원</p><p>현재 사이트에 함께 안내된 금액이에요.<br />진행 여부와 상세 범위는 문의 후 확인해요.</p></div>
      </details>
    </section>`;
}

function renderContact(route) {
  return `
    <section class="content-screen contact-screen" aria-labelledby="page-title">
      ${renderBackLink(route)}
      <div class="screen-heading">
        <p class="eyebrow"><span class="small-rule" aria-hidden="true"></span>문의하기</p>
        <h1 id="page-title" tabindex="-1">지금의 고민부터 들려주세요.</h1>
        <p class="lead">문의할 때, 세 가지만 알려주세요.</p>
      </div>
      <div class="contact-layout">
        <ol class="prepare-list">
          <li><span class="list-number" aria-hidden="true">01</span><div><h2>원하는 직무</h2><p>지원하려는 일이나 관심 있는 일</p></div></li>
          <li><span class="list-number" aria-hidden="true">02</span><div><h2>현재 고민</h2><p>서류·포트폴리오·면접에서 막히는 점</p></div></li>
          <li><span class="list-number" aria-hidden="true">03</span><div><h2>준비 일정</h2><p>지원 마감일 또는 준비 중인 일정</p></div></li>
        </ol>
        <div class="contact-channels">
          <p class="eyebrow">편한 방법으로 연락해요</p>
          <a class="button button--primary" data-contact="kakao" target="_blank" rel="noopener noreferrer">카카오톡으로 문의하기 <span aria-hidden="true">↗</span></a>
          <p class="caption">카카오톡 외부 서비스로 이동해요.</p>
          <a class="button button--secondary" data-contact="email">이메일로 문의하기 <span aria-hidden="true">↗</span></a>
          <p class="caption"><span data-public-email></span> · 메일 앱</p>
          <p class="muted channel-note">상담 가능 여부와 범위를 먼저 확인해요.<br />이 화면에서 자동으로 전송되는 내용은 없어요.</p>
        </div>
      </div>
      <aside class="optional-diagnosis" aria-labelledby="optional-title">
        <div><p class="caption">선택 사항</p><h2 id="optional-title">먼저 혼자 살펴보고 싶으세요?</h2><p>진단 없이도 바로 문의할 수 있어요.</p><p class="caption">기존 진단 입력 화면으로 연결해요.<br />이 미리보기에서 결과 생성은 지원하지 않아요.</p></div>
        <a class="text-link" href="/diagnosis.html">무료 AI 진단 살펴보기 <span aria-hidden="true">↗</span></a>
      </aside>
    </section>`;
}

function connectPublicContactLinks() {
  content.querySelectorAll('[data-contact="kakao"]').forEach(link => {
    link.href = KAKAO_CHANNEL_URL;
  });
  content.querySelectorAll('[data-contact="email"]').forEach(link => {
    link.href = `mailto:${OPERATOR_EMAIL}`;
  });
  content.querySelectorAll("[data-public-email]").forEach(label => {
    label.textContent = OPERATOR_EMAIL;
  });
}

function renderRoute({ focusHeading = false } = {}) {
  const route = parseLandingRoute(window.location.hash);
  const renderers = {
    start: () => startMarkup,
    example: renderExample,
    method: renderMethod,
    offer: renderOffer,
    contact: renderContact,
  };
  content.innerHTML = renderers[route.page](route);
  connectPublicContactLinks();
  const heading = content.querySelector("h1");
  document.title = `ARO · ${heading.textContent.trim()}`;
  if (focusHeading) {
    window.scrollTo({ top: 0, behavior: "instant" });
    heading.focus({ preventScroll: true });
  }
}

function connectPreviewNotice() {
  const dialog = document.querySelector("#preview-dialog");
  document.querySelector("[data-preview-note]").addEventListener("click", event => {
    event.preventDefault();
    dialog.showModal();
  });
  document.querySelector("[data-close-preview]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    const isOutsideDialog = event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (isOutsideDialog) dialog.close();
  });
}

window.addEventListener("hashchange", () => renderRoute({ focusHeading: true }));
document.querySelector(".skip-link").addEventListener("click", event => {
  event.preventDefault();
  document.querySelector("#main-content").focus();
});
connectPreviewNotice();
renderRoute();
