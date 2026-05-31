import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { atomicWrite, ensureDir, getApiUrl, pathExists } from '../core/config.js';
import { sha256 } from '../core/crypto.js';
const OFFICIAL_SKILLS = new Set(['monkeys-memory-use', 'monkeys-memory-capture']);
async function installationState() {
    const filePath = path.join(os.homedir(), '.monkeys-memory', 'agent-installation.json');
    if (await pathExists(filePath))
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
    const state = {
        schema_version: 1,
        installation_id: `mms_${crypto.randomUUID()}`,
        created_at: new Date().toISOString(),
    };
    await atomicWrite(filePath, `${JSON.stringify(state, null, 2)}\n`, 0o600);
    return state;
}
async function skillHash(name) {
    const roots = [
        path.join(os.homedir(), '.codex', 'skills'),
        path.join(os.homedir(), '.claude', 'skills'),
    ];
    for (const root of roots) {
        const filePath = path.join(root, name, 'SKILL.md');
        if (await pathExists(filePath))
            return sha256(await fs.readFile(filePath));
    }
    return null;
}
export async function agentCapabilities() {
    const state = await installationState();
    const skills = {};
    for (const name of OFFICIAL_SKILLS) {
        skills[name] = { sha256: await skillHash(name) };
    }
    return { installation_id: state.installation_id, skills };
}
function validateOfficialUrl(value, apiUrl) {
    const url = new URL(value);
    const apiOrigin = new URL(apiUrl).origin;
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
        throw new Error(`URL must use HTTPS: ${url.href}`);
    }
    if (url.origin !== apiOrigin)
        throw new Error(`URL is outside the configured API origin: ${url.origin}`);
    return url;
}
function validateSkill(skill) {
    if (!OFFICIAL_SKILLS.has(skill?.name))
        throw new Error(`unsupported SaaS skill: ${skill?.name}`);
    if (skill.path !== `${skill.name}/SKILL.md`)
        throw new Error(`invalid skill path: ${skill.path}`);
    if (!/^[a-f0-9]{64}$/.test(skill.sha256 ?? ''))
        throw new Error(`invalid sha256 for skill: ${skill.name}`);
}
async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`download failed (${response.status}): ${url.href}`);
    return response.json();
}
export async function skillUpdateResult(action) {
    const apiUrl = await getApiUrl();
    const manifestUrl = action.payload?.manifest_url ?? `${apiUrl}/api/v1/skills/manifest`;
    const manifest = await fetchJson(validateOfficialUrl(manifestUrl, apiUrl));
    if (action.payload?.manifest_hash && manifest.manifest_hash !== action.payload.manifest_hash) {
        throw new Error('skill manifest hash does not match the leased action');
    }
    const downloaded = [];
    for (const skill of manifest.skills ?? []) {
        validateSkill(skill);
        const response = await fetch(validateOfficialUrl(skill.url, apiUrl));
        if (!response.ok)
            throw new Error(`skill download failed (${response.status}): ${skill.name}`);
        const content = Buffer.from(await response.arrayBuffer());
        if (sha256(content) !== skill.sha256)
            throw new Error(`skill checksum mismatch: ${skill.name}`);
        downloaded.push({ skill, content });
    }
    for (const { skill, content } of downloaded) {
        for (const root of [path.join(os.homedir(), '.codex', 'skills'), path.join(os.homedir(), '.claude', 'skills')]) {
            await ensureDir(root);
            await atomicWrite(path.join(root, skill.path), content);
        }
    }
    return {
        schema_version: 1,
        installation_id: (await installationState()).installation_id,
        manifest_hash: manifest.manifest_hash,
        updated: downloaded.map(({ skill }) => ({ name: skill.name, sha256: skill.sha256 })),
    };
}
//# sourceMappingURL=skills.js.map