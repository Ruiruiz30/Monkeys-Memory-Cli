import { collectValues, parseJson, setIfPresent } from '../core/args.js';
import { apiRequest } from '../core/http.js';
import { inferRepoName } from '../local/git.js';
const VALID_OUTCOMES = new Set(['helpful', 'not-relevant', 'outdated', 'accepted', 'failed']);
const VALID_CORRECTION_KINDS = new Set(['rule', 'exception', 'procedure', 'checklist', 'note']);
function parseBoolean(value, flagName) {
    if (value === undefined || value === null || value === '')
        return undefined;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized))
        return true;
    if (['false', '0', 'no', 'n'].includes(normalized))
        return false;
    throw new Error(`${flagName} must be true or false`);
}
function parseConfidence(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1)
        throw new Error('--confidence must be a number between 0 and 1');
    return parsed;
}
function buildCorrection(args) {
    if (!args.correctClaim && !args.correctTitle && !args.correctPath && !args.correctTask && !args.correctEntity && !args.correctKind)
        return undefined;
    if (!args.correctClaim)
        throw new Error('--correct-claim is required when using correction flags');
    if (args.correctKind && !VALID_CORRECTION_KINDS.has(args.correctKind)) {
        throw new Error('--correct-kind must be rule, exception, procedure, checklist, or note');
    }
    const scope = {};
    const paths = collectValues(args.correctPath);
    const taskTypes = collectValues(args.correctTask);
    const entities = collectValues(args.correctEntity);
    if (paths.length > 0)
        scope.paths = paths;
    if (taskTypes.length > 0)
        scope.task_types = taskTypes;
    if (entities.length > 0)
        scope.entities = entities;
    const correction = { claim: args.correctClaim };
    setIfPresent(correction, 'title', args.correctTitle);
    setIfPresent(correction, 'kind', args.correctKind);
    if (Object.keys(scope).length > 0)
        correction.scope = scope;
    return correction;
}
async function buildEvaluatePayload(args) {
    const payload = parseJson(args.json ?? args.data, '--json');
    setIfPresent(payload, 'repo', args.repo ?? await inferRepoName(args.workspace ?? process.cwd()));
    if (args.ruleId || args.outcome) {
        if (!args.ruleId)
            throw new Error('--rule-id is required when using shortcut flags');
        if (!args.outcome)
            throw new Error('--outcome is required when using shortcut flags');
        if (!VALID_OUTCOMES.has(args.outcome)) {
            throw new Error('--outcome must be helpful, not-relevant, outdated, accepted, or failed');
        }
        payload.evaluations = [{
                rule_id: args.ruleId,
                outcome: args.outcome,
                adopted: parseBoolean(args.adopted, '--adopted'),
                confidence: parseConfidence(args.confidence),
                note: args.note,
                evidence: collectValues(args.evidence),
                correction: buildCorrection(args),
            }];
    }
    if (!payload.repo)
        throw new Error('--repo is required');
    if (!Array.isArray(payload.evaluations) || payload.evaluations.length === 0) {
        throw new Error('--data with evaluations or --rule-id/--outcome is required');
    }
    return payload;
}
export async function evaluateMemory(args) {
    const response = await apiRequest('POST', '/api/v1/agent/memory-evaluations', {
        data: await buildEvaluatePayload(args),
    });
    console.log(JSON.stringify(response, null, 2));
}
//# sourceMappingURL=evaluate.js.map