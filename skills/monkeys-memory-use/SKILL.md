---
name: monkeys-memory-use
description: Retrieve hosted Monkeys Memory before making code changes in an allowlisted repo. Pass narrow repo/path/task context, and include branch, tag, commit, user, team, or template scope when relevant.
---

# Monkeys Memory Use

Retrieve hosted, compiled team memory before making code changes. SaaS retrieval can return repo and org memory, hierarchy-aware results, lifecycle state, policy metadata, retrieval explanations, and review risk signals.

## When to retrieve

Use your judgment. Retrieve when:
- You are about to modify code and want to check team rules
- You are making an architectural decision
- You are doing a bugfix, refactor, or review in unfamiliar code
- The task touches policy-sensitive, branch-specific, release-specific, user/team-scoped, or template-scoped behavior
- You need to understand risks, lifecycle state, provenance, or why a memory item matched

Do NOT retrieve when:
- Answering simple questions
- Just reading code
- Trivial changes (typos, formatting)
- You already retrieved for the same repo/path/task context in this session

## How to retrieve

Required payload fields:
- `repo`

Strongly recommended payload fields when you know them:
- `path`
- `task`
- `limit`

Context fields to pass when relevant:
- `branch`
- `tag`
- `commit`
- `user_id`
- `team_id`
- `template_id`
- `include_sensitive`

Do not skip `path` or `task` casually. The API accepts them as optional, but retrieval quality is much better when you pass the current file path and the actual task type. Keep `include_sensitive` false unless you deliberately need to inspect secret-adjacent memory.

```bash
monkeys-memory retrieve --repo "<repo-name>" --path "<current-path>" --task "<task-type>" --limit 5
```

When branch, tag, commit, user, team, template, or sensitive-memory context matters, pass the matching flags:

```bash
monkeys-memory retrieve --repo "<repo-name>" --path "<current-path>" --task "<task-type>" --branch "<branch-name>" --tag "<tag>" --commit "<commit-sha>" --user-id "<user-id>" --team-id "<team-id>" --template-id "<template-id>" --include-sensitive --limit 5
```

Task types: `bugfix`, `hotfix`, `refactor`, `feature`, `review`

Before sending:
- Confirm `repo` matches the current repository name
- Use the most specific current file or folder in `path`, not just `src/**`
- Pick the real task type instead of leaving `task` blank
- Include branch/tag/commit context for release-specific work
- Include user/team/template context for scoped memory
- Keep `limit` small, usually `5`

## What you get back

Hosted retrieval returns ranked memory and may include hierarchy groups:

```json
{
  "enabled": true,
  "repo": "monkeys-memory-server",
  "rules": [
    {
      "claim": "Route settlement changes through adapter first.",
      "confidence": "high",
      "scope": { "paths": ["src/settlement/**"] },
      "lifecycle": { "state": "confirmed" },
      "policy": { "visibility": "team", "sensitivity": "normal" },
      "runtime_score": 100,
      "explanation": {
        "why": ["path matched src/settlement/**"],
        "risks": [],
        "matched_scope": { "paths": ["src/settlement/**"], "task": "feature" }
      }
    }
  ],
  "exceptions": [],
  "org_rules": [],
  "agent_actions": [],
  "hierarchy": {
    "user": [],
    "team": [],
    "template": [],
    "repo": [],
    "org": [],
    "global": []
  }
}
```

Apply the returned memory to your work. Treat stale, contested, superseded, low-confidence, or policy-sensitive items as signals to be careful rather than absolute instructions.

If rules conflict, prefer the most specific active or confirmed memory for the current repo/path/task/version scope.

## Agent Memory Evaluation

After the coding task finishes, evaluate the memory you retrieved. This is the primary impact signal for Monkeys Memory. Human review is optional; agents should report whether retrieved memory was useful or stale based on the work they actually performed.

Only evaluate rules that were returned by this session's retrieve call. Use:
- `helpful` when a memory item was relevant and helped the task succeed
- `accepted` when the item was directly adopted as guidance
- `outdated` when the item conflicts with the current repository, missing paths, changed APIs, dependency versions, or verified test/build evidence
- `not-relevant` when it matched retrieval but did not apply to this task
- `failed` when following the memory caused a failed attempt or regression

