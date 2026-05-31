import type { CLIArgs, JsonObject } from '../types/api.js';
export declare function collectValues(value: unknown): string[];
export declare function setIfPresent(target: JsonObject, key: string, value: unknown): void;
export declare function parseJson(value: unknown, flagName: string): JsonObject;
export declare function parseArgs(argv: string[]): CLIArgs;
