// 스크롤을 시작하면 헤더에 배경을 깔아 본문과 겹쳐도 읽히게 한다.
const header = document.querySelector('#site-header');

function markHeaderWhenScrolled() {
  header.classList.toggle('is-scrolled', window.scrollY > 8);
}

markHeaderWhenScrolled();
window.addEventListener('scroll', markHeaderWhenScrolled, {passive: true});
