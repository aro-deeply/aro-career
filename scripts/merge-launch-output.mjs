import {access, cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

async function requireFile(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`Required build file is missing: ${path}`);
  }
}

export async function mergeLaunchOutput(siteOutput, launchOutput) {
  await Promise.all([
    requireFile(resolve(siteOutput, 'index.html')),
    requireFile(resolve(siteOutput, 'diagnosis.html')),
    requireFile(resolve(launchOutput, 'index.html')),
  ]);

  await cp(launchOutput, siteOutput, {recursive: true, force: true});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const siteOutput = fileURLToPath(new URL('../dist/', import.meta.url));
  const launchOutput = fileURLToPath(new URL('../dist-launch/', import.meta.url));
  await mergeLaunchOutput(siteOutput, launchOutput);
}
