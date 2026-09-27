import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../launch/' + path, import.meta.url), 'utf8');
const html = read('index.html');
const css = read('style.css');
const app = read('app.js');

function visibleSentences(source) {
  // 경력기술서 예시 문장(.doc-after)은 실제 문서 문체를 보여주는 인용이라 제외한다.
  const body = source
    .replace(/<(script|style|head)[^>]*>[\s\S]*?<\/\1>/g, '')
    .replace(/<p class="doc-after[^"]*"[^>]*>[\s\S]*?<\/p>/g, '');
  return body
    .split(/<br\s*\/?>|<\/(?:p|h1|h2|h3|li|summary|blockquote|figcaption|a|span|del|dt|dd|div)>/)
    .map(chunk => chunk.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

test('화면 문장은 한 줄 40자를 넘지 않는다', () => {
  const tooLong = visibleSentences(html).filter(line => line.length > 40 && !line.includes('@'));
  assert.deepEqual(tooLong, []);
});

test('예시는 직장인 사례이고 수업·과제 예시를 쓰지 않는다', () => {
  assert.match(html, /이직 준비/);
  assert.doesNotMatch(html, /수업|팀 과제|동아리|발표 자료/);
});

test('만든 사례임을 밝히고 검증되지 않은 실적·가격을 넣지 않는다', () => {
  assert.match(html, /상담 방식을 보여주기 위해 만든 사례입니다/);
  assert.match(html, /입력 문장은 설명을 위해 넣었습니다/);
  assert.match(html, /약 16년/);
  assert.doesNotMatch(html, /36만|21만|150건|1,000회|1000회|상담심리학|15년|보장합니다|최고의|완벽한/);
  assert.doesNotMatch(html, /—/);
});

test('외부 연결은 AI 진단·카카오톡·이메일만 쓰고 데이터를 보내지 않는다', () => {
  const external = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => new URL(m[1]).host);
  assert.deepEqual([...new Set(external)].sort(), ['aro-career.vercel.app', 'pf.kakao.com']);
  for (const tag of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) assert.match(tag[0], /rel="noopener noreferrer"/);
  assert.match(html, /mailto:aro\.deeply@gmail\.com/);
  assert.doesNotMatch(app, /\b(fetch|XMLHttpRequest|sendBeacon|localStorage|sessionStorage)\b/);
  assert.doesNotMatch(html, /<form|<input|<textarea/);
});

test('글자 크기는 다섯 단계 변수로만 정의한다', () => {
  const sizes = [...css.matchAll(/--t-([a-z]+):/g)].map(m => m[1]);
  assert.deepEqual(sizes, ['display', 'title', 'lead', 'body', 'caption']);
  assert.doesNotMatch(css, /linear-gradient\(\s*(?:\d|to |#)/);
});

test('글꼴은 사이트 안의 SUIT 파일을 쓰고 명조체를 쓰지 않는다', () => {
  assert.match(css, /url\('\/fonts\/SUIT-Variable\.woff2'\)/);
  assert.doesNotMatch(css + html, /Myeongjo|Batang|Serif KR|(?<!sans-)serif/);
  assert.ok(readFileSync(new URL('../launch/public/fonts/SUIT-OFL.txt', import.meta.url), 'utf8').includes('Open Font License'));
});
