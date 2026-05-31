import type { CLIArgs, JsonObject } from '../types/api.js';

export function collectValues(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

export function setIfPresent(target: JsonObject, key: string, value: unknown): void {
  if (value !== undefined && value !== null && value !== '') target[key] = value;
}

export function parseJson(value: unknown, flagName: string): JsonObject {
  if (!value) return {};
  try {
    const parsed = JSON.parse(String(value));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('must be a JSON object');
    return parsed as JsonObject;
  } catch (error) {
    throw new Error(`${flagName} must be a JSON object: ${(error as Error).message}`);
  }
}

export function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token.startsWith('--')) {
      const key = token.slice(2).replace(/-([a-z])/g, (_, char: string) => char.toUpperCase()) as keyof CLIArgs;
      if (['includeSensitive', 'noAutoActions', 'noReport', 'noOpen'].includes(key)) {
        args[key] = true as never;
      } else {
        if (next === undefined) throw new Error(`${token} requires a value`);
        if (['path', 'task', 'entity', 'evidence'].includes(key) && args[key] !== undefined) {
          args[key] = [...collectValues(args[key]), next] as never;
        } else {
          args[key] = next as never;
        }
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}
