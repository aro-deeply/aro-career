// ARO 랜딩: 머리 줄 구분선, 그리고 펜 자국이 화면에 들어올 때 한 번 그려지게 하는 것만 한다.
window.__aroReady = true;

const header = document.querySelector('#site-header');
function syncScrollState() {
  header?.classList.toggle('is-scrolled', window.scrollY > 4);
}
syncScrollState();
window.addEventListener('scroll', syncScrollState, {passive: true});

// Each section is marked once when it is mostly in view; CSS draws its pen marks and shows its notes.
const blocks = document.querySelectorAll('.block');
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  }, {rootMargin: '0px 0px -18% 0px', threshold: 0.12});
  blocks.forEach(block => observer.observe(block));
} else {
  blocks.forEach(block => block.classList.add('is-in'));
}
// The first screen is already in view: draw it right away.
requestAnimationFrame(() => document.querySelector('.hero')?.classList.add('is-in'));
