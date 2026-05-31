import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { getApiUrl, getToken, readConfig, writeConfig } from '../core/config.js';
import { apiRequest, apiResponse } from '../core/http.js';
import { skillUpdateResult } from '../local/skills.js';
const execFileAsync = promisify(execFile);
function deviceName() {
    return `${os.hostname()} (${os.platform()})`;
}
async function openBrowser(url) {
    const commands = process.platform === 'darwin'
        ? [['open', [url]]]
        : process.platform === 'win32'
            ? [['cmd', ['/c', 'start', '', url]]]
            : [['xdg-open', [url]]];
    for (const [cmd, args] of commands) {
        try {
            await execFileAsync(cmd, args);
            return true;
        }
        catch {
            return false;
        }
    }
    return false;
}
async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
export async function login(args) {
    const apiUrl = await getApiUrl(args);
    const start = await apiRequest('POST', '/api/v1/cli/device/start', {
        apiUrl,
        tokenRequired: false,
        data: { device_name: args.deviceName ?? deviceName() },
    });
    await writeConfig({ ...(await readConfig()), apiUrl });
    console.error(`Open this URL to authorize Monkeys Memory CLI:\n${start.verification_uri_complete}\n`);
    if (!args.noOpen)
        await openBrowser(start.verification_uri_complete).catch(() => false);
    console.error(`Waiting for browser authorization. Code: ${start.user_code}`);
    const expiresAt = Date.now() + (start.expires_in ?? 600) * 1000;
    const intervalMs = Math.max(1, Number(start.interval ?? 2)) * 1000;
    while (Date.now() < expiresAt) {
        const exchange = await apiResponse('POST', '/api/v1/cli/device/token', {
            apiUrl,
            tokenRequired: false,
            data: { device_code: start.device_code },
        });
        if (!exchange.ok)
            throw exchange.error;
        if (exchange.data.status === 'authorized' && exchange.data.token && exchange.data.token_id && exchange.data.expires_at) {
            await writeConfig({
                ...(await readConfig()),
                apiUrl,
                token: exchange.data.token,
                tokenId: exchange.data.token_id,
                expiresAt: exchange.data.expires_at,
            });
            const skills = await skillUpdateResult({ payload: {} }).catch((error) => ({ ok: false, error: error.message }));
            console.log(JSON.stringify({ ok: true, token_id: exchange.data.token_id, expires_at: exchange.data.expires_at, skills }, null, 2));
            return;
        }
        await sleep(intervalMs);
    }
    throw new Error('login timed out before browser authorization completed');
}
export async function logout() {
    const config = await readConfig();
    let revoked = false;
    if (await getToken()) {
        revoked = await apiRequest('DELETE', '/api/v1/cli/token').then(() => true).catch(() => false);
    }
    delete config.token;
    delete config.tokenId;
    delete config.expiresAt;
    await writeConfig(config);
    console.log(JSON.stringify({ ok: true, revoked }, null, 2));
}
export async function authStatus() {
    const token = await getToken();
    if (!token) {
        console.log(JSON.stringify({ ok: false, logged_in: false }, null, 2));
        return;
    }
    const result = await apiRequest('GET', '/api/v1/auth/me');
    console.log(JSON.stringify({ ok: true, logged_in: true, account: result.account, organizations: result.organizations }, null, 2));
}
//# sourceMappingURL=auth.js.map