# Monkeys Memory CLI

Official open-source CLI for Monkeys Memory SaaS.

Monkeys Memory helps coding agents retrieve and capture team engineering memory.
The CLI handles browser login, local repository scanning, official Skill
installation, and agent-friendly JSON commands.

## Install

```bash
npm install -g @inf-monkeys-tech/monkeys-memory-cli
monkeys-memory login
```

`login` opens your browser, authorizes the current terminal, stores a local CLI
token, and syncs the official Codex and Claude Code Skills.

The official Skills are bundled in this npm package and are updated when you
upgrade the CLI.

## Common Commands

```bash
monkeys-memory auth status
monkeys-memory install-skills
monkeys-memory retrieve --repo my-repo --path src/file.ts --task bugfix --limit 5
monkeys-memory capture --repo my-repo --title "Adapter rule" --claim "Always validate through the adapter." --path "src/adapter/**" --task feature
monkeys-memory memory-evaluate --repo my-repo --rule-id rule_1 --outcome helpful --adopted true --confidence 0.86 --evidence "npm test passed"
monkeys-memory repo scan --repo my-repo --workspace .
```

When `--repo` is omitted, the CLI tries to infer the repository name from the
current git remote or workspace folder.

## Agent Workflow

Installed Skills call the CLI instead of calling the hosted API directly:

- `monkeys-memory retrieve` fetches relevant team memory.
- `monkeys-memory capture` saves reusable engineering insights.
- `monkeys-memory memory-evaluate` reports whether retrieved memory helped or no
  longer matches the repository.
- `monkeys-memory repo scan` reports local repository metadata.
- `monkeys-memory install-skills` refreshes official Skills from the installed
  CLI package.

The CLI periodically checks npm for a newer `@inf-monkeys-tech/monkeys-memory-cli`
release. When a newer version exists, it updates the global package with npm and
then syncs the bundled Skills again.

Commands print JSON so coding agents can consume the output reliably.

## Configuration

The CLI stores local state in:

```text
~/.monkeys-memory/config.json
```

Environment variables:

```bash
MONKEYS_MEMORY_API_URL=https://memory.infmonkeys.work
MONKEYS_MEMORY_TOKEN=mk_cli_...
```

`MONKEYS_MEMORY_TOKEN` is mainly for tests and automation. For normal local
development, use `monkeys-memory login`.

## Development

This package uses Bun for package management and TypeScript for source code.
The published CLI runs on Node.js 22+.

```bash
bun install
bun run build
bun test
bun run check
npm pack --dry-run
```

Project layout:

```text
bin/                  npm binary shim
src/commands/         CLI command handlers
src/core/             args, config, HTTP, crypto helpers
src/local/            git and local Skill installation helpers
src/types/            shared TypeScript types
skills/               official Codex and Claude Code Skills bundled with CLI
dist/                 compiled publishable JavaScript
test/                 CLI behavior tests
```

## Open Source Boundary

This repository contains only the open-source CLI client.

It does not include the Monkeys Memory SaaS backend, web application, billing
system, hosted compiler, worker infrastructure, or private operational code.

The CLI defaults to the hosted Monkeys Memory API. You can point it to another
compatible API with:

```bash
monkeys-memory config set api-url <url>
```

## Security

Please report vulnerabilities privately. See [SECURITY.md](SECURITY.md).

Do not paste `~/.monkeys-memory/config.json`, CLI tokens, or private repository
data into public issues.

## License

Licensed under the [Apache License, Version 2.0](LICENSE).
