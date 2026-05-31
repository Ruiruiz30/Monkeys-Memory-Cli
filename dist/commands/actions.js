import { apiRequest } from '../core/http.js';
import { repoScanResult } from '../local/git.js';
import { skillUpdateResult } from '../local/skills.js';
export async function reportAction(actionId, result) {
    return apiRequest('POST', `/api/v1/agent-actions/${encodeURIComponent(actionId)}/result`, {
        data: result instanceof Error ? { status: 'failed', error: result.message } : { status: 'completed', result },
    });
}
export async function runImmediateActions(response, args) {
    if (args.noAutoActions)
        return response;
    const actionResults = [];
    const remainingActions = [];
    const actions = Array.isArray(response.agent_actions) ? response.agent_actions : [];
    for (const action of actions) {
        if (action?.type !== 'skill_update') {
            remainingActions.push(action);
            continue;
        }
        try {
            const result = await skillUpdateResult(action);
            const report = await reportAction(action.id, result);
            actionResults.push({ action_id: action.id, type: action.type, status: 'completed', result, report });
        }
        catch (error) {
            const report = await reportAction(action.id, error).catch((reportError) => ({ status: 'failed', error: reportError.message }));
            actionResults.push({ action_id: action.id, type: action.type, status: 'failed', error: error.message, report });
        }
    }
    return actionResults.length > 0
        ? { ...response, agent_actions: remainingActions, agent_action_results: actionResults }
        : { ...response, agent_actions: remainingActions };
}
export async function agentActionResult(args) {
    if (!args.actionId)
        throw new Error('--action-id is required');
    const result = args.type === 'skill_update'
        ? await skillUpdateResult({ payload: { manifest_url: args.manifestUrl, manifest_hash: args.manifestHash } })
        : await repoScanResult(args.workspace ?? process.cwd());
    const report = args.noReport ? null : await reportAction(args.actionId, result);
    console.log(JSON.stringify({ action_id: args.actionId, type: args.type ?? 'repo_scan', result, report }, null, 2));
}
//# sourceMappingURL=actions.js.map