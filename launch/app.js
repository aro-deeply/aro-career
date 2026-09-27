// 화면 움직임과 리포트 탭. 이 파일이 실행되지 않으면 head의 안전장치가 .js를 떼어 모든 내용이 그대로 보인다.
window.__aroReady = true;

const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── 헤더 배경과 스크롤 진행선 ──
const header = document.querySelector('#site-header');
const progress = document.createElement('div');
progress.className = 'progress';
progress.setAttribute('aria-hidden', 'true');
document.body.prepend(progress);

function syncScrollState() {
  header.classList.toggle('is-scrolled', window.scrollY > 8);
  const max = root.scrollHeight - window.innerHeight;
  progress.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : 0);
}
syncScrollState();
window.addEventListener('scroll', syncScrollState, {passive: true});

// ── 제목을 줄 단위로 쪼개 한 줄씩 올라오게 ──
function splitHeadingIntoLines(heading) {
  const lines = heading.innerHTML.split(/<br\s*\/?>/i);
  heading.innerHTML = lines
    .map((html, i) => `<span class="line" style="--d:${(i * 0.09).toFixed(2)}s"><span>${html.trim()}</span></span>`)
    .join('');
}
const headings = document.querySelectorAll('.display, .title, .about-title, .cta-title');
headings.forEach(splitHeadingIntoLines);

// ── 떠오르며 나타날 요소들: 같은 묶음 안에서는 순서대로 조금씩 늦게 ──
const revealGroups = [
  '.hero .announce, .hero .hero-lead, .hero .actions, .hero .hero-proof',
  '.help-grid > *',
  '.eyebrow',
  '.section-lead, .fine, .ai-actions, .sub-title, .margin-note',
  '.flow-step',
  '.qa li',
  '.compare, .patterns',
  '.service-item',
  '.steps li',
  '.report',
  '.faq details',
  '.about-text, .about-sign',
  '.cta-lead, .cta .actions, .cta-mail',
];
for (const selector of revealGroups) {
  const byParent = new Map();
  document.querySelectorAll(selector).forEach(el => {
    const siblings = byParent.get(el.parentElement) || [];
    siblings.push(el);
    byParent.set(el.parentElement, siblings);
  });
  for (const siblings of byParent.values()) {
    siblings.forEach((el, i) => {
      el.setAttribute('data-reveal', '');
      el.style.setProperty('--d', `${Math.min(i * 0.08, 0.4).toFixed(2)}s`);
    });
  }
}

// ── 다듬은 문장을 한 글자씩 나타나게 ──
function splitIntoCharacters(el) {
  let index = 0;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    for (const char of node.textContent) {
      const span = document.createElement('span');
      span.className = 'ch';
      span.style.setProperty('--i', index++);
      span.textContent = char;
      fragment.append(span);
    }
    node.replaceWith(fragment);
  }
  el.setAttribute('aria-label', el.textContent);
}
document.querySelectorAll('[data-type]').forEach(splitIntoCharacters);

// ── 숫자가 0부터 올라가게 ──
function countUp(el) {
  const textNode = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE && /\d/.test(n.textContent));
  if (!textNode || reduceMotion) return;
  // 목표값은 처음 한 번만 읽어 둔다. 다시 재생할 때 중간값을 목표로 오해하지 않게.
  el.dataset.target ??= textNode.textContent;
  const original = el.dataset.target;
  const target = Number(original.match(/\d+/)[0]);
  const start = performance.now();
  const duration = 1300;
  const token = Symbol();
  el.countToken = token;
  function show(value) {
    if (el.countToken === token) textNode.textContent = original.replace(/\d+/, String(value));
  }
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    show(Math.round(target * (1 - Math.pow(1 - t, 3))));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  // 화면 갱신이 멈춘 탭에서도 최종값은 반드시 맞춘다.
  setTimeout(() => show(target), duration + 150);
}

function playBars(list) {
  list.querySelectorAll('.bar').forEach((bar, i) => {
    bar.style.setProperty('--d', `${(i * 0.1).toFixed(2)}s`);
    countUp(bar.querySelector('.bar-val'));
  });
}

// ── 대화: 한 메시지씩, ARO 답 앞에는 '입력 중' 표시 ──
function playChat(chat) {
  const messages = [...chat.querySelectorAll('.msg')];
  if (reduceMotion) {
    messages.forEach(m => { if (!m.matches('.msg--typing')) m.classList.add('show'); });
    chat.classList.add('flagged');
    return;
  }
  let delay = 150;
  messages.forEach(message => {
    const isTyping = message.matches('.msg--typing');
    setTimeout(() => {
      message.classList.add('show');
      // 첫 답이 나온 뒤 모호한 표현에 밑줄
      if (message.querySelector('.vague')) setTimeout(() => chat.classList.add('flagged'), 450);
      if (isTyping) setTimeout(() => message.classList.remove('show'), 1100);
    }, delay);
    delay += isTyping ? 1100 : 900;
  });
}

// ── 추천 단계: 하나씩 훑은 뒤 추천에 멈춘다 ──
function playNextSteps(next) {
  const steps = [...next.querySelectorAll('.next-step')];
  if (reduceMotion) { next.classList.add('done'); return; }
  const order = [...steps, ...steps];
  order.forEach((step, i) => {
    setTimeout(() => {
      steps.forEach(s => s.classList.toggle('scan', s === step));
    }, 300 + i * 220);
  });
  setTimeout(() => {
    steps.forEach(s => s.classList.remove('scan'));
    next.classList.add('done');
  }, 300 + order.length * 220);
}

// ── 화면에 들어오면 .is-in ──
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const el = entry.target;
    el.classList.add('is-in');
    if (el.matches('.bars')) playBars(el);
    if (el.matches('.chat-seq')) playChat(el);
    if (el.matches('.next')) playNextSteps(el);
    observer.unobserve(el);
  }
}, {rootMargin: '0px 0px -10% 0px', threshold: 0.15});

document.querySelectorAll('[data-reveal], .display, .title, .about-title, .cta-title, .flow, .demo, .chat, .chat-seq, .next').forEach(el => observer.observe(el));
document.querySelectorAll('.bars').forEach(el => {
  if (!el.closest('[hidden]')) observer.observe(el);
});

// ── 리포트 탭 ──
const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));

function selectTab(index, {focus = false, replay = true} = {}) {
  tabs.forEach((tab, i) => {
    const selected = i === index;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    panels[i].hidden = !selected;
  });
  if (focus) tabs[index].focus();
  const bars = panels[index].querySelector('.bars');
  if (bars && replay) {
    // 트랜지션 없이 0으로 되돌린 뒤 다시 채운다
    bars.classList.add('is-reset');
    bars.classList.remove('is-in');
    void bars.offsetWidth;
    bars.classList.remove('is-reset');
    bars.classList.add('is-in');
    playBars(bars);
  }
}

if (tabs.length) {
  selectTab(0, {replay: false});
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(i));
    tab.addEventListener('keydown', event => {
      const keys = {ArrowRight: 1, ArrowLeft: -1};
      if (event.key in keys) {
        event.preventDefault();
        selectTab((i + keys[event.key] + tabs.length) % tabs.length, {focus: true});
      } else if (event.key === 'Home') {
        event.preventDefault();
        selectTab(0, {focus: true});
      } else if (event.key === 'End') {
        event.preventDefault();
        selectTab(tabs.length - 1, {focus: true});
      }
    });
  });
}
