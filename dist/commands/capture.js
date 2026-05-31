import { collectValues, parseJson, setIfPresent } from '../core/args.js';
import { apiRequest } from '../core/http.js';
import { inferRepoName } from '../local/git.js';
import { agentCapabilities } from '../local/skills.js';
import { runImmediateActions } from './actions.js';
async function buildCapturePayload(args) {
    const payload = parseJson(args.json ?? args.data, '--json');
    setIfPresent(payload, 'repo', args.repo ?? await inferRepoName(args.workspace ?? process.cwd()));
    setIfPresent(payload, 'title', args.title);
    setIfPresent(payload, 'claim', args.claim);
    setIfPresent(payload, 'kind', args.kind);
    const paths = collectValues(args.path);
    const tasks = collectValues(args.task);
    const entities = collectValues(args.entity);
    if (paths.length > 0 || tasks.length > 0 || entities.length > 0) {
        const currentScope = (payload.scope && typeof payload.scope === 'object' && !Array.isArray(payload.scope)) ? payload.scope : {};
        payload.scope = {
            ...currentScope,
            ...(paths.length > 0 ? { paths } : {}),
            ...(tasks.length > 0 ? { task_types: tasks } : {}),
            ...(entities.length > 0 ? { entities } : {}),
        };
    }
    if (args.evidenceType && args.evidenceRef)
        payload.evidence = [{ type: args.evidenceType, ref: args.evidenceRef }];
    payload.agent_capabilities = await agentCapabilities();
    if (!payload.repo)
        throw new Error('--repo is required');
    if (!payload.title)
        throw new Error('--title is required');
    if (!payload.claim)
        throw new Error('--claim is required');
    const scope = payload.scope;
    if (!Array.isArray(scope?.paths) || scope.paths.length === 0)
        throw new Error('--path is required');
    return payload;
}
export async function capture(args) {
    const response = await apiRequest('POST', '/api/v1/capture', { data: await buildCapturePayload(args) });
    console.log(JSON.stringify(await runImmediateActions(response, args), null, 2));
}
//# sourceMappingURL=capture.js.map