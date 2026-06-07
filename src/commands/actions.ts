import { apiRequest } from '../core/http.js';
import { inferRepoName, repoScanResult } from '../local/git.js';
import type { CLIArgs, JsonObject } from '../types/api.js';

type ActionReportContext = {
  orgId?: string;
  repo?: string | null;
};

export async function reportAction(actionId: string, result: unknown, context: ActionReportContext = {}): Promise<JsonObject> {
  const data: JsonObject = result instanceof Error
    ? { status: 'failed', error: result.message }
    : { status: 'completed', result };
  if (context.repo) data.repo = context.repo;

  return apiRequest<JsonObject>('POST', `/api/v1/agent-actions/${encodeURIComponent(actionId)}/result`, {
    data,
    headers: context.orgId ? { 'X-Org-Id': context.orgId } : undefined,
  });
}

export async function runImmediateActions(response: JsonObject, args: CLIArgs): Promise<JsonObject> {
  if (args.noAutoActions) return response;
  return response;
}

export async function agentActionResult(args: CLIArgs): Promise<void> {
  if (!args.actionId) throw new Error('--action-id is required');
  if (args.type && args.type !== 'repo_scan') throw new Error(`unsupported agent action type: ${args.type}`);
  const workspace = args.workspace ?? process.cwd();
  const repo = args.repo ?? await inferRepoName(workspace);
  const result = await repoScanResult(workspace);
  const report = args.noReport ? null : await reportAction(args.actionId, result, { orgId: args.orgId, repo });
  console.log(JSON.stringify({ action_id: args.actionId, type: args.type ?? 'repo_scan', repo, result, report }, null, 2));
}
