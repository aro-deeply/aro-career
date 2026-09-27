import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

test('개발과 빌드가 같은 내부 정적 폴더의 가상 PDF 두 개만 사용한다',()=>{
 const folder=new URL('../launch/public/samples/',import.meta.url);
 assert.deepEqual(readdirSync(folder).sort(),['career.pdf','newgrad.pdf']);
 const hashes={newgrad:'6A12F793F5016279BBEFFD2FFB015C84DD1CAF64A89E59B63F3576133FB0BD95',career:'A64C02C54D6DEB4776FCD64DA74EAC046BAF4CCF08D0273EA47ADDFA3A7AA4D7'};
 for(const [id,hash] of Object.entries(hashes)){
  const bytes=readFileSync(new URL(id+'.pdf',folder));
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  assert.equal(createHash('sha256').update(bytes).digest('hex').toUpperCase(),hash);
 }
 const config=readFileSync(new URL('../launch.vite.config.js',import.meta.url),'utf8');
 assert.doesNotMatch(config,/delivery-pilot|readFileSync|publicDir:false/);
});
