import { parseJson } from '../core/args.js';
import { apiRequest } from '../core/http.js';
import type { CLIArgs } from '../types/api.js';

function normalizeApiPath(rawPath: string): string {
  if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) return rawPath;
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return path.startsWith('/api/') ? path : `/api/v1${path}`;
}

export async function apiCommand(args: CLIArgs): Promise<void> {
  const [method, rawPath] = args._;
  if (!method || !rawPath) throw new Error('usage: monkeys-memory api <METHOD> <PATH> [--data <json>] [--params <json>] [--org-id <orgId>]');
  const result = await apiRequest(method.toUpperCase(), normalizeApiPath(rawPath), {
    data: args.data ? parseJson(args.data, '--data') : undefined,
    params: parseJson(args.params, '--params'),
    headers: args.orgId ? { 'X-Org-Id': args.orgId } : undefined,
  });
  console.log(JSON.stringify(result, null, 2));
}
