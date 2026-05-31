import { parseArgs } from './core/args.js';
import { agentCapabilities } from './local/skills.js';
import { login, logout, authStatus } from './commands/auth.js';
import { configCommand } from './commands/config.js';
import { retrieve } from './commands/retrieve.js';
import { capture } from './commands/capture.js';
import { repoScan } from './commands/repo.js';
import { updateSkills } from './commands/skills.js';
import { agentActionResult } from './commands/actions.js';
import { apiCommand } from './commands/api.js';
import { evaluateMemory } from './commands/evaluate.js';

function usage(): void {
  console.log(`Usage:
  monkeys-memory login [--api-url <url>] [--no-open] [--device-name <name>]
  monkeys-memory logout
  monkeys-memory auth status
  monkeys-memory config get
  monkeys-memory config set api-url <url>
  monkeys-memory retrieve [--repo <repo>] [--path <path>] [--task <task>] [--limit <n>]
  monkeys-memory capture [--repo <repo>] --title <title> --claim <claim> --path <path> [--task <task>]
  monkeys-memory memory-evaluate [--repo <repo>] --rule-id <id> --outcome helpful|not-relevant|outdated|accepted|failed
  monkeys-memory repo scan [--repo <repo>] [--workspace <dir>] [--action-id <id>] [--no-report]
  monkeys-memory update-skills [--action-id <id>] [--manifest-url <url>] [--manifest-hash <sha256>] [--no-report]
  monkeys-memory install-skills [--manifest-url <url>] [--manifest-hash <sha256>]
  monkeys-memory agent-capabilities
  monkeys-memory agent-action-result --action-id <id> --type repo_scan|skill_update [--workspace <dir>] [--no-report]
  monkeys-memory api <METHOD> <PATH> [--data <json>] [--params <json>]`);
}

export async function main(argv: string[]): Promise<void> {
  const command = argv[0];
  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }
  const subArgs = parseArgs(argv.slice(1));
  if (subArgs.help) {
    usage();
    return;
  }
  if (command === 'login') return login(subArgs);
  if (command === 'logout') return logout();
  if (command === 'auth' && subArgs._[0] === 'status') return authStatus();
  if (command === 'config') return configCommand(subArgs);
  if (command === 'retrieve') return retrieve(subArgs);
  if (command === 'capture') return capture(subArgs);
  if (command === 'memory-evaluate' || command === 'evaluate-memory') return evaluateMemory(subArgs);
  if (command === 'repo' && subArgs._[0] === 'scan') return repoScan({ ...subArgs, _: subArgs._.slice(1) });
  if (command === 'update-skills' || command === 'install-skills') return updateSkills(subArgs);
  if (command === 'agent-capabilities') {
    console.log(JSON.stringify(await agentCapabilities(), null, 2));
    return;
  }
  if (command === 'agent-action-result') return agentActionResult(subArgs);
  if (command === 'api') return apiCommand(subArgs);
  usage();
  process.exitCode = 1;
}
