import { apiRequest } from '../core/http.js';
import { inferRepoName, repoScanResult } from '../local/git.js';
import { reportAction } from './actions.js';
export async function repoScan(args) {
    const workspace = args.workspace ?? process.cwd();
    const repo = args.repo ?? await inferRepoName(workspace);
    const result = await repoScanResult(workspace);
    if (args.actionId && !args.noReport) {
        const report = await reportAction(args.actionId, result);
        console.log(JSON.stringify({ result, report }, null, 2));
        return;
    }
    if (repo && !args.noReport) {
        const ingest = await apiRequest('POST', '/api/v1/repos/scan', {
            data: { ...result, repo, provider: 'cli', event: 'repo-scan', mode: 'snapshot' },
        });
        console.log(JSON.stringify({ result, ingest }, null, 2));
        return;
    }
    console.log(JSON.stringify(result, null, 2));
}
//# sourceMappingURL=repo.js.map