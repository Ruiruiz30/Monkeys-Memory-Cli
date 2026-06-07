import { apiRequest } from '../core/http.js';
import { parseJson } from '../core/args.js';
import { compactRepoScanResult, inferRepoName, repoScanResult } from '../local/git.js';
export async function reportAction(actionId, result, context = {}) {
    const data = result instanceof Error
        ? { status: 'failed', error: result.message }
        : { status: 'completed', result };
    if (context.repo)
        data.repo = context.repo;
    return apiRequest('POST', `/api/v1/agent-actions/${encodeURIComponent(actionId)}/result`, {
        data,
        headers: context.orgId ? { 'X-Org-Id': context.orgId } : undefined,
    });
}
function applyAgentGuideData(result, args) {
    const extra = args.data ? parseJson(args.data, '--data') : {};
    if (args.guide)
        extra.agent_repo_guide = { schema_version: 1, summary: args.guide };
    return { ...result, ...extra };
}
export async function runImmediateActions(response, args) {
    if (args.noAutoActions)
        return response;
    const actions = Array.isArray(response.agent_actions) ? response.agent_actions : [];
    if (actions.length === 0)
        return response;
    const results = [];
    for (const rawAction of actions) {
        const action = rawAction;
        if (!action.id || !action.type) {
            results.push({
                status: 'skipped',
                reason: 'malformed-agent-action',
                action: rawAction,
            });
            continue;
        }
        if (action.type !== 'repo_scan') {
            results.push({
                id: action.id,
                type: action.type,
                status: 'skipped',
                reason: 'unsupported-agent-action',
            });
            continue;
        }
        const workspace = args.workspace ?? process.cwd();
        const repo = typeof action.repo === 'string'
            ? action.repo
            : args.repo ?? await inferRepoName(workspace);
        const fullResult = applyAgentGuideData(await repoScanResult(workspace, repo), args);
        const result = args.fullScan ? { ...fullResult, scan_mode: 'full' } : compactRepoScanResult(fullResult);
        const report = args.noReport ? null : await reportAction(action.id, result, { orgId: args.orgId, repo });
        results.push({
            id: action.id,
            type: action.type,
            repo,
            status: report?.status ?? (args.noReport ? 'not-reported' : 'reported'),
            result,
            report,
        });
    }
    return {
        ...response,
        agent_action_results: results,
    };
}
export async function agentActionResult(args) {
    if (!args.actionId)
        throw new Error('--action-id is required');
    if (args.type && args.type !== 'repo_scan')
        throw new Error(`unsupported agent action type: ${args.type}`);
    const workspace = args.workspace ?? process.cwd();
    const repo = args.repo ?? await inferRepoName(workspace);
    const fullResult = applyAgentGuideData(await repoScanResult(workspace, repo), args);
    const result = args.fullScan ? { ...fullResult, scan_mode: 'full' } : compactRepoScanResult(fullResult);
    const report = args.noReport ? null : await reportAction(args.actionId, result, { orgId: args.orgId, repo });
    console.log(JSON.stringify({ action_id: args.actionId, type: args.type ?? 'repo_scan', repo, result, report }, null, 2));
}
//# sourceMappingURL=actions.js.map