import { collectValues, parseJson, setIfPresent } from '../core/args.js';
import { apiRequest } from '../core/http.js';
import { inferRepoName } from '../local/git.js';
import type { CLIArgs, JsonObject } from '../types/api.js';

const VALID_OUTCOMES = new Set(['helpful', 'not-relevant', 'outdated', 'accepted', 'failed']);

function parseBoolean(value: unknown, flagName: string): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  throw new Error(`${flagName} must be true or false`);
}

function parseConfidence(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) throw new Error('--confidence must be a number between 0 and 1');
  return parsed;
}

async function buildEvaluatePayload(args: CLIArgs): Promise<JsonObject> {
  const payload = parseJson(args.json ?? args.data, '--json');
  setIfPresent(payload, 'repo', args.repo ?? await inferRepoName(args.workspace ?? process.cwd()));

  if (args.ruleId || args.outcome) {
    if (!args.ruleId) throw new Error('--rule-id is required when using shortcut flags');
    if (!args.outcome) throw new Error('--outcome is required when using shortcut flags');
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
    }];
  }

  if (!payload.repo) throw new Error('--repo is required');
  if (!Array.isArray(payload.evaluations) || payload.evaluations.length === 0) {
    throw new Error('--data with evaluations or --rule-id/--outcome is required');
  }
  return payload;
}

export async function evaluateMemory(args: CLIArgs): Promise<void> {
  const response = await apiRequest<JsonObject>('POST', '/api/v1/agent/memory-evaluations', {
    data: await buildEvaluatePayload(args),
  });
  console.log(JSON.stringify(response, null, 2));
}
