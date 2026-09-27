import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {mergeLaunchOutput} from '../scripts/merge-launch-output.mjs';

async function withBuildFixture(run) {
  const fixture = await mkdtemp(join(tmpdir(), 'aro-launch-output-'));
  try {
    await run(fixture);
  } finally {
    await rm(fixture, {recursive: true, force: true});
  }
}

test('병합은 새 랜딩을 홈페이지로 두면서 기존 진단과 다른 사이트 파일을 보존한다', async () => {
  await withBuildFixture(async fixture => {
    const siteOutput = join(fixture, 'dist');
    const launchOutput = join(fixture, 'dist-launch');
    await mkdir(join(siteOutput, 'assets'), {recursive: true});
    await mkdir(join(siteOutput, 'blog'), {recursive: true});
    await mkdir(join(launchOutput, 'assets'), {recursive: true});
    await mkdir(join(launchOutput, 'fonts'), {recursive: true});
    await writeFile(join(siteOutput, 'index.html'), 'old home');
    await writeFile(join(siteOutput, 'diagnosis.html'), 'existing diagnosis');
    await writeFile(join(siteOutput, 'assets', 'engine.js'), 'engine asset');
    await writeFile(join(siteOutput, 'blog', 'index.html'), 'existing blog');
    await writeFile(join(launchOutput, 'index.html'), 'new landing');
    await writeFile(join(launchOutput, 'assets', 'landing.css'), 'landing asset');
    await writeFile(join(launchOutput, 'fonts', 'local.woff2'), 'font');

    await mergeLaunchOutput(siteOutput, launchOutput);

    assert.equal(await readFile(join(siteOutput, 'index.html'), 'utf8'), 'new landing');
    assert.equal(await readFile(join(siteOutput, 'diagnosis.html'), 'utf8'), 'existing diagnosis');
    assert.equal(await readFile(join(siteOutput, 'assets', 'engine.js'), 'utf8'), 'engine asset');
    assert.equal(await readFile(join(siteOutput, 'blog', 'index.html'), 'utf8'), 'existing blog');
    assert.equal(await readFile(join(siteOutput, 'assets', 'landing.css'), 'utf8'), 'landing asset');
    assert.equal(await readFile(join(siteOutput, 'fonts', 'local.woff2'), 'utf8'), 'font');
  });
});

test('기존 진단 페이지가 없으면 홈페이지를 덮어쓰기 전에 중단한다', async () => {
  await withBuildFixture(async fixture => {
    const siteOutput = join(fixture, 'dist');
    const launchOutput = join(fixture, 'dist-launch');
    await mkdir(siteOutput, {recursive: true});
    await mkdir(launchOutput, {recursive: true});
    await writeFile(join(siteOutput, 'index.html'), 'old home');
    await writeFile(join(launchOutput, 'index.html'), 'new landing');

    await assert.rejects(
      mergeLaunchOutput(siteOutput, launchOutput),
      /diagnosis\.html/,
    );
    assert.equal(await readFile(join(siteOutput, 'index.html'), 'utf8'), 'old home');
  });
});
