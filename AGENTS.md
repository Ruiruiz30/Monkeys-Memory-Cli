# Repository Guidelines

## Product Boundary
This repository is the open-source SaaS CLI for Monkeys Memory. It is published
to npm as `@inf-monkeys-tech/monkeys-memory-cli` and provides the local command
surface used by humans, Codex, Claude Code, and other coding agents.

This repository is not the standalone OSS Monkeys Memory core. The
`monkeys-memory/` OSS repository is a separate open-source local product. Do
not import OSS engine code here or assume this package should work without the
hosted SaaS API.

This repository is also not the private SaaS backend or frontend. Hosted API
behavior, account/session auth, organizations, billing, quotas, workers, and
persistence belong in `monkeys-memory-server/`; browser UI and setup flows
belong in `monkeys-memory-web/`.

## Skills Ownership
The bundled SaaS Skills live in `skills/` and this repository is their source
of truth.

- `skills/monkeys-memory-use/SKILL.md`: retrieval workflow for coding agents.
- `skills/monkeys-memory-capture/SKILL.md`: capture workflow for reusable
  engineering memory.
- `skills/manifest.txt`: package-local list of bundled Skill files.

`monkeys-memory install-skills` syncs these bundled Skills into
`~/.codex/skills` and `~/.claude/skills`. The server should not own or serve
the Skill source files. Skill updates ship through new npm versions of this
package.

## Project Structure & Module Organization
- `bin/`: npm binary shim.
- `src/commands/`: CLI command handlers.
- `src/core/`: argument parsing, config, HTTP, crypto, and update helpers.
- `src/local/`: local git scanning and Skill installation helpers.
- `src/types/`: shared TypeScript types.
- `skills/`: bundled Codex and Claude Code Skills.
- `dist/`: compiled publishable JavaScript. Keep it in sync before publishing.
- `test/`: Node test suite for CLI behavior.

## Build, Test, and Publishing Commands
Use Node.js 22+ for runtime compatibility. Use Bun as the package manager.

- `bun install`: install dependencies.
- `bun run build`: compile TypeScript into `dist/`.
- `bun test`: run CLI behavior tests.
- `bun run check`: run type and syntax checks.
- `npm pack --dry-run`: verify the publish tarball, including `skills/`.
- `npm publish --access public`: publish a new npm version.

Before publishing, bump `package.json` to a new version because npm versions are
immutable. After publishing, verify with:

```bash
npm view @inf-monkeys-tech/monkeys-memory-cli version dist-tags
```

## Coding Style & Constraints
Follow the existing TypeScript style: ES modules, 2-space indentation, single
quotes, explicit helper boundaries, and no unnecessary abstractions.

The published CLI must run on Node.js 22+ without requiring Bun on user
machines. Bun is for development/package management only.

CLI state belongs under `~/.monkeys-memory/`. Do not write tokens elsewhere and
do not print raw CLI tokens in normal command output.

## Update Model
The CLI periodically checks npm for a newer
`@inf-monkeys-tech/monkeys-memory-cli` release. When a newer release exists, it
updates the global npm package and syncs bundled Skills again. Keep update
checks lightweight, rate-limited, and non-blocking when npm is unavailable.

Because versions before `0.2.0` did not include auto-update logic, users on
older versions need one manual `npm install -g
@inf-monkeys-tech/monkeys-memory-cli@latest` before automatic updates can work.

## Security
Do not commit SaaS backend code, frontend private code, production secrets,
tokens, customer data, or environment-specific URLs. Keep this repo safe to
publish publicly.

If you add commands that call the hosted API, use the existing config and HTTP
helpers so auth, API URL handling, and error behavior stay consistent.
