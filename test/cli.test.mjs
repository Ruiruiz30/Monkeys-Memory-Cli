import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const cliPath = path.resolve('bin/monkeys-memory.js');

async function run(args, options = {}) {
  const home = options.home ?? await mkdtemp(path.join(os.tmpdir(), 'mm-cli-test-'));
  return execFileAsync(process.execPath, [cliPath, ...args], {
    cwd: options.cwd ?? process.cwd(),
    env: { ...process.env, MONKEYS_MEMORY_SKIP_UPDATE_CHECK: '1', HOME: home, USERPROFILE: home, ...options.env },
    encoding: 'utf8',
  });
}

async function startServer(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', async () => {
      const body = raw ? JSON.parse(raw) : null;
      requests.push({
        method: req.method,
        url: req.url,
        body,
        authorization: req.headers.authorization,
        orgId: req.headers['x-org-id'],
      });
      const result = await handler(req, body);
      res.statusCode = result.status ?? 200;
      res.setHeader('Content-Type', result.text === undefined ? 'application/json' : 'text/plain');
      res.end(result.text ?? JSON.stringify(result.body ?? {}));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    requests,
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function createGitRepo(remoteUrl = 'git@github.com:inf-monkeys-tech/product-api.git') {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'mm-cli-repo-'));
  await writeFile(path.join(repo, 'index.js'), 'console.log("ok");\n');
  await execFileAsync('git', ['init'], { cwd: repo });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: repo });
  await execFileAsync('git', ['add', '.'], { cwd: repo });
  await execFileAsync('git', ['commit', '-m', 'init'], { cwd: repo });
  await execFileAsync('git', ['remote', 'add', 'origin', remoteUrl], { cwd: repo });
  return repo;
}

test('prints help', async () => {
  const { stdout } = await run(['--help']);
  assert.match(stdout, /monkeys-memory login/);
  assert.match(stdout, /monkeys-memory retrieve/);
  assert.match(stdout, /monkeys-memory install-skills/);
});

test('prints default config with redacted token field absent', async () => {
  const { stdout } = await run(['config', 'get']);
  const config = JSON.parse(stdout);
  assert.equal(config.apiUrl, 'https://memory.infmonkeys.work');
  assert.equal(config.token, undefined);
});

test('package bin is executable', async () => {
  const mode = (await import('node:fs/promises')).stat ? (await (await import('node:fs/promises')).stat(cliPath)).mode : 0;
  assert.equal(Boolean(mode & 0o111), true);
});

test('repo scan infers repo name from git remote when --repo is omitted', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'mm-cli-home-'));
  const repo = await createGitRepo();
  const server = await startServer(async (req) => {
    if (req.url === '/api/v1/repos/scan') return { body: { ok: true } };
    return { status: 404, body: { error: 'not found' } };
  });
  await writeFile(path.join(home, '.monkeys-memory-config-bootstrap'), '');
  await execFileAsync(process.execPath, [cliPath, 'config', 'set', 'api-url', server.url], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });

  try {
    await run(['repo', 'scan'], {
      cwd: repo,
      home,
      env: { MONKEYS_MEMORY_TOKEN: 'mk_cli_test' },
    });
    assert.equal(server.requests[0].body.repo, 'product-api');
    assert.match(server.requests[0].authorization, /^Bearer mk_cli_test$/);
  } finally {
    await server.close();
  }
});

test('memory-evaluate posts agent memory evaluation feedback', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'mm-cli-home-'));
  const server = await startServer(async (req) => {
    if (req.url === '/api/v1/agent/memory-evaluations') {
      return { body: { status: 'recorded', recorded_count: 1 } };
    }
    return { status: 404, body: { error: 'not found' } };
  });
  await writeFile(path.join(home, '.monkeys-memory-config-bootstrap'), '');
  await execFileAsync(process.execPath, [cliPath, 'config', 'set', 'api-url', server.url], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });

  try {
    const { stdout } = await run([
      'memory-evaluate',
      '--repo', 'product-api',
      '--rule-id', 'rule_1',
      '--outcome', 'helpful',
      '--adopted', 'true',
      '--confidence', '0.86',
      '--note', 'Applied during auth fix.',
      '--evidence', 'npm test passed',
    ], {
      home,
      env: { MONKEYS_MEMORY_TOKEN: 'mk_cli_test' },
    });
    assert.equal(JSON.parse(stdout).recorded_count, 1);
    assert.equal(server.requests[0].method, 'POST');
    assert.equal(server.requests[0].body.repo, 'product-api');
    assert.deepEqual(server.requests[0].body.evaluations, [{
      rule_id: 'rule_1',
      outcome: 'helpful',
      adopted: true,
      confidence: 0.86,
      note: 'Applied during auth fix.',
      evidence: ['npm test passed'],
    }]);
    assert.match(server.requests[0].authorization, /^Bearer mk_cli_test$/);
  } finally {
    await server.close();
  }
});

test('api command normalizes short paths and sends org header', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'mm-cli-home-'));
  const server = await startServer(async (req) => {
    if (req.url === '/api/v1/auth/me') {
      return { body: { ok: true } };
    }
    return { status: 404, body: { error: 'not found' } };
  });
  await writeFile(path.join(home, '.monkeys-memory-config-bootstrap'), '');
  await execFileAsync(process.execPath, [cliPath, 'config', 'set', 'api-url', server.url], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });

  try {
    const { stdout } = await run(['api', 'GET', '/auth/me', '--org-id', 'org_1'], {
      home,
      env: { MONKEYS_MEMORY_TOKEN: 'mk_cli_test' },
    });
    assert.equal(JSON.parse(stdout).ok, true);
    assert.equal(server.requests[0].url, '/api/v1/auth/me');
    assert.equal(server.requests[0].orgId, 'org_1');
  } finally {
    await server.close();
  }
});

