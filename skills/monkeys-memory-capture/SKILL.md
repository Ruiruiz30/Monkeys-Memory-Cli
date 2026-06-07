---
name: monkeys-memory-capture
description: Capture reusable engineering insights to hosted Monkeys Memory after code changes. Capture only stable rules, constraints, decisions, or evidence-backed lessons future developers should reuse.
---

# Monkeys Memory Capture

Save team knowledge to the hosted Monkeys Memory SaaS so the next developer doesn't repeat the same discovery. Capture high-signal engineering memory with scope, evidence, lifecycle, provenance, policy, and validity metadata when relevant.

## When to capture

Use your judgment. Capture when:
- You discovered a non-obvious constraint
- A debugging session revealed a hidden dependency
- A review surfaced a stable rule for future changes
- You made a decision future developers should know about
- The session produced a reusable procedure, checklist, exception, or note
- A test, PR, incident, trace, review, or policy simulation produced evidence future agents should respect

Do NOT capture when:
- The fix was trivial and self-evident
- It's a personal preference, not a team convention
- It's a temporary workaround
- It's generic programming advice
- The insight contains secrets or customer data that should not be persisted

## How to capture

Required payload fields:
- `repo`
- `title`
- `claim`
- `scope.paths`

Do not send the request if any of those four fields are missing. `title` is mandatory even when `claim` already feels descriptive.

```bash
monkeys-memory capture --repo "<repo-name>" --title "<short-title>" --claim "<what-future-devs-should-know>" --kind rule --path "<path-pattern>" --task "<task>"
```

When you have entity or evidence metadata, include it with flags:

```bash
monkeys-memory capture --repo "<repo-name>" --title "<short-title>" --claim "<what-future-devs-should-know>" --kind rule --path "<path-pattern>" --task "<task>" --entity "<entity-name>" --evidence-type test --evidence-ref "<test-or-pr-or-commit-ref>"
```

Allowed `kind` values: `rule`, `exception`, `procedure`, `checklist`, `note`

Useful metadata:
- `scope.paths`: affected files or glob patterns; keep this narrow
- `scope.task_types`: task types such as `bugfix`, `hotfix`, `refactor`, `feature`, `review`
- `scope.entities`: module, API, route, table, component, or function names when known
- `evidence`: test, PR, issue, commit, trace, incident, review, or doc references
- `lifecycle.state`: `candidate`, `active`, `confirmed`, `contested`, `stale`, `deprecated`, or `superseded`
- `policy.visibility`: `user`, `team`, `template`, `repo`, `org`, or `global`
- `policy.sensitivity`: `normal`, `internal`, or `secret-adjacent`
- `validity`: branch, tag, or commit range where the memory is valid

Write a good claim:
- Bad: "Fixed the bug in settlement"
- Good: "Settlement changes must go through the adapter layer; direct service patches break reconciliation"
- Good: "Release-branch retrieval must pass branch/tag/commit context because policy filtering can hide otherwise relevant memory"

Before sending:
- Re-read the JSON body once and confirm it still includes `repo`, `title`, `claim`, and `scope.paths`
- Keep `title` short and scannable, usually 2-6 words
- Put the durable engineering rule in `claim`, not the one-off fix details
- Scope the memory as tightly as the evidence allows
- Include evidence and validity metadata for high-impact or release-sensitive memory

## Auto capture

If you are wiring a post-commit or automation flow, use:

```bash
monkeys-memory api POST /api/v1/capture/auto \
  --data "{\"repo\":\"<repo-name>\",\"commit_message\":\"<commit-message>\",\"changed_files\":[\"<path>\"],\"diff_summary\":\"<optional-summary>\"}"
```

Auto-capture is lower-confidence than a deliberate manual capture. Prefer manual capture for nuanced or high-value lessons.

## Agent Actions

Capture responses may include `agent_actions`. These are backend-controlled maintenance tasks for the repo, shared across the organization.

Skills are bundled with the npm CLI package. The CLI periodically checks npm for a newer package version and syncs the bundled Skills after upgrade; the backend no longer leases skill update actions.

When `agent_actions` is present:
- Finish the user's main task and capture decision first.
- For each remaining supported action, run it once after capture.
- For `repo_scan`, prefer an Agent-authored guide instead of treating the CLI as the source of repository meaning. Run a local fact scan, inspect paths/commands/frameworks/`AGENTS.md`, then report a compact `agent_repo_guide`:

```bash
monkeys-memory agent-action-result \
  --workspace "<current-repo>" \
  --action-id "<action-id>" \
  --type repo_scan \
  --data "{\"agent_repo_guide\":{\"schema_version\":1,\"summary\":\"What this repo is and owns.\",\"architecture\":[\"Key architectural facts.\"],\"primary_workflows\":[\"Common workflows.\"],\"ownership\":{\"owns\":[\"Owned areas.\"],\"does_not_own\":[\"External areas.\"],\"boundaries\":[\"Important boundaries.\"]},\"commands\":[{\"name\":\"test\",\"command\":\"npm run test\",\"purpose\":\"Run automated tests.\"}],\"agent_instructions\":[\"Stable instructions for future agents.\"],\"memory_hints\":[\"What memory would help retrieval here.\"],\"confidence\":\"medium\"}}"
```

If you cannot safely write the guide, run the same command without `--data`; the CLI will still report deterministic scan facts.

Repo scans are compact by default when reported: the CLI sends counts, directory indexes, path/entity samples, repo profile, and the Agent guide instead of full path/entity lists. Add `--full-scan` only when a full repository index is explicitly needed.

Do not ask the user to sync code manually or connect GitHub. The backend controls freshness and leases for repo actions. Skill updates come from npm CLI releases.

## Redaction

The SaaS server scans title, claim, and evidence references before persistence. It redacts detected sensitive strings, records redaction findings, and marks policy metadata. Still avoid sending secrets; redaction is a safety net, not a reason to paste credentials.

## Fallback

If the API is unreachable, skip capture silently.
