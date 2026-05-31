# Security Policy

## Supported Versions

Security fixes are provided for the latest published version of
`@inf-monkeys-tech/monkeys-memory-cli`.

## Reporting a Vulnerability

Please do not open a public issue for suspected vulnerabilities.

Report security issues by email:

```text
security@infmonkeys.com
```

Include:

- The affected CLI version
- The operating system and Node.js version
- Steps to reproduce
- Any relevant command output with tokens and private data removed

We will acknowledge valid reports as soon as possible and coordinate fixes
before public disclosure.

## Sensitive Data

The CLI stores local authentication state in:

```text
~/.monkeys-memory/config.json
```

Do not paste this file into public issues. Run `monkeys-memory logout` to remove
local credentials and revoke the current CLI token when possible.