Send one compact batch before final response when you have any meaningful evaluation:

```bash
monkeys-memory memory-evaluate \
  --data "{\"repo\":\"<repo-name>\",\"task\":{\"summary\":\"<short-task-summary>\",\"outcome\":\"success\",\"tests_passed\":true,\"build_passed\":true,\"lint_passed\":true},\"evaluations\":[{\"rule_id\":\"<returned-rule-id>\",\"outcome\":\"helpful\",\"adopted\":true,\"confidence\":0.84,\"note\":\"Applied this rule while changing the auth middleware.\",\"evidence\":[\"npm test passed\"]},{\"rule_id\":\"<returned-rule-id>\",\"outcome\":\"outdated\",\"adopted\":false,\"confidence\":0.9,\"note\":\"Referenced path no longer exists in this repo.\"}]}"
```

Do not invent evaluations for memory you did not inspect. If no memory was retrieved, or none was relevant enough to judge, skip this call. Keep notes factual and avoid secrets.

## Agent Actions

The response may include `agent_actions`. These are autonomous maintenance tasks requested by the backend for the current repo and shared across the organization.

Skills are bundled with the npm CLI package. The CLI periodically checks npm for a newer package version and syncs the bundled Skills after upgrade; the backend no longer leases skill update actions.

When `agent_actions` is present:
- Finish the user's main coding task first.
- For each remaining supported action, run it once after the main task.
- For `repo_scan`, prefer an Agent-authored guide instead of treating the CLI as the source of repository meaning:
  1. Run a local fact scan with `--no-report`.
  2. Inspect the paths, commands, frameworks, existing `AGENTS.md`, and important modules.
  3. Write `agent_repo_guide` as compact JSON using this schema:

```json
{
  "schema_version": 1,
  "summary": "What this repository is and what it owns.",
  "architecture": ["Main architectural facts the agent should know."],
  "primary_workflows": ["Common development or runtime workflows."],
  "ownership": {
    "owns": ["Areas this repo owns."],
    "does_not_own": ["Areas that belong elsewhere."],
    "boundaries": ["Important cross-repo or module boundaries."]
  },
  "commands": [{ "name": "test", "command": "npm run test", "purpose": "Run automated tests." }],
  "agent_instructions": ["Stable instructions future agents should follow in this repo."],
  "memory_hints": ["What kinds of memory would improve retrieval here."],
  "confidence": "medium"
}
```

Then report the scan with the guide:

```bash
monkeys-memory agent-action-result \
  --workspace "<current-repo>" \
  --action-id "<action-id>" \
  --type repo_scan \
  --data "{\"agent_repo_guide\":{...}}"
```

Repo scans are compact by default when reported: the CLI sends counts, directory indexes, path/entity samples, repo profile, and the Agent guide instead of full path/entity lists. Add `--full-scan` only when a full repository index is explicitly needed.

If you cannot safely write the guide, run the same command without `--data`; the CLI will still report deterministic scan facts.

Do not ask the user to connect GitHub for this. The backend leases and deduplicates repo actions across the organization. Skill updates come from npm CLI releases.

## Policy simulation

If you have owner/admin permission and need to debug hidden memory, use the policy simulation API with the same context:

```bash
monkeys-memory api POST /api/v1/policy/simulate-retrieve \
  --data "{\"repo\":\"<repo-name>\",\"path\":\"<current-path>\",\"task\":\"<task-type>\",\"branch\":\"<branch-name>\",\"tag\":\"<tag>\",\"commit\":\"<commit-sha>\",\"user_id\":\"<user-id>\",\"team_id\":\"<team-id>\",\"template_id\":\"<template-id>\",\"include_sensitive\":false}"
```

The simulation response separates `allowed` and `hidden` memory and explains reasons such as `secret-adjacent-hidden`, `redaction-blocked`, `branch-mismatch`, `tag-mismatch`, `commit-before-validity`, `commit-after-validity`, `user-visibility-mismatch`, `team-visibility-mismatch`, or `template-mismatch`.

If the response has no rules:
- Treat that as "no relevant memory found", not as an API failure
- Continue the task normally without inventing rules

## Fallback

If the API is unreachable, continue without memory. Do not block on this.
