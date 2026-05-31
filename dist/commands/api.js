import { parseJson } from '../core/args.js';
import { apiRequest } from '../core/http.js';
export async function apiCommand(args) {
    const [method, rawPath] = args._;
    if (!method || !rawPath)
        throw new Error('usage: monkeys-memory api <METHOD> <PATH> [--data <json>] [--params <json>]');
    const result = await apiRequest(method.toUpperCase(), rawPath, {
        data: args.data ? parseJson(args.data, '--data') : undefined,
        params: parseJson(args.params, '--params'),
    });
    console.log(JSON.stringify(result, null, 2));
}
//# sourceMappingURL=api.js.map