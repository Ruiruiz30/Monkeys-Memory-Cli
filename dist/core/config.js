import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
export const DEFAULT_API_URL = process.env.MONKEYS_MEMORY_API_URL ?? 'https://memory.infmonkeys.work';
export const CONFIG_DIR = path.join(os.homedir(), '.monkeys-memory');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export function trimTrailingSlash(value) {
    return String(value ?? '').replace(/\/+$/, '');
}
export async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    }
    catch {
        return false;
    }
}
export async function ensureDir(targetPath) {
    await fs.mkdir(targetPath, { recursive: true });
}
export async function atomicWrite(filePath, value, mode) {
    await ensureDir(path.dirname(filePath));
    const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tempPath, value, mode ? { mode } : undefined);
    await fs.rename(tempPath, filePath);
}
export async function readConfig() {
    if (!(await pathExists(CONFIG_FILE))) {
        return { apiUrl: DEFAULT_API_URL };
    }
    return { apiUrl: DEFAULT_API_URL, ...JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8')) };
}
export async function writeConfig(config) {
    await atomicWrite(CONFIG_FILE, `${JSON.stringify(config, null, 2)}\n`, 0o600);
}
export async function getApiUrl(args = {}) {
    if (args.apiUrl)
        return trimTrailingSlash(args.apiUrl);
    const config = await readConfig();
    return trimTrailingSlash(config.apiUrl ?? DEFAULT_API_URL);
}
export async function getToken() {
    return process.env.MONKEYS_MEMORY_TOKEN
        ?? (await readConfig()).token
        ?? null;
}
//# sourceMappingURL=config.js.map