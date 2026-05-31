# Contributing

Thanks for helping improve Monkeys Memory CLI.

This repository contains the open-source CLI client for Monkeys Memory SaaS. It
does not contain the SaaS backend, web application, billing system, hosted
compiler, or private infrastructure.

## Development

Requirements:

- Bun 1.3+
- Node.js 22+

Setup:

```bash
bun install
bun run build
bun test
bun run check
```

Before opening a pull request, run:

```bash
bun run build
bun test
bun run check
npm pack --dry-run
```

## Code Style

- Source code is TypeScript under `src/`.
- Published JavaScript is emitted to `dist/`.
- Keep command behavior JSON-friendly for agents.
- Do not add SaaS server or web implementation details to this repository.
- Do not commit tokens, local config, account data, or private endpoint logs.

## Contributions and License

Unless explicitly stated otherwise, contributions submitted to this repository
are licensed under the Apache License, Version 2.0.
