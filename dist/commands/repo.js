import { apiRequest } from '../core/http.js';
import { parseJson } from '../core/args.js';
import { compactRepoScanResult, inferRepoName, repoScanResult } from '../local/git.js';
import { reportAction } from './actions.js';
function applyAgentGuideData(result, args) {
    const extra = args.data ? parseJson(args.data, '--data') : {};
    if (args.guide)
        extra.agent_repo_guide = { schema_version: 1, summary: args.guide };
    return { ...result, ...extra };
}
export async function repoScan(args) {
    const workspace = args.workspace ?? process.cwd();
    const repo = args.repo ?? await inferRepoName(workspace);
    const fullResult = applyAgentGuideData(await repoScanResult(workspace, repo), args);
    const reportResult = args.fullScan ? { ...fullResult, scan_mode: 'full' } : compactRepoScanResult(fullResult);
    if (args.actionId && !args.noReport) {
        const report = await reportAction(args.actionId, reportResult, { orgId: args.orgId, repo });
        console.log(JSON.stringify({ result: reportResult, report }, null, 2));
        return;
    }
    if (repo && !args.noReport) {
        const ingest = await apiRequest('POST', '/api/v1/repos/scan', {
            data: { ...reportResult, repo, provider: 'cli', event: 'repo-scan', mode: 'snapshot' },
            headers: args.orgId ? { 'X-Org-Id': args.orgId } : undefined,
        });
        console.log(JSON.stringify({ result: reportResult, ingest }, null, 2));
        return;
    }
    console.log(JSON.stringify(fullResult, null, 2));
}
//# sourceMappingURL=repo.js.map