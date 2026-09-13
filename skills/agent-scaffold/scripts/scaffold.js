#!/usr/bin/env node
/*
 * agent-scaffold scaffold.js
 * Deterministic helpers for the agent-scaffold skill. No dependencies.
 *
 *   node scaffold.js detect  <repo> [--tools both|claude|copilot] [--force]
 *   node scaffold.js hooks   <repo> [--tools ...] [--force] [--dry-run]
 *   node scaffold.js agents  <repo> [--tools ...] [--force] [--dry-run]
 *   node scaffold.js mirror  <repo> [--force] [--dry-run]
 *   node scaffold.js fill    <template> <repo> [--vars KEY=value ...]
 *   node scaffold.js write   <repo> <relative-target> --from <file> [--force] [--dry-run]
 *   node scaffold.js report  <repo>
 *
 * No-clobber rule: an existing target is never overwritten unless --force; the new
 * content is written beside it as <name>.generated.<ext>. settings.json is the one
 * exception: it is merged additively (arrays unioned, nothing removed).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SKILL_DIR = path.resolve(__dirname, '..');
const ASSETS = path.join(SKILL_DIR, 'assets');
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.angular', '.cache', 'uploads', 'logs', 'backups', '.next', 'out', 'tmp', 'vendor', '__pycache__', '.venv', 'venv']);

const FE_DEPS = ['@angular/core', 'react', 'vue', 'svelte', 'next', 'nuxt', '@sveltejs/kit', 'solid-js', 'preact'];
const BE_DEPS = ['express', '@nestjs/core', 'fastify', 'koa', '@hapi/hapi', 'hono', 'mongoose', 'prisma', '@prisma/client', 'sequelize', 'typeorm', 'knex', 'pg', 'mysql2'];

function parseArgs(argv) {
  const out = { _: [], tools: 'both', force: false, dryRun: false, vars: {}, from: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') out.force = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--tools') out.tools = argv[++i] || 'both';
    else if (a === '--from') out.from = argv[++i] || '';
    else if (a === '--vars') {
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        const parts = argv[++i].split('=');
        out.vars[parts[0]] = parts.slice(1).join('=');
      }
    } else out._.push(a);
  }
  if (!['both', 'claude', 'copilot'].includes(out.tools)) out.tools = 'both';
  return out;
}

function sh(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' }).trim();
  } catch (e) {
    return '';
  }
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return null;
  }
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch (e) {
    return false;
  }
}

function rel(root, p) {
  return path.relative(root, p).replace(/\\/g, '/');
}

function generatedName(p) {
  const ext = path.extname(p);
  const base = ext ? p.slice(0, -ext.length) : p;
  return base + '.generated' + (ext || '.txt');
}

function walk(root, opts) {
  const maxDepth = opts.maxDepth || 6;
  const limit = opts.limit || 5000;
  const out = [];
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length && out.length < limit) {
    const item = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(item.dir, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const e of entries) {
      const full = path.join(item.dir, e.name);
      if (e.isDirectory()) {
        if (IGNORE_DIRS.has(e.name) || (e.name.startsWith('.') && !opts.includeDot)) continue;
        if (item.depth < maxDepth) stack.push({ dir: full, depth: item.depth + 1 });
      } else if (e.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

// Resolve the repo root; prefer the git answer so the scaffold lands at the top level.
function resolveRoot(arg) {
  const start = path.resolve(arg || '.');
  const top = sh('git rev-parse --show-toplevel', start);
  return top ? path.resolve(top) : start;
}

function detectKind(deps) {
  const names = Object.keys(deps);
  const fe = FE_DEPS.filter((d) => names.includes(d));
  const be = BE_DEPS.filter((d) => names.includes(d));
  const kind = fe.length && be.length ? 'fullstack' : fe.length ? 'frontend' : be.length ? 'backend' : 'unknown';
  return { kind, feFrameworks: fe, beFrameworks: be };
}

function packageInfo(dir) {
  const pkg = readJson(path.join(dir, 'package.json'));
  if (!pkg) return null;
  const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  return Object.assign({ dir, name: pkg.name || path.basename(dir), scripts: pkg.scripts || {}, deps }, detectKind(deps));
}

function findPackages(root) {
  const pkgs = [];
  const rootPkg = packageInfo(root);
  if (rootPkg) pkgs.push(rootPkg);
  for (const ws of ['packages', 'apps', 'services', 'libs']) {
    const wsDir = path.join(root, ws);
    if (!exists(wsDir)) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(wsDir, { withFileTypes: true });
    } catch (e) {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const info = packageInfo(path.join(wsDir, e.name));
      if (info) pkgs.push(info);
    }
  }
  return pkgs;
}

function otherManifests(root) {
  const names = ['requirements.txt', 'pyproject.toml', 'go.mod', 'pom.xml', 'build.gradle', 'Cargo.toml', 'composer.json', 'Gemfile'];
  const csproj = walk(root, { maxDepth: 2, limit: 500 }).filter((f) => /\.csproj$/.test(f));
  return names.filter((n) => exists(path.join(root, n))).concat(csproj.map((f) => rel(root, f)));
}

function packageManager(root) {
  if (exists(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (exists(path.join(root, 'yarn.lock'))) return 'yarn';
  if (exists(path.join(root, 'bun.lockb')) || exists(path.join(root, 'bun.lock'))) return 'bun';
  if (exists(path.join(root, 'package-lock.json')) || exists(path.join(root, 'package.json'))) return 'npm';
  return '';
}

function gitFacts(root) {
  const remotesRaw = sh('git remote -v', root);
  const remotes = new Set();
  for (const line of remotesRaw.split('\n')) {
    const m = line.match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(\.git)?(\s|$)/i);
    if (m) remotes.add(m[1]);
  }
  let defaultBranch = sh('git symbolic-ref --short refs/remotes/origin/HEAD', root).replace(/^origin\//, '');
  if (!defaultBranch) {
    const branches = sh('git branch --list main master', root);
    defaultBranch = /\bmain\b/.test(branches) ? 'main' : /\bmaster\b/.test(branches) ? 'master' : 'main';
  }
  return {
    isRepo: !!sh('git rev-parse --is-inside-work-tree', root),
    remotes: Array.from(remotes),
    currentBranch: sh('git branch --show-current', root),
    defaultBranch,
  };
}

function registryHost(root) {
  const candidates = [path.join(root, '.npmrc'), path.join(process.env.USERPROFILE || process.env.HOME || '', '.npmrc')];
  for (const p of candidates) {
    try {
      const m = fs.readFileSync(p, 'utf8').match(/^\s*registry\s*=\s*(\S+)/m);
      if (m) return new URL(m[1]).host;
    } catch (e) {
      // Not present or unreadable; fall through.
    }
  }
  return 'registry.npmjs.org';
}

function docCandidates(root) {
  const all = walk(root, { maxDepth: 3, limit: 4000 });
  const md = all.filter((f) => /\.(md|mdc|txt)$/i.test(f));
  const interesting = md.filter((f) => /readme|requirement|brd|prd|architecture|design|spec|domain|workflow|rule|guide|onboard|coding|style/i.test(path.basename(f)) || /[\\/]docs[\\/]/i.test(f));
  const fixed = ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md', 'CLAUDE-AGENTS-template.md'].map((p) => path.join(root, p)).filter(exists);
  const ruleDirs = ['.claude/rules', '.cursor/rules', '.github/instructions'].map((d) => path.join(root, d)).filter(exists);
  const ruleFiles = [];
  for (const d of ruleDirs) ruleFiles.push.apply(ruleFiles, walk(d, { maxDepth: 3, limit: 100, includeDot: true }));
  return Array.from(new Set(fixed.concat(ruleFiles, interesting.slice(0, 40)))).map((f) => rel(root, f));
}

// Sample a few representative files per architectural layer so the skill can lift
// real snippets instead of inventing them.
function sampleLayers(root) {
  const files = walk(root, { maxDepth: 7, limit: 8000 }).filter((f) => /\.(js|ts|tsx|jsx|vue|svelte|html|scss|css|py|go|cs|java)$/i.test(f));
  const relFiles = files.map((f) => rel(root, f)).sort((a, b) => a.length - b.length);
  const pickBy = (re, n) => relFiles.filter((f) => re.test(f)).slice(0, n || 3);
  return {
    backend: {
      entry: pickBy(/^(server|app|index|main)\.(js|ts)$|^src\/(server|app|index|main)\.(js|ts)$/i, 2),
      models: pickBy(/[\\/](models?|entities|schemas?)[\\/][^\\/]+\.(js|ts)$/i),
      services: pickBy(/[\\/]services?[\\/][^\\/]+\.(js|ts)$/i),
      controllers: pickBy(/[\\/]controllers?[\\/].*\.(js|ts)$/i),
      routes: pickBy(/[\\/](routes?|routers?)[\\/].*\.(js|ts)$/i),
      middlewares: pickBy(/[\\/]middlewares?[\\/][^\\/]+\.(js|ts)$/i, 2),
      dto: pickBy(/[\\/]dtos?[\\/][^\\/]+\.(js|ts)$/i, 2),
      config: pickBy(/[\\/]config[\\/][^\\/]+\.(js|ts)$/i, 2),
      tests: pickBy(/\.(test|spec)\.(js|ts)$/i, 2),
      graphql: pickBy(/schema\.(js|ts|graphql)$|[\\/]types?[\\/].*\.(js|ts)$/i, 2),
    },
    frontend: {
      components: pickBy(/\.component\.(ts|html|scss)$|[\\/]components?[\\/][^\\/]+\.(tsx|jsx|vue|svelte)$/i, 4),
      pages: pickBy(/[\\/](pages?|views?|screens?)[\\/].*\.(ts|tsx|jsx|vue|svelte|html)$/i, 3),
      services: pickBy(/\.service\.ts$|[\\/](api|services?|hooks?)[\\/][^\\/]+\.(ts|tsx|js)$/i),
      routes: pickBy(/app\.routes\.ts$|routing\.module\.ts$|[\\/]routes?\.(ts|tsx|js)$|[\\/]router[\\/]/i, 2),
      forms: pickBy(/form[^\\/]*\.component\.ts$|[\\/]forms?[\\/]/i, 2),
      styles: pickBy(/^src\/styles\.(scss|css)$|theme[^\\/]*\.(scss|css)$|tailwind\.config\.(js|ts)$|variables\.(scss|css)$/i, 3),
      i18n: pickBy(/[\\/](i18n|locales?|assets\/i18n)[\\/][^\\/]+\.json$/i, 2),
      env: pickBy(/environments?[\\/]environment[^\\/]*\.ts$/i, 2),
      tests: pickBy(/\.spec\.ts$|\.test\.(ts|tsx)$/i, 2),
    },
  };
}

function envVarNames(root) {
  const names = new Set();
  for (const f of ['.env.example', '.env.sample', '.env.template']) {
    try {
      for (const line of fs.readFileSync(path.join(root, f), 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Z][A-Z0-9_]+)\s*=/);
        if (m) names.add(m[1]);
      }
    } catch (e) {
      // Optional file.
    }
  }
  const files = walk(root, { maxDepth: 6, limit: 6000 }).filter((f) => /\.(js|ts|mjs|cjs)$/i.test(f)).slice(0, 300);
  for (const f of files) {
    try {
      const src = fs.readFileSync(f, 'utf8');
      const re = /process\.env\.([A-Z][A-Z0-9_]+)|import\.meta\.env\.([A-Z][A-Z0-9_]+)/g;
      let m;
      while ((m = re.exec(src))) names.add(m[1] || m[2]);
    } catch (e) {
      // Skip unreadable files.
    }
  }
  return Array.from(names).sort();
}

function targetSpecs(root, tools, kind, force) {
  const wantClaude = tools === 'both' || tools === 'claude';
  const wantCopilot = tools === 'both' || tools === 'copilot';
  const specs = [];
  const add = (p, owner, when) => {
    if (when === false) return;
    const abs = path.join(root, p);
    const ex = exists(abs);
    specs.push({ path: p, owner, exists: ex, writeTo: ex && !force ? rel(root, generatedName(abs)) : p });
  };
  add('AGENTS.md', 'shared');
  add('CLAUDE.md', 'claude', wantClaude);
  add('.github/copilot-instructions.md', 'copilot', wantCopilot);
  add('.claude/rules/tech-stack.md', 'shared');
  add('.claude/rules/design-notes.md', 'shared');
  add('.claude/rules/requirements.md', 'shared');
  add('.github/instructions/tech-stack.instructions.md', 'copilot', wantCopilot);
  add('.github/instructions/design-notes.instructions.md', 'copilot', wantCopilot);
  add('.github/instructions/requirements.instructions.md', 'copilot', wantCopilot);
  add('.claude/hooks/guard.js', 'shared');
  add('.claude/hooks/prompt-guard.js', 'shared');
  add('.claude/hooks/activity-logger.js', 'shared');
  add('.claude/settings.json', 'claude', wantClaude);
  add('.github/hooks/agent-guard.json', 'copilot', wantCopilot);
  add('.claude/skills/frontend-skills/SKILL.md', 'shared', kind === 'frontend' || kind === 'fullstack');
  add('.claude/skills/backend-skills/SKILL.md', 'shared', kind === 'backend' || kind === 'fullstack');
  add('.claude/agents/git-reconciler.md', 'claude', wantClaude);
  add('.github/agents/git-reconciler.agent.md', 'copilot', wantCopilot);
  return specs;
}

function detect(root, args) {
  const pkgs = findPackages(root);
  const primary = pkgs[0] || null;
  const kinds = pkgs.map((p) => p.kind);
  const kind = kinds.includes('fullstack') || (kinds.includes('frontend') && kinds.includes('backend')) ? 'fullstack' : kinds.includes('frontend') ? 'frontend' : kinds.includes('backend') ? 'backend' : 'unknown';
  const git = gitFacts(root);
  const today = new Date().toISOString().slice(0, 10);
  const pm = packageManager(root);
  const testCmd = primary && primary.scripts.test ? (pm || 'npm') + ' test' : '';
  return {
    root: root.replace(/\\/g, '/'),
    projectName: primary ? primary.name : path.basename(root),
    kind,
    packageManager: pm,
    packages: pkgs.map((p) => ({ dir: rel(root, p.dir) || '.', name: p.name, kind: p.kind, feFrameworks: p.feFrameworks, beFrameworks: p.beFrameworks, scripts: p.scripts, deps: p.deps })),
    otherManifests: otherManifests(root),
    git,
    repoAllowlist: git.remotes.length ? git.remotes.join(', ') : '<REPO_ALLOWLIST>',
    registryHost: registryHost(root),
    testCommand: testCmd,
    date: today,
    envVarNames: envVarNames(root),
    docs: docCandidates(root),
    layers: sampleLayers(root),
    targets: targetSpecs(root, args.tools, kind, args.force),
  };
}

function writeTarget(root, relPath, content, args, results) {
  const abs = path.join(root, relPath);
  const ex = exists(abs);
  let action = 'written';
  let dest = abs;
  if (ex) {
    const current = fs.readFileSync(abs, 'utf8');
    if (current === content) action = 'unchanged';
    else if (!args.force) {
      dest = generatedName(abs);
      action = 'generated';
    } else action = 'overwritten';
  }
  if (!args.dryRun && action !== 'unchanged') {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
  }
  results.push({ target: relPath, action: args.dryRun && action !== 'unchanged' ? 'dry-run:' + action : action, wroteTo: rel(root, dest) });
}

function unionArray(a, b) {
  const seen = new Set((a || []).map((x) => JSON.stringify(x)));
  const out = (a || []).slice();
  for (const x of b || []) {
    const k = JSON.stringify(x);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

function mergeSettings(root, args, results) {
  const fragment = readJson(path.join(ASSETS, 'hooks', 'claude.settings.fragment.json'));
  const relPath = '.claude/settings.json';
  const abs = path.join(root, relPath);
  let current = {};
  const had = exists(abs);
  if (had) {
    current = readJson(abs);
    if (!current) {
      writeTarget(root, relPath, JSON.stringify(fragment, null, 2) + '\n', Object.assign({}, args, { force: false }), results);
      results[results.length - 1].note = 'existing settings.json is not valid JSON; fragment written beside it';
      return;
    }
  }
  const merged = JSON.parse(JSON.stringify(current));
  merged.permissions = merged.permissions || {};
  for (const key of ['deny', 'ask']) merged.permissions[key] = unionArray(merged.permissions[key], fragment.permissions[key]);
  merged.hooks = merged.hooks || {};
  for (const event of Object.keys(fragment.hooks)) merged.hooks[event] = unionArray(merged.hooks[event], fragment.hooks[event]);
  const content = JSON.stringify(merged, null, 2) + '\n';
  const before = had ? fs.readFileSync(abs, 'utf8') : '';
  if (before === content) {
    results.push({ target: relPath, action: 'unchanged', wroteTo: relPath });
    return;
  }
  if (!args.dryRun) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  results.push({ target: relPath, action: (args.dryRun ? 'dry-run:' : '') + (had ? 'merged' : 'written'), wroteTo: relPath });
}

function hooks(root, args) {
  const results = [];
  const wantClaude = args.tools === 'both' || args.tools === 'claude';
  const wantCopilot = args.tools === 'both' || args.tools === 'copilot';
  for (const f of ['guard.js', 'prompt-guard.js', 'activity-logger.js']) {
    writeTarget(root, '.claude/hooks/' + f, fs.readFileSync(path.join(ASSETS, 'hooks', f), 'utf8'), args, results);
  }
  if (wantClaude) mergeSettings(root, args, results);
  if (wantCopilot) writeTarget(root, '.github/hooks/agent-guard.json', fs.readFileSync(path.join(ASSETS, 'hooks', 'copilot.hooks.json'), 'utf8'), args, results);
  const logDir = path.join(root, 'docs', 'activity-log');
  if (!exists(logDir)) {
    if (!args.dryRun) fs.mkdirSync(logDir, { recursive: true });
    results.push({ target: 'docs/activity-log/', action: (args.dryRun ? 'dry-run:' : '') + 'created', wroteTo: 'docs/activity-log/' });
  }
  return results;
}

function fillVars(text, vars) {
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}

function mechanicalVars(d, overrides) {
  const skillsList = [];
  if (d.kind === 'frontend' || d.kind === 'fullstack') skillsList.push('- `.claude/skills/frontend-skills/SKILL.md` - how to add components, pages, services, forms in this repo.');
  if (d.kind === 'backend' || d.kind === 'fullstack') skillsList.push('- `.claude/skills/backend-skills/SKILL.md` - how to add models, services, controllers, routes in this repo.');
  const pm = d.packageManager || 'npm';
  const scripts = d.packages[0] ? Object.entries(d.packages[0].scripts).map((kv) => pm + ' run ' + kv[0] + '    # ' + kv[1]).join('\n') : '';
  return Object.assign({
    PROJECT_NAME: d.projectName,
    PROJECT_KIND: d.kind,
    REPO_ALLOWLIST: d.repoAllowlist,
    REGISTRY_HOST: d.registryHost,
    DATE: d.date,
    DEFAULT_BRANCH: d.git.defaultBranch || 'main',
    TEST_CMD: d.testCommand || '(no test script found)',
    PACKAGE_MANAGER: pm,
    SCRIPTS: scripts,
    ENV_VARS: d.envVarNames.length ? d.envVarNames.map((n) => '- `' + n + '`').join('\n') : '- (none detected)',
    RULES_IMPORTS: ['@.claude/rules/tech-stack.md', '@.claude/rules/requirements.md'].join('\n'),
    SKILLS_LIST: skillsList.join('\n') || '- (none generated)',
    AGENTS_LIST: '- `git-reconciler` - merge conflicts, diverged branches, PR mergeability via git + gh. Claude: `.claude/agents/git-reconciler.md`; Copilot: `.github/agents/git-reconciler.agent.md`.',
    HOOKS_SUMMARY: [
      '- Deny: reading, editing or writing `.env*` (except `.env.example`), keys, `.npmrc`, `secrets/`, `credentials*`; writing connection strings or API tokens; `git push --force`, `reset --hard`, history rewrite, `--no-verify`; `rm -r*`, `Remove-Item -Recurse`, `dd`, `mkfs`; database drops and unfiltered mass deletes.',
      '- Ask: plain `rm`/`del`/`Remove-Item`, `git branch -D`, `git clean`, `git checkout --`, `git restore`, `git rm`, `git add -A`, stash drop, remote branch delete, `aws s3 rm`, filtered mass DB writes, DB shells, env dumps.',
      '- Scripts: `.claude/hooks/guard.js` (decision), `.claude/hooks/prompt-guard.js` (reminder), `.claude/hooks/activity-logger.js` (writes `docs/activity-log/`).',
      '- Claude Code wiring: `.claude/settings.json` (permissions.deny / permissions.ask run before hooks). Copilot CLI wiring: `.github/hooks/agent-guard.json` (start `copilot` from the repo root).',
    ].join('\n'),
  }, overrides || {});
}

function agents(root, args) {
  const d = detect(root, args);
  const vars = mechanicalVars(d, args.vars);
  const results = [];
  const wantClaude = args.tools === 'both' || args.tools === 'claude';
  const wantCopilot = args.tools === 'both' || args.tools === 'copilot';
  if (wantClaude) writeTarget(root, '.claude/agents/git-reconciler.md', fillVars(fs.readFileSync(path.join(ASSETS, 'templates', 'git-reconciler.claude.md'), 'utf8'), vars), args, results);
  if (wantCopilot) writeTarget(root, '.github/agents/git-reconciler.agent.md', fillVars(fs.readFileSync(path.join(ASSETS, 'templates', 'git-reconciler.copilot.agent.md'), 'utf8'), vars), args, results);
  return results;
}

// Mirror .claude/rules/*.md into .github/instructions/*.instructions.md with applyTo.
function mirror(root, args) {
  const d = detect(root, args);
  const rulesDir = path.join(root, '.claude', 'rules');
  const results = [];
  if (!exists(rulesDir)) return [{ target: '.claude/rules', action: 'missing', wroteTo: '' }];
  const applyToFor = (name) => {
    if (/design-notes/i.test(name)) {
      if (d.kind === 'frontend') return '**/*.{ts,tsx,jsx,js,vue,svelte,html,scss,css}';
      if (d.kind === 'backend') return '**/*.{js,ts,html,css}';
      return '**/*.{ts,tsx,jsx,js,vue,svelte,html,scss,css}';
    }
    return '**';
  };
  for (const f of fs.readdirSync(rulesDir)) {
    if (!/\.md$/i.test(f) || /\.generated\.md$/i.test(f)) continue;
    const body = fs.readFileSync(path.join(rulesDir, f), 'utf8').replace(/^---[\s\S]*?---\s*/, '');
    const name = f.replace(/\.md$/i, '');
    const content = '---\napplyTo: "' + applyToFor(name) + '"\n---\n<!-- Generated from .claude/rules/' + f + ' by agent-scaffold. Edit the source, then re-run: scaffold.js mirror -->\n\n' + body;
    writeTarget(root, '.github/instructions/' + name + '.instructions.md', content, args, results);
  }
  return results;
}

