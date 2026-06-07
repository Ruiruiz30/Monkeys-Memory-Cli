import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { RepoScanResult } from '../types/api.js';
import { buildRepoProfile, extractCodeEntities } from './repo-profile.js';

const execFileAsync = promisify(execFile);

export async function runGit(cwd: string, gitArgs: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', gitArgs, { cwd, encoding: 'utf8' });
    return stdout.trim();
  } catch {
    return '';
  }
}

export function normalizePath(value: unknown): string {
  return String(value ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

export function splitLines(value: unknown): string[] {
  return String(value ?? '').split('\n').map(normalizePath).filter(Boolean);
}

export async function detectWorkspaceRoot(workspace: string): Promise<string> {
  return await runGit(workspace, ['rev-parse', '--show-toplevel']) || path.resolve(workspace);
}

export async function inferGitContext(workspace = process.cwd()): Promise<{ repo: string; branch: string | null; commit: string | null }> {
  const workspaceRoot = await detectWorkspaceRoot(path.resolve(workspace));
  const [remote, branch, commit] = await Promise.all([
    runGit(workspaceRoot, ['config', '--get', 'remote.origin.url']),
    runGit(workspaceRoot, ['branch', '--show-current']),
    runGit(workspaceRoot, ['rev-parse', 'HEAD']),
  ]);
  const remoteName = remote
    .split(/[/:]/)
    .pop()
    ?.replace(/\.git$/, '')
    ?.trim();
  return {
    repo: remoteName || path.basename(workspaceRoot),
    branch: branch || null,
    commit: commit || null,
  };
}

export async function inferRepoName(workspace = process.cwd()): Promise<string> {
  return (await inferGitContext(workspace)).repo;
}

async function listKnownPaths(workspaceRoot: string): Promise<string[]> {
  const tracked = splitLines(await runGit(workspaceRoot, ['ls-files']));
  if (tracked.length > 0) return tracked.slice(0, 5000).sort();
  const ignored = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage']);
  const paths: string[] = [];
  async function walk(dir: string): Promise<void> {
    if (paths.length >= 5000) return;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (paths.length >= 5000 || ignored.has(entry.name)) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile()) paths.push(normalizePath(path.relative(workspaceRoot, fullPath)));
    }
  }
  await walk(workspaceRoot);
  return [...new Set(paths)].sort();
}

function parentDirs(filePath: string): string[] {
  const parts = normalizePath(filePath).split('/').filter(Boolean);
  const dirs: string[] = [];
  for (let index = 1; index < parts.length; index += 1) dirs.push(parts.slice(0, index).join('/'));
  return dirs;
}

function samplePaths(paths: string[], limit: number): string[] {
  const priority = paths.filter(item =>
    /(^|\/)(AGENTS\.md|README\.md|package\.json|tsconfig\.json|vite\.config\.ts|Dockerfile)$/.test(item)
    || item.startsWith('src/')
    || item.startsWith('app/')
    || item.startsWith('pages/')
    || item.startsWith('components/')
    || item.startsWith('tests/')
    || item.startsWith('test/')
  );
  return [...new Set([...priority, ...paths])].slice(0, limit).sort();
}

export function compactRepoScanResult(result: RepoScanResult): RepoScanResult {
  const knownPaths = result.known_paths ?? [];
  const codeEntities = result.code_entities ?? [];
  const knownDirs = [...new Set(knownPaths.flatMap(parentDirs))]
    .sort()
    .slice(0, 1500);
  const codeEntitySample = codeEntities
    .slice(0, 500)
    .map((entity) => {
      if (!entity || typeof entity !== 'object') return entity;
      const row = entity as Record<string, unknown>;
      return {
        id: row.id,
        kind: row.kind,
        name: row.name,
        path: row.path,
        line: row.line,
      };
    });
  return {
    ...result,
    scan_mode: 'compact',
    known_path_count: knownPaths.length,
    known_path_sample: samplePaths(knownPaths, 500),
    known_dirs: knownDirs,
    known_paths: [],
    code_entity_count: codeEntities.length,
    code_entity_sample: codeEntitySample,
    code_entities: [],
  };
}

export async function repoScanResult(workspace?: string, repoName?: string): Promise<RepoScanResult> {
  const workspaceRoot = await detectWorkspaceRoot(path.resolve(workspace ?? process.cwd()));
  const [knownPaths, changed, staged, untracked, deleted, stagedDeleted, branch, commit, context] = await Promise.all([
    listKnownPaths(workspaceRoot),
    runGit(workspaceRoot, ['diff', '--name-only', 'HEAD']),
    runGit(workspaceRoot, ['diff', '--name-only', '--cached']),
    runGit(workspaceRoot, ['ls-files', '--others', '--exclude-standard']),
    runGit(workspaceRoot, ['diff', '--name-only', '--diff-filter=D', 'HEAD']),
    runGit(workspaceRoot, ['diff', '--name-only', '--diff-filter=D', '--cached']),
    runGit(workspaceRoot, ['branch', '--show-current']),
    runGit(workspaceRoot, ['rev-parse', 'HEAD']),
    inferGitContext(workspaceRoot),
  ]);
  const [{ profile, brief }, codeEntities] = await Promise.all([
    buildRepoProfile(workspaceRoot, repoName ?? context.repo, knownPaths),
    extractCodeEntities(workspaceRoot, knownPaths),
  ]);
  return {
    schema_version: 2,
    scanned_at: new Date().toISOString(),
    branch: branch || null,
    commit: commit || null,
    known_paths: knownPaths,
    changed_paths: [...new Set([...splitLines(changed), ...splitLines(staged), ...splitLines(untracked)])].sort(),
    deleted_paths: [...new Set([...splitLines(deleted), ...splitLines(stagedDeleted)])].sort(),
    renamed_paths: [],
    code_entities: codeEntities,
    repo_profile: profile,
    repo_brief: brief,
  };
}
