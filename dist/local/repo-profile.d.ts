export type RepoPathGroup = {
    name: string;
    paths: string[];
    purpose: string;
};
export type RepoProfile = {
    schema_version: 1;
    name: string;
    kind: string;
    description: string | null;
    package_manager: string | null;
    languages: string[];
    frameworks: string[];
    path_groups: RepoPathGroup[];
    ownership: {
        owns: string[];
        does_not_own: string[];
        boundary_notes: string[];
    };
    important_commands: Array<{
        name: string;
        command: string;
        purpose: string;
    }>;
    contributor_guides: string[];
};
export type CodeEntity = {
    id: string;
    kind: string;
    name: string;
    path: string;
    line: number;
    signature?: string;
};
export declare function extractCodeEntities(workspaceRoot: string, knownPaths: string[], limit?: number): Promise<CodeEntity[]>;
export declare function buildRepoProfile(workspaceRoot: string, repoName: string, knownPaths: string[]): Promise<{
    profile: RepoProfile;
    brief: string;
}>;
