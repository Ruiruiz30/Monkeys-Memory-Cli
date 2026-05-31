import { reportAction } from './actions.js';
import { skillUpdateResult } from '../local/skills.js';
import type { CLIArgs } from '../types/api.js';

export async function updateSkills(args: CLIArgs): Promise<void> {
  const action = { id: args.actionId, payload: { manifest_url: args.manifestUrl, manifest_hash: args.manifestHash } };
  const result = await skillUpdateResult(action);
  const report = args.actionId && !args.noReport ? await reportAction(args.actionId, result) : null;
  console.log(JSON.stringify({ result, report }, null, 2));
}