test('agent-action-result reports repo context and org header', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'mm-cli-home-'));
  const repo = await createGitRepo();
  const server = await startServer(async (req) => {
    if (req.url === '/api/v1/agent-actions/act_1/result') {
      return { body: { id: 'act_1', status: 'completed' } };
    }
    return { status: 404, body: { error: 'not found' } };
  });
  await writeFile(path.join(home, '.monkeys-memory-config-bootstrap'), '');
  await execFileAsync(process.execPath, [cliPath, 'config', 'set', 'api-url', server.url], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });

  try {
    const { stdout } = await run([
      'agent-action-result',
      '--action-id', 'act_1',
      '--type', 'repo_scan',
      '--org-id', 'org_1',
    ], {
      cwd: repo,
      home,
      env: { MONKEYS_MEMORY_TOKEN: 'mk_cli_test' },
    });
    const output = JSON.parse(stdout);
    assert.equal(output.report.status, 'completed');
    assert.equal(output.repo, 'product-api');
    assert.equal(server.requests[0].url, '/api/v1/agent-actions/act_1/result');
    assert.equal(server.requests[0].orgId, 'org_1');
    assert.equal(server.requests[0].body.repo, 'product-api');
    assert.equal(server.requests[0].body.status, 'completed');
    assert.equal(server.requests[0].body.result.schema_version, 1);
  } finally {
    await server.close();
  }
});

test('retrieve automatically reports leased repo scan actions', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'mm-cli-home-'));
  const repo = await createGitRepo();
  const server = await startServer(async (req) => {
    if (req.url === '/api/v1/retrieve') {
      return {
        body: {
          enabled: true,
          repo: 'product-api',
          rules: [],
          exceptions: [],
          org_rules: [],
          agent_actions: [{
            id: 'act_1',
            type: 'repo_scan',
            repo: 'product-api',
            status: 'leased',
            payload: {},
          }],
        },
      };
    }
    if (req.url === '/api/v1/agent-actions/act_1/result') {
      return { body: { id: 'act_1', status: 'completed' } };
    }
    return { status: 404, body: { error: 'not found' } };
  });
  await writeFile(path.join(home, '.monkeys-memory-config-bootstrap'), '');
  await execFileAsync(process.execPath, [cliPath, 'config', 'set', 'api-url', server.url], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });

  try {
    const { stdout } = await run(['retrieve', '--repo', 'product-api', '--path', 'index.js', '--task', 'bugfix'], {
      cwd: repo,
      home,
      env: { MONKEYS_MEMORY_TOKEN: 'mk_cli_test' },
    });
    const output = JSON.parse(stdout);
    assert.equal(output.agent_action_results[0].id, 'act_1');
    assert.equal(output.agent_action_results[0].status, 'completed');
    assert.equal(server.requests[0].url, '/api/v1/retrieve');
    assert.equal(server.requests[1].url, '/api/v1/agent-actions/act_1/result');
    assert.equal(server.requests[1].body.repo, 'product-api');
    assert.equal(server.requests[1].body.status, 'completed');
    assert.equal(server.requests[1].body.result.schema_version, 1);
  } finally {
    await server.close();
  }
});

test('retrieve marks malformed agent actions as skipped', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'mm-cli-home-'));
  const server = await startServer(async (req) => {
    if (req.url === '/api/v1/retrieve') {
      return {
        body: {
          enabled: true,
          repo: 'product-api',
          rules: [],
          exceptions: [],
          org_rules: [],
          agent_actions: [{ repo: 'product-api', status: 'leased', payload: {} }],
        },
      };
    }
    return { status: 404, body: { error: 'not found' } };
  });
  await writeFile(path.join(home, '.monkeys-memory-config-bootstrap'), '');
  await execFileAsync(process.execPath, [cliPath, 'config', 'set', 'api-url', server.url], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });

  try {
    const { stdout } = await run(['retrieve', '--repo', 'product-api'], {
      home,
      env: { MONKEYS_MEMORY_TOKEN: 'mk_cli_test' },
    });
    const output = JSON.parse(stdout);
    assert.equal(output.agent_action_results[0].status, 'skipped');
    assert.equal(output.agent_action_results[0].reason, 'malformed-agent-action');
    assert.equal(server.requests.length, 1);
  } finally {
    await server.close();
  }
});

test('install-skills creates Codex and Claude skill directories on a fresh machine', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'mm-cli-home-'));
  const useContent = await readFile(path.resolve('skills/monkeys-memory-use/SKILL.md'), 'utf8');
  const captureContent = await readFile(path.resolve('skills/monkeys-memory-capture/SKILL.md'), 'utf8');

  await run(['install-skills'], {
    home,
    env: { MONKEYS_MEMORY_TOKEN: 'mk_cli_test' },
  });
  const codexUse = await readFile(path.join(home, '.codex', 'skills', 'monkeys-memory-use', 'SKILL.md'), 'utf8');
  const claudeCapture = await readFile(path.join(home, '.claude', 'skills', 'monkeys-memory-capture', 'SKILL.md'), 'utf8');
  assert.equal(codexUse, useContent);
  assert.equal(claudeCapture, captureContent);
});
