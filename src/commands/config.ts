import { readConfig, trimTrailingSlash, writeConfig } from '../core/config.js';
import type { CLIArgs } from '../types/api.js';

export async function configCommand(args: CLIArgs): Promise<void> {
  const [sub, key, value] = args._;
  if (sub === 'get' || !sub) {
    const config = await readConfig();
    console.log(JSON.stringify({ ...config, token: config.token ? `${config.token.slice(0, 10)}...` : undefined }, null, 2));
    return;
  }
  if (sub === 'set' && key === 'api-url' && value) {
    await writeConfig({ ...(await readConfig()), apiUrl: trimTrailingSlash(value) });
    console.log(JSON.stringify({ ok: true, api_url: trimTrailingSlash(value) }, null, 2));
    return;
  }
  throw new Error('usage: monkeys-memory config get | config set api-url <url>');
}
