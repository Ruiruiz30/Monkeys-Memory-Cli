import { collectValues, parseJson, setIfPresent } from '../core/args.js';
import { apiRequest } from '../core/http.js';
import { inferGitContext } from '../local/git.js';
import { agentCapabilities } from '../local/skills.js';
import { runImmediateActions } from './actions.js';
import type { CLIArgs, JsonObject } from '../types/api.js';

async function buildRetrievePayload(args: CLIArgs): Promise<JsonObject> {
  const payload = parseJson(args.json ?? args.data, '--json');
  const gitContext = await inferGitContext(args.workspace ?? process.cwd());
  setIfPresent(payload, 'repo', args.repo ?? gitContext.repo);
  setIfPresent(payload, 'path', Array.isArray(args.path) ? collectValues(args.path)[0] : args.path);
  setIfPresent(payload, 'task', Array.isArray(args.task) ? collectValues(args.task)[0] : args.task);
  setIfPresent(payload, 'branch', args.branch ?? gitContext.branch);
  setIfPresent(payload, 'tag', args.tag);
  setIfPresent(payload, 'commit', args.commit ?? gitContext.commit);
  setIfPresent(payload, 'user_id', args.userId);
  setIfPresent(payload, 'team_id', args.teamId);
  setIfPresent(payload, 'template_id', args.templateId);
  if (args.limit !== undefined) payload.limit = Number(args.limit);
  if (args.includeSensitive) payload.include_sensitive = true;
  payload.agent_capabilities = await agentCapabilities();
  if (!payload.repo) throw new Error('--repo is required');
  return payload;
}

export async function retrieve(args: CLIArgs): Promise<void> {
  const response = await apiRequest<JsonObject>('POST', '/api/v1/retrieve', { data: await buildRetrievePayload(args) });
  console.log(JSON.stringify(await runImmediateActions(response, args), null, 2));
}
