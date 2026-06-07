import type { RepoScanResult } from '../types/api.js';
export declare function runGit(cwd: string, gitArgs: string[]): Promise<string>;
export declare function normalizePath(value: unknown): string;
export declare function splitLines(value: unknown): string[];
export declare function detectWorkspaceRoot(workspace: string): Promise<string>;
export declare function inferGitContext(workspace?: string): Promise<{
    repo: string;
    branch: string | null;
    commit: string | null;
}>;
export declare function inferRepoName(workspace?: string): Promise<string>;
export declare function compactRepoScanResult(result: RepoScanResult): RepoScanResult;
export declare function repoScanResult(workspace?: string, repoName?: string): Promise<RepoScanResult>;
