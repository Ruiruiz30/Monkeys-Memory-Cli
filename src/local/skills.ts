import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { atomicWrite, ensureDir, pathExists } from '../core/config.js';
import { sha256 } from '../core/crypto.js';
import type { AgentCapabilities, AgentAction, SkillManifest } from '../types/api.js';

const OFFICIAL_SKILLS = new Set(['monkeys-memory-use', 'monkeys-memory-capture']);
const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PACKAGED_SKILLS_ROOT = path.join(PACKAGE_ROOT, 'skills');

async function installationState(): Promise<{ schema_version: 1; installation_id: string; created_at: string }> {
  const filePath = path.join(os.homedir(), '.monkeys-memory', 'agent-installation.json');
  if (await pathExists(filePath)) return JSON.parse(await fs.readFile(filePath, 'utf8')) as { schema_version: 1; installation_id: string; created_at: string };
  const state = {
    schema_version: 1 as const,
    installation_id: `mms_${crypto.randomUUID()}`,
    created_at: new Date().toISOString(),
  };
  await atomicWrite(filePath, `${JSON.stringify(state, null, 2)}\n`, 0o600);
  return state;
}

async function skillHash(name: string): Promise<string | null> {
  const roots = [
    path.join(os.homedir(), '.codex', 'skills'),
    path.join(os.homedir(), '.claude', 'skills'),
  ];
  for (const root of roots) {
    const filePath = path.join(root, name, 'SKILL.md');
    if (await pathExists(filePath)) return sha256(await fs.readFile(filePath));
  }
  return null;
}

export async function agentCapabilities(): Promise<AgentCapabilities> {
  const state = await installationState();
  const skills: AgentCapabilities['skills'] = {};
  for (const name of OFFICIAL_SKILLS) {
    skills[name] = { sha256: await skillHash(name) };
  }
  return { installation_id: state.installation_id, skills };
}

function validateSkill(skill: SkillManifest['skills'][number]): void {
  if (!OFFICIAL_SKILLS.has(skill?.name)) throw new Error(`unsupported SaaS skill: ${skill?.name}`);
  if (skill.path !== `${skill.name}/SKILL.md`) throw new Error(`invalid skill path: ${skill.path}`);
  if (!/^[a-f0-9]{64}$/.test(skill.sha256 ?? '')) throw new Error(`invalid sha256 for skill: ${skill.name}`);
}

async function packagedManifest(): Promise<SkillManifest> {
  const manifestPath = path.join(PACKAGED_SKILLS_ROOT, 'manifest.txt');
  const raw = await fs.readFile(manifestPath, 'utf8');
  const entries = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  const skills: SkillManifest['skills'] = [];
  for (const relativePath of entries) {
    if (!relativePath.endsWith('/SKILL.md') || relativePath.includes('..') || path.isAbsolute(relativePath)) continue;
    const name = relativePath.split('/')[0];
    if (!OFFICIAL_SKILLS.has(name)) continue;
    const content = await fs.readFile(path.join(PACKAGED_SKILLS_ROOT, relativePath));
    skills.push({
      name,
      path: relativePath,
      sha256: sha256(content),
    });
  }

  const normalized = skills
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((skill) => `${skill.name}:${skill.sha256}`)
    .join('\n');

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    manifest_hash: sha256(Buffer.from(normalized)),
    skills,
  };
}

export async function skillUpdateResult(action: Pick<AgentAction, 'payload'>): Promise<{
  schema_version: 1;
  installation_id: string;
  manifest_hash: string;
  updated: Array<{ name: string; sha256: string }>;
}> {
  const manifest = await packagedManifest();
  if (action.payload?.manifest_hash && manifest.manifest_hash !== action.payload.manifest_hash) {
    throw new Error('packaged skill manifest hash does not match the requested hash');
  }

  const downloaded: Array<{ skill: SkillManifest['skills'][number]; content: Buffer }> = [];
  for (const skill of manifest.skills ?? []) {
    validateSkill(skill);
    const content = await fs.readFile(path.join(PACKAGED_SKILLS_ROOT, skill.path));
    if (sha256(content) !== skill.sha256) throw new Error(`skill checksum mismatch: ${skill.name}`);
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