function fill(templateName, root, args) {
  const d = detect(root, args);
  const vars = mechanicalVars(d, args.vars);
  const p = path.join(ASSETS, 'templates', templateName);
  if (!exists(p)) throw new Error('template not found: ' + templateName + '. Available: ' + fs.readdirSync(path.join(ASSETS, 'templates')).join(', '));
  return fillVars(fs.readFileSync(p, 'utf8'), vars);
}

function write(root, relTarget, args) {
  if (!args.from) throw new Error('write requires --from <file>');
  if (!relTarget) throw new Error('write requires a relative target path');
  const results = [];
  writeTarget(root, relTarget, fs.readFileSync(path.resolve(args.from), 'utf8'), args, results);
  return results;
}

function report(root, args) {
  const d = detect(root, Object.assign({}, args, { force: true }));
  const lines = ['# agent-scaffold report for ' + d.projectName + ' (' + d.kind + ')', ''];
  for (const t of d.targets) {
    const gen = path.join(root, generatedName(t.path));
    const mark = t.exists ? 'x' : ' ';
    const extra = exists(gen) ? '  <- merge pending: ' + rel(root, gen) : '';
    lines.push('- [' + mark + '] ' + t.path + ' (' + t.owner + ')' + extra);
  }
  const settings = readJson(path.join(root, '.claude', 'settings.json'));
  const hasGuard = !!(settings && settings.hooks && settings.hooks.PreToolUse && JSON.stringify(settings.hooks.PreToolUse).includes('guard.js'));
  lines.push('', '- Claude PreToolUse guard wired: ' + (hasGuard ? 'yes' : 'no'));
  const copilotHooks = readJson(path.join(root, '.github', 'hooks', 'agent-guard.json'));
  lines.push('- Copilot preToolUse guard wired: ' + (copilotHooks && copilotHooks.hooks && copilotHooks.hooks.preToolUse ? 'yes' : 'no'));
  lines.push('- Activity log dir: ' + (exists(path.join(root, 'docs', 'activity-log')) ? 'present' : 'missing'));
  lines.push('- Git remotes: ' + (d.git.remotes.length ? d.git.remotes.join(', ') : 'none (REPO_ALLOWLIST placeholder left for you to fill)'));
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  try {
    if (cmd === 'detect') {
      process.stdout.write(JSON.stringify(detect(resolveRoot(args._[1]), args), null, 2) + '\n');
    } else if (cmd === 'hooks') {
      process.stdout.write(JSON.stringify(hooks(resolveRoot(args._[1]), args), null, 2) + '\n');
    } else if (cmd === 'agents') {
      process.stdout.write(JSON.stringify(agents(resolveRoot(args._[1]), args), null, 2) + '\n');
    } else if (cmd === 'mirror') {
      process.stdout.write(JSON.stringify(mirror(resolveRoot(args._[1]), args), null, 2) + '\n');
    } else if (cmd === 'fill') {
      process.stdout.write(fill(args._[1], resolveRoot(args._[2]), args));
    } else if (cmd === 'write') {
      process.stdout.write(JSON.stringify(write(resolveRoot(args._[1]), args._[2], args), null, 2) + '\n');
    } else if (cmd === 'report') {
      process.stdout.write(report(resolveRoot(args._[1]), args) + '\n');
    } else {
      process.stderr.write('usage: scaffold.js <detect|hooks|agents|mirror|fill|write|report> ... (see file header)\n');
      process.exit(1);
    }
  } catch (e) {
    process.stderr.write('scaffold.js error: ' + e.message + '\n');
    process.exit(1);
  }
}

main();
