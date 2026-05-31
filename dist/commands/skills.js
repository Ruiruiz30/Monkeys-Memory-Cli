import { reportAction } from './actions.js';
import { skillUpdateResult } from '../local/skills.js';
export async function updateSkills(args) {
    const action = { id: args.actionId, payload: {} };
    const result = await skillUpdateResult(action);
    const report = args.actionId && !args.noReport ? await reportAction(args.actionId, result) : null;
    console.log(JSON.stringify({ result, report }, null, 2));
}
//# sourceMappingURL=skills.js.map