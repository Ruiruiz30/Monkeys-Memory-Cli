import { promises as fs } from 'node:fs';
import path from 'node:path';
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next', 'coverage', '.git']);
function normalizePath(value) {
    return String(value ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}
async function readJson(filePath) {
    try {
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
    }
    catch {
        return null;
    }
}
function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort();
}
function fileExtension(filePath) {
    return path.extname(filePath).toLowerCase();
}
function detectLanguages(paths) {
    const languages = new Set();
    for (const filePath of paths) {
        const ext = fileExtension(filePath);
        if (ext === '.ts' || ext === '.tsx')
            languages.add('TypeScript');
        else if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs')
            languages.add('JavaScript');
        else if (ext === '.json')
            languages.add('JSON');
        else if (ext === '.md' || ext === '.mdx')
            languages.add('Markdown');
        else if (ext === '.css')
            languages.add('CSS');
        else if (ext === '.html')
            languages.add('HTML');
        else if (ext === '.py')
            languages.add('Python');
        else if (ext === '.tex')
            languages.add('LaTeX');
    }
    return uniqueSorted([...languages]);
}
function detectFrameworks(pkg, paths) {
    const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
    const frameworks = new Set();
    if (deps.fastify)
        frameworks.add('Fastify');
    if (deps.express)
        frameworks.add('Express');
    if (deps.react)
        frameworks.add('React');
    if (deps.vite || paths.includes('vite.config.ts') || paths.includes('vite.config.js'))
        frameworks.add('Vite');
    if (deps.next || paths.includes('next.config.js') || paths.includes('next.config.mjs'))
        frameworks.add('Next.js');
    if (deps.typeorm)
        frameworks.add('TypeORM');
    if (deps.vitest)
        frameworks.add('Vitest');
    if (deps.typescript || paths.includes('tsconfig.json'))
        frameworks.add('TypeScript');
    if (paths.some(item => item.startsWith('skills/')))
        frameworks.add('Codex/Claude Skills');
    return uniqueSorted([...frameworks]);
}
function inferKind(repoName, pkg, paths, frameworks) {
    const name = `${repoName} ${pkg?.name ?? ''}`.toLowerCase();
    if (pkg?.bin || name.includes('cli') || paths.some(item => item.startsWith('src/commands/')))
        return 'cli-tool';
    if (frameworks.includes('Fastify')
        || frameworks.includes('Express')
        || paths.some(item => item.startsWith('src/routes/') || item.startsWith('src/controllers/') || item.startsWith('src/services/'))
        || paths.some(item => item.startsWith('src/modules/') && /\.(controller|service)\.ts$/.test(item)))
        return 'backend-service';
    if (frameworks.includes('React')
        || frameworks.includes('Next.js')
        || frameworks.includes('Vite')
        || paths.some(item => item.startsWith('src/pages/') || item.startsWith('src/components/') || item.startsWith('app/') || item.startsWith('pages/')))
        return 'web-frontend';
    if (paths.some(item => item.endsWith('.tex')) && !paths.some(item => item.startsWith('src/')))
        return 'documentation';
    if (pkg?.name)
        return 'library';
    return 'repository';
}
function takePaths(paths, predicate, limit = 12) {
    return paths.filter(predicate).slice(0, limit);
}
function buildPathGroups(paths) {
    const groups = [];
    const add = (name, purpose, items) => {
        if (items.length > 0)
            groups.push({ name, purpose, paths: uniqueSorted(items) });
    };
    add('source', 'Primary implementation code.', takePaths(paths, item => item.startsWith('src/')));
    add('commands', 'CLI command entry points.', takePaths(paths, item => item.startsWith('src/commands/')));
    add('api-modules', 'Backend API modules and services.', takePaths(paths, item => item.startsWith('src/modules/')));
    add('tests', 'Automated tests.', takePaths(paths, item => item.startsWith('test/') || item.startsWith('tests/') || item.includes('.test.')));
    add('skills', 'Bundled agent Skills.', takePaths(paths, item => item.startsWith('skills/')));
    add('database', 'Database schema and migrations.', takePaths(paths, item => item.includes('/migrations/') || item.includes('ormconfig')));
    add('docs', 'Project documentation.', takePaths(paths, item => item.endsWith('.md')));
    add('config', 'Build, package, and tool configuration.', takePaths(paths, item => ['package.json', 'tsconfig.json', 'vite.config.ts', 'Dockerfile', 'bun.lock'].includes(item)));
    return groups.slice(0, 12);
}
function commandPurpose(name) {
    if (name.includes('test'))
        return 'Run automated tests.';
    if (name.includes('build'))
        return 'Build distributable output.';
    if (name.includes('check') || name.includes('lint'))
        return 'Run static validation.';
    if (name.includes('dev'))
        return 'Start local development mode.';
    if (name.includes('start'))
        return 'Start the application.';
    if (name.includes('worker'))
        return 'Run a background worker.';
    return 'Project script.';
}
function packageManagerRunner(pkg) {
    const manager = pkg?.packageManager?.split('@')[0];
    if (manager === 'yarn')
        return 'yarn';
    if (manager === 'bun')
        return 'bun run';
    if (manager === 'pnpm')
        return 'pnpm run';
    return 'npm run';
}
function importantCommands(pkg) {
    const scripts = pkg?.scripts ?? {};
    const runner = packageManagerRunner(pkg);
    const preferred = ['check', 'lint', 'test', 'test:run', 'build', 'dev', 'start', 'worker:consistency'];
    const names = uniqueSorted([...preferred.filter(name => scripts[name]), ...Object.keys(scripts).filter(name => /^(test|build|check|lint|dev|start|worker)/.test(name))]).slice(0, 12);
    return names.map(name => ({ name, command: `${runner} ${name}`, purpose: commandPurpose(name) }));
}
function buildOwnership(kind, pathGroups) {
    const owns = pathGroups.map(group => `${group.name}: ${group.paths.slice(0, 4).join(', ')}`);
    const doesNotOwn = [];
    const boundaryNotes = [];
    if (kind === 'backend-service') {
        doesNotOwn.push('Browser UI routes/components such as src/pages/**, src/components/**, app/**, or pages/**.');
        doesNotOwn.push('Standalone CLI command implementations unless this repository also declares CLI bins.');
        boundaryNotes.push('Keep server routes, service logic, persistence, workers, and API contracts in this repository.');
    }
    else if (kind === 'web-frontend') {
        doesNotOwn.push('Server route handlers, database migrations, and background workers.');
        doesNotOwn.push('Standalone CLI command implementations unless this repository also declares CLI bins.');
        boundaryNotes.push('Keep browser-facing pages, components, client API wrappers, assets, and frontend state here.');
    }
    else if (kind === 'cli-tool') {
        doesNotOwn.push('Hosted server route handlers, database migrations, and browser UI pages.');
        boundaryNotes.push('Keep command UX, local filesystem behavior, auth/config storage, packaging, and agent-facing flows here.');
    }
    else if (kind === 'library') {
        doesNotOwn.push('Application-specific deployment, browser pages, server routes, and database migrations unless explicitly present.');
        boundaryNotes.push('Keep reusable package APIs, implementation modules, tests, and public contracts here.');
    }
    else if (kind === 'documentation') {
        doesNotOwn.push('Runtime product code, deployment files, and application assets unless the docs explicitly own them.');
        boundaryNotes.push('Keep docs, examples, figures, and reference material here.');
    }
    return {
        owns: owns.slice(0, 12),
        does_not_own: doesNotOwn,
        boundary_notes: boundaryNotes,
    };
}
function entityId(kind, name) {
    return `${kind}:${name}`;
}
function scanLineForEntities(line) {
    const trimmed = line.trim();
    const matchers = [
        ['class', /^(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/],
        ['interface', /^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/],
        ['type', /^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/],
        ['enum', /^(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)/],
        ['function', /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/],
        ['function', /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/],
        ['function', /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?[A-Za-z_$][\w$]*\s*=>/],
    ];
    const entities = [];
    for (const [kind, regex] of matchers) {
        const match = trimmed.match(regex);
        if (match?.[1])
            entities.push({ kind, name: match[1], signature: trimmed.slice(0, 160) });
    }
    const route = trimmed.match(/\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/i);
    if (route?.[1] && route[2]) {
        entities.push({ kind: 'route', name: `${route[1].toUpperCase()} ${route[2]}`, signature: trimmed.slice(0, 160) });
    }
    return entities;
}
export async function extractCodeEntities(workspaceRoot, knownPaths, limit = 5000) {
    const entities = [];
    for (const relativePath of knownPaths) {
        if (entities.length >= limit)
            break;
        if (!SOURCE_EXTENSIONS.has(fileExtension(relativePath)))
            continue;
        if (relativePath.split('/').some(part => SKIP_DIRS.has(part)))
            continue;
        const fullPath = path.join(workspaceRoot, relativePath);
        const content = await fs.readFile(fullPath, 'utf8').catch(() => '');
        if (!content)
            continue;
        const lines = content.split(/\r?\n/);
        for (let index = 0; index < lines.length && entities.length < limit; index += 1) {
            for (const entity of scanLineForEntities(lines[index])) {
                entities.push({
                    id: entityId(entity.kind, entity.name),
                    kind: entity.kind,
                    name: entity.name,
                    path: normalizePath(relativePath),
                    line: index + 1,
                    signature: entity.signature,
                });
            }
        }
    }
    return entities.sort((left, right) => `${left.path}:${left.line}:${left.id}`.localeCompare(`${right.path}:${right.line}:${right.id}`));
}
export async function buildRepoProfile(workspaceRoot, repoName, knownPaths) {
    const pkg = await readJson(path.join(workspaceRoot, 'package.json'));
    const languages = detectLanguages(knownPaths);
    const frameworks = detectFrameworks(pkg, knownPaths);
    const kind = inferKind(repoName, pkg, knownPaths, frameworks);
    const pathGroups = buildPathGroups(knownPaths);
    const profile = {
        schema_version: 1,
        name: repoName,
        kind,
        description: pkg?.description ?? null,
        package_manager: pkg?.packageManager ?? (knownPaths.includes('bun.lock') ? 'bun' : knownPaths.includes('package-lock.json') ? 'npm' : null),
        languages,
        frameworks,
        path_groups: pathGroups,
        ownership: buildOwnership(kind, pathGroups),
        important_commands: importantCommands(pkg),
        contributor_guides: knownPaths.filter(item => /(^|\/)AGENTS\.md$/.test(item)).slice(0, 8),
    };
    return { profile, brief: renderRepoBrief(profile) };
}
function renderRepoBrief(profile) {
    const lines = [
        `# ${profile.name} Repository Brief`,
        '',
        `${profile.name} is a ${profile.kind} repository${profile.description ? `: ${profile.description}` : '.'}`,
        '',
        '## What It Owns',
        ...(profile.ownership.owns.length > 0 ? profile.ownership.owns.map(item => `- ${item}`) : ['- Repository-owned implementation and tests.']),
    ];
    if (profile.ownership.does_not_own.length > 0) {
        lines.push('', '## Boundaries', ...profile.ownership.does_not_own.map(item => `- ${item}`));
    }
    if (profile.important_commands.length > 0) {
        lines.push('', '## Important Commands', ...profile.important_commands.slice(0, 6).map(item => `- ${item.command}: ${item.purpose}`));
    }
    if (profile.ownership.boundary_notes.length > 0) {
        lines.push('', '## Agent Notes', ...profile.ownership.boundary_notes.map(item => `- ${item}`));
    }
    return lines.join('\n');
}
//# sourceMappingURL=repo-profile.js.map