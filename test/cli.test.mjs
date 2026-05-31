import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
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
    env: { ...process.env, HOME: home, USERPROFILE: home, ...options.env },
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
      requests.push({ method: req.method, url: req.url, body, authorization: req.headers.authorization });
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

test('install-skills creates Codex and Claude skill directories on a fresh machine', async () => {
  const home = await mkdtemp(path.join(os.tmpdir(), 'mm-cli-home-'));
  const useContent = '# use\n';
  const captureContent = '# capture\n';
  const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
  const manifest = {
    manifest_hash: '0'.repeat(64),
    skills: [
      { name: 'monkeys-memory-use', path: 'monkeys-memory-use/SKILL.md', url: '', sha256: digest(useContent) },
      { name: 'monkeys-memory-capture', path: 'monkeys-memory-capture/SKILL.md', url: '', sha256: digest(captureContent) },
    ],
  };
  const server = await startServer(async (req) => {
    if (req.url === '/api/v1/skills/manifest') return { body: manifest };
    if (req.url === '/public/skills/monkeys-memory-use/SKILL.md') return { text: useContent };
    if (req.url === '/public/skills/monkeys-memory-capture/SKILL.md') return { text: captureContent };
    return { status: 404, body: { error: 'not found' } };
  });
  manifest.skills[0].url = `${server.url}/public/skills/monkeys-memory-use/SKILL.md`;
  manifest.skills[1].url = `${server.url}/public/skills/monkeys-memory-capture/SKILL.md`;

  try {
    await run(['install-skills', '--manifest-hash', manifest.manifest_hash], {
      home,
      env: { MONKEYS_MEMORY_API_URL: server.url, MONKEYS_MEMORY_TOKEN: 'mk_cli_test' },
    });
    const codexUse = await (await import('node:fs/promises')).readFile(path.join(home, '.codex', 'skills', 'monkeys-memory-use', 'SKILL.md'), 'utf8');
    const claudeCapture = await (await import('node:fs/promises')).readFile(path.join(home, '.claude', 'skills', 'monkeys-memory-capture', 'SKILL.md'), 'utf8');
    assert.equal(codexUse, useContent);
    assert.equal(claudeCapture, captureContent);
  } finally {
    await server.close();
  }
});
