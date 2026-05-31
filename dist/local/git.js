import { execFile } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
export async function runGit(cwd, gitArgs) {
    try {
        const { stdout } = await execFileAsync('git', gitArgs, { cwd, encoding: 'utf8' });
        return stdout.trim();
    }
    catch {
        return '';
    }
}
export function normalizePath(value) {
    return String(value ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}
export function splitLines(value) {
    return String(value ?? '').split('\n').map(normalizePath).filter(Boolean);
}
export async function detectWorkspaceRoot(workspace) {
    return await runGit(workspace, ['rev-parse', '--show-toplevel']) || path.resolve(workspace);
}
export async function inferGitContext(workspace = process.cwd()) {
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
export async function inferRepoName(workspace = process.cwd()) {
    return (await inferGitContext(workspace)).repo;
}
async function listKnownPaths(workspaceRoot) {
    const tracked = splitLines(await runGit(workspaceRoot, ['ls-files']));
    if (tracked.length > 0)
        return tracked.slice(0, 5000).sort();
    const ignored = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'coverage']);
    const paths = [];
    async function walk(dir) {
        if (paths.length >= 5000)
            return;
        const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            if (paths.length >= 5000 || ignored.has(entry.name))
                continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory())
                await walk(fullPath);
            else if (entry.isFile())
                paths.push(normalizePath(path.relative(workspaceRoot, fullPath)));
        }
    }
    await walk(workspaceRoot);
    return [...new Set(paths)].sort();
}
export async function repoScanResult(workspace) {
    const workspaceRoot = await detectWorkspaceRoot(path.resolve(workspace ?? process.cwd()));
    const [knownPaths, changed, staged, untracked, deleted, stagedDeleted, branch, commit] = await Promise.all([
        listKnownPaths(workspaceRoot),
        runGit(workspaceRoot, ['diff', '--name-only', 'HEAD']),
        runGit(workspaceRoot, ['diff', '--name-only', '--cached']),
        runGit(workspaceRoot, ['ls-files', '--others', '--exclude-standard']),
        runGit(workspaceRoot, ['diff', '--name-only', '--diff-filter=D', 'HEAD']),
        runGit(workspaceRoot, ['diff', '--name-only', '--diff-filter=D', '--cached']),
        runGit(workspaceRoot, ['branch', '--show-current']),
        runGit(workspaceRoot, ['rev-parse', 'HEAD']),
    ]);
    return {
        schema_version: 1,
        scanned_at: new Date().toISOString(),
        branch: branch || null,
        commit: commit || null,
        known_paths: knownPaths,
        changed_paths: [...new Set([...splitLines(changed), ...splitLines(staged), ...splitLines(untracked)])].sort(),
        deleted_paths: [...new Set([...splitLines(deleted), ...splitLines(stagedDeleted)])].sort(),
        renamed_paths: [],
        code_entities: [],
    };
}
//# sourceMappingURL=git.js.map