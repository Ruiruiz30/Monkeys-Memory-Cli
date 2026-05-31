import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const DEFAULT_API_URL = process.env.MONKEYS_MEMORY_API_URL ?? 'https://memory.infmonkeys.work';
export const CONFIG_DIR = path.join(os.homedir(), '.monkeys-memory');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

export type CLIConfig = {
  apiUrl?: string;
  token?: string;
  tokenId?: string;
  expiresAt?: string;
  update?: {
    lastCheckedAt?: string;
  };
};

export function trimTrailingSlash(value: unknown): string {
  return String(value ?? '').replace(/\/+$/, '');
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
}

export async function atomicWrite(filePath: string, value: string | Buffer, mode?: number): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, value, mode ? { mode } : undefined);
  await fs.rename(tempPath, filePath);
}

export async function readConfig(): Promise<CLIConfig> {
  if (!(await pathExists(CONFIG_FILE))) {
    return { apiUrl: DEFAULT_API_URL };
  }
  return { apiUrl: DEFAULT_API_URL, ...JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8')) as CLIConfig };
}

export async function writeConfig(config: CLIConfig): Promise<void> {
  await atomicWrite(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, 0o600);
}

export async function getApiUrl(args: { apiUrl?: string } = {}): Promise<string> {
  if (args.apiUrl) return trimTrailingSlash(args.apiUrl);
  const config = await readConfig();
  return trimTrailingSlash(config.apiUrl ?? DEFAULT_API_URL);
}

export async function getToken(): Promise<string | null> {
  return process.env.MONKEYS_MEMORY_TOKEN
    ?? (await readConfig()).token
    ?? null;
}
