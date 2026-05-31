import { apiRequest } from '../core/http.js';
import { repoScanResult } from '../local/git.js';
export async function reportAction(actionId, result) {
    return apiRequest('POST', `/api/v1/agent-actions/${encodeURIComponent(actionId)}/result`, {
        data: result instanceof Error ? { status: 'failed', error: result.message } : { status: 'completed', result },
    });
}
export async function runImmediateActions(response, args) {
    if (args.noAutoActions)
        return response;
    return response;
}
export async function agentActionResult(args) {
    if (!args.actionId)
        throw new Error('--action-id is required');
    if (args.type && args.type !== 'repo_scan')
        throw new Error(`unsupported agent action type: ${args.type}`);
    const result = await repoScanResult(args.workspace ?? process.cwd());
    const report = args.noReport ? null : await reportAction(args.actionId, result);
    console.log(JSON.stringify({ action_id: args.actionId, type: args.type ?? 'repo_scan', result, report }, null, 2));
}
//# sourceMappingURL=actions.js.map