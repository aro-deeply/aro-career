import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../launch/',import.meta.url);
const html=readFileSync(new URL('index.html',root),'utf8');
const css=readFileSync(new URL('style.css',root),'utf8');
const engineUrl='https://aro-career.vercel.app/diagnosis';

test('실제 로컬 Pretendard 웹폰트와 원본 라이선스를 제공한다',()=>{
 const font=new URL('public/fonts/PretendardVariable.woff2',root);
 assert.ok(existsSync(font),'웹폰트 파일 누락');
 assert.equal(readFileSync(font).subarray(0,4).toString(),'wOF2');
 const license=readFileSync(new URL('public/fonts/OFL.txt',root),'utf8');
 assert.match(license,/SIL OPEN FONT LICENSE Version 1\.1/);
 assert.match(css,/@font-face\s*\{/);
 assert.ok(/url\(['"]?\/fonts\/PretendardVariable\.woff2['"]?\)/.test(css),'Vite가 public 폰트 경로를 빌드 CSS 기준으로 변환할 수 있어야 한다');
 assert.match(css,/font-display:\s*swap/);
 assert.match(html,/<link[^>]+rel="preload"[^>]+href="\.\/fonts\/PretendardVariable\.woff2"[^>]+as="font"/);
});

test('ARO AI 진단은 상단·첫 화면·기능 소개에서 직접 열 수 있다',()=>{
 const links=[...html.matchAll(/<a\b[^>]*data-ai-engine[^>]*>/g)].map(m=>m[0]);
 assert.equal(links.length,3);
 for(const link of links){
  assert.ok(link.includes(`href="${engineUrl}"`));
  assert.match(link,/target="_blank"/);
  assert.match(link,/rel="noopener noreferrer"/);
 }
 assert.match(html,/AI 진단 페이지에서 서류를 입력/);
 assert.doesNotMatch(html,/<iframe\b/);
});

test('AI 진단을 상담 결과물을 보기 위한 필수 관문으로 만들지 않는다',()=>{
 assert.match(html,/<a[^>]+href="#examples"[^>]*>상담 결과물 보기/);
 assert.match(html,/상담은 AI 진단 없이도/);
 assert.match(html,/data-open-sample/);
});
