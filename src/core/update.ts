import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { promisify } from 'node:util';
import { readConfig, writeConfig } from './config.js';
import { skillUpdateResult } from '../local/skills.js';

const execFileAsync = promisify(execFile);
const PACKAGE_NAME = '@inf-monkeys-tech/monkeys-memory-cli';
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

type PackageMetadata = {
  version: string;
};

function compareVersions(left: string, right: string): number {
  const leftParts = left.split('.').map((part) => Number.parseInt(part, 10));
  const rightParts = right.split('.').map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const delta = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

async function currentPackageVersion(): Promise<string> {
  const packageJson = new URL('../../package.json', import.meta.url);
  const metadata = JSON.parse(await fs.readFile(packageJson, 'utf8')) as PackageMetadata;
  return metadata.version;
}

async function latestPackageVersion(): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(PACKAGE_NAME)}/latest`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const metadata = await response.json() as PackageMetadata;
    return metadata.version;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function shouldCheck(): Promise<boolean> {
  if (process.env.MONKEYS_MEMORY_SKIP_UPDATE_CHECK === '1') return false;
  if (process.env.MONKEYS_MEMORY_UPDATING === '1') return false;
  const config = await readConfig();
  const checkedAt = config.update?.lastCheckedAt ? new Date(config.update.lastCheckedAt).getTime() : 0;
  return !Number.isFinite(checkedAt) || Date.now() - checkedAt > CHECK_INTERVAL_MS;
}

async function markChecked(): Promise<void> {
  const config = await readConfig();
  await writeConfig({
    ...config,
    update: {
      ...(config.update ?? {}),
      lastCheckedAt: new Date().toISOString(),
    },
  });
}

export async function checkForCliUpdate(): Promise<void> {
  if (!(await shouldCheck())) return;
  await markChecked();

  const current = await currentPackageVersion();
  const latest = await latestPackageVersion();
  if (!latest || compareVersions(latest, current) <= 0) return;

  console.error(`[monkeys-memory] Updating CLI ${current} -> ${latest}...`);
  await execFileAsync('npm', ['install', '-g', `${PACKAGE_NAME}@latest`], {
    env: { ...process.env, MONKEYS_MEMORY_UPDATING: '1' },
  });
  const skills = await skillUpdateResult({ payload: {} });
  console.error(`[monkeys-memory] Updated CLI to ${latest}; synced ${skills.updated.length} skill(s).`);
}
