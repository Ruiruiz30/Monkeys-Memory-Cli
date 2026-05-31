import type { CLIArgs, JsonObject } from '../types/api.js';
export declare function reportAction(actionId: string, result: unknown): Promise<JsonObject>;
export declare function runImmediateActions(response: JsonObject, args: CLIArgs): Promise<JsonObject>;
export declare function agentActionResult(args: CLIArgs): Promise<void>;
