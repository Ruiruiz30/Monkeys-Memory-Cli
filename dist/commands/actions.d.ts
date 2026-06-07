import type { CLIArgs, JsonObject } from '../types/api.js';
type ActionReportContext = {
    orgId?: string;
    repo?: string | null;
};
export declare function reportAction(actionId: string, result: unknown, context?: ActionReportContext): Promise<JsonObject>;
export declare function runImmediateActions(response: JsonObject, args: CLIArgs): Promise<JsonObject>;
export declare function agentActionResult(args: CLIArgs): Promise<void>;
export {};
