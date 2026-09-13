#!/usr/bin/env node
/*
 * agent-scaffold verify.js
 * Fixture-driven checks for the guard hooks and generated files.
 *
 *   node verify.js --self      test the bundled scripts in assets/hooks
 *   node verify.js <repo>      test an installed repo (.claude/hooks, settings, copilot hooks, targets)
 *
 * Exit 1 when any check fails.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SKILL_DIR = path.resolve(__dirname, '..');
const ASSETS_HOOKS = path.join(SKILL_DIR, 'assets', 'hooks');

const FIXTURES = [
  { name: 'claude: cat .env', payload: { tool_name: 'Bash', tool_input: { command: 'cat .env' } }, expect: 'deny' },
  { name: 'claude: cd && cat .env', payload: { tool_name: 'Bash', tool_input: { command: 'cd "C:/x y" && cat .env | head' } }, expect: 'deny' },
  { name: 'claude: Read .env', payload: { tool_name: 'Read', tool_input: { file_path: '/repo/.env' } }, expect: 'deny' },
  { name: 'claude: Read .env.staging', payload: { tool_name: 'Read', tool_input: { file_path: 'C:\\repo\\.env.staging' } }, expect: 'deny' },
  { name: 'claude: Read .env.example', payload: { tool_name: 'Read', tool_input: { file_path: 'C:/x/.env.example' } }, expect: 'allow' },
  { name: 'claude: Read id_rsa', payload: { tool_name: 'Read', tool_input: { file_path: '/home/u/.ssh/id_rsa' } }, expect: 'deny' },
  { name: 'claude: Edit .npmrc', payload: { tool_name: 'Edit', tool_input: { file_path: '.npmrc', new_string: 'x' } }, expect: 'deny' },
  { name: 'claude: git push --force', payload: { tool_name: 'Bash', tool_input: { command: 'git push --force origin main' } }, expect: 'deny' },
  { name: 'claude: git push -f trailing', payload: { tool_name: 'Bash', tool_input: { command: 'git push origin main -f' } }, expect: 'deny' },
  { name: 'claude: git push +ref', payload: { tool_name: 'Bash', tool_input: { command: 'git push origin +main' } }, expect: 'deny' },
  { name: 'claude: git push normal', payload: { tool_name: 'Bash', tool_input: { command: 'git push origin feature/x' } }, expect: 'allow' },
  { name: 'claude: git push --follow-tags', payload: { tool_name: 'Bash', tool_input: { command: 'git push --follow-tags' } }, expect: 'allow' },
  { name: 'claude: git commit --no-verify', payload: { tool_name: 'Bash', tool_input: { command: 'git commit -m x --no-verify' } }, expect: 'deny' },
  { name: 'claude: git reset --hard', payload: { tool_name: 'Bash', tool_input: { command: 'git reset --hard HEAD~1' } }, expect: 'deny' },
  { name: 'claude: rm file', payload: { tool_name: 'Bash', tool_input: { command: 'rm tmp.txt' } }, expect: 'ask' },
  { name: 'claude: rm -rf', payload: { tool_name: 'Bash', tool_input: { command: 'rm -rf dist' } }, expect: 'deny' },
  { name: 'claude: rm -r', payload: { tool_name: 'Bash', tool_input: { command: 'rm -r build' } }, expect: 'deny' },
  { name: 'claude: git status', payload: { tool_name: 'Bash', tool_input: { command: 'git status -sb && git log --oneline -3' } }, expect: 'allow' },
  { name: 'claude: npm test', payload: { tool_name: 'Bash', tool_input: { command: 'npm test' } }, expect: 'allow' },
  { name: 'claude: git branch -D', payload: { tool_name: 'Bash', tool_input: { command: 'git branch -D old' } }, expect: 'ask' },
  { name: 'claude: git clean', payload: { tool_name: 'Bash', tool_input: { command: 'git clean -fd' } }, expect: 'ask' },
  { name: 'claude: git add -A', payload: { tool_name: 'Bash', tool_input: { command: 'git add -A' } }, expect: 'ask' },
  { name: 'claude: git add .env', payload: { tool_name: 'Bash', tool_input: { command: 'git add .env' } }, expect: 'deny' },
  { name: 'claude: PowerShell Remove-Item -Recurse', payload: { tool_name: 'PowerShell', tool_input: { command: 'Remove-Item -Recurse -Force dist' } }, expect: 'deny' },
  { name: 'claude: PowerShell Remove-Item file', payload: { tool_name: 'PowerShell', tool_input: { command: 'Remove-Item tmp.txt' } }, expect: 'ask' },
  { name: 'claude: Write connection string', payload: { tool_name: 'Write', tool_input: { file_path: 'config/db.js', content: 'const uri = "mongodb+srv://user:pass123@cluster.x.net/db";' } }, expect: 'deny' },
  { name: 'claude: Write AWS key', payload: { tool_name: 'Write', tool_input: { file_path: 'a.js', content: 'const k = "AKIAIOSFODNN7EXAMPLE";' } }, expect: 'deny' },
  { name: 'claude: Edit password literal', payload: { tool_name: 'Edit', tool_input: { file_path: 'seed.js', old_string: 'x', new_string: "password: 'Sup3rSecret!'" } }, expect: 'ask' },
  { name: 'claude: Edit process.env usage', payload: { tool_name: 'Edit', tool_input: { file_path: 'config/db.js', old_string: 'x', new_string: 'const uri = process.env.MONGODB_URI;' } }, expect: 'allow' },
  { name: 'claude: mongodb drop-database MCP', payload: { tool_name: 'mcp__plugin_mongodb_mongodb__drop-database', tool_input: { database: 'saims' } }, expect: 'deny' },
  { name: 'claude: mongodb delete-many MCP', payload: { tool_name: 'mcp__plugin_mongodb_mongodb__delete-many', tool_input: { collection: 'items', filter: {} } }, expect: 'ask' },
  { name: 'claude: mongosh drop', payload: { tool_name: 'Bash', tool_input: { command: 'mongosh saims --eval "db.dropDatabase()"' } }, expect: 'deny' },
  { name: 'copilot: bash git push -f', copilot: true, payload: { toolName: 'bash', toolArgs: { command: 'git push -f' } }, expect: 'deny', exit: 2 },
  { name: 'copilot: edit .env', copilot: true, payload: { toolName: 'edit', toolArgs: { path: '.env', content: 'A=1' } }, expect: 'deny', exit: 2 },
  { name: 'copilot: powershell Remove-Item', copilot: true, payload: { toolName: 'powershell', toolArgs: { command: 'Remove-Item a.txt' } }, expect: 'ask', exit: 0 },
  { name: 'copilot: view README', copilot: true, payload: { toolName: 'view', toolArgs: { path: 'README.md' } }, expect: 'allow', exit: 0 },
  { name: 'copilot: unknown tool with .env arg', copilot: true, payload: { toolName: 'someTool', toolArgs: { target_file: 'src/.env.local' } }, expect: 'deny', exit: 2 },
  { name: 'copilot: auto-detect shape without flag', payload: { toolName: 'bash', toolArgs: { command: 'rm -rf node_modules' } }, expect: 'deny', exit: 2 },
  { name: 'malformed json', raw: 'not json at all', expect: 'allow', exit: 0 },
  { name: 'empty stdin', raw: '', expect: 'allow', exit: 0 },
];

function runGuard(guardPath, fx) {
  const argv = [guardPath].concat(fx.copilot ? ['--copilot'] : []);
  const input = fx.raw !== undefined ? fx.raw : JSON.stringify(fx.payload);
  const r = spawnSync(process.execPath, argv, { input, encoding: 'utf8', timeout: 10000 });
  let decision = 'allow';
  const out = (r.stdout || '').trim();
  if (out) {
    try {
      const j = JSON.parse(out);
      decision = (j.hookSpecificOutput && j.hookSpecificOutput.permissionDecision) || j.permissionDecision || 'allow';
    } catch (e) {
      decision = 'unparseable:' + out.slice(0, 40);
    }
  }
  return { decision, exit: r.status, out };
}

function testGuard(guardPath) {
  const rows = [];
  let fails = 0;
  for (const fx of FIXTURES) {
    const r = runGuard(guardPath, fx);
    const expectExit = fx.exit !== undefined ? fx.exit : 0;
    const ok = r.decision === fx.expect && r.exit === expectExit;
    if (!ok) fails++;
    rows.push((ok ? 'PASS' : 'FAIL') + '  ' + fx.name.padEnd(44) + ' expect=' + fx.expect + '/' + expectExit + ' got=' + r.decision + '/' + r.exit);
  }
  return { rows, fails };
}

function testPromptGuard(p) {
  const rows = [];
  let fails = 0;
  const c = spawnSync(process.execPath, [p], { input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', user_input: 'hi' }), encoding: 'utf8', timeout: 10000 });
  const okC = c.status === 0 && /AGENT GUARD ACTIVE/.test(c.stdout) && !/^\s*\{/.test(c.stdout);
  if (!okC) fails++;
  rows.push((okC ? 'PASS' : 'FAIL') + '  prompt-guard claude plain text');
  const g = spawnSync(process.execPath, [p, '--copilot'], { input: JSON.stringify({ sessionId: 'x', source: 'startup' }), encoding: 'utf8', timeout: 10000 });
  let okG = false;
  try {
    okG = g.status === 0 && /AGENT GUARD ACTIVE/.test(JSON.parse(g.stdout).additionalContext);
  } catch (e) {
    okG = false;
  }
  if (!okG) fails++;
  rows.push((okG ? 'PASS' : 'FAIL') + '  prompt-guard copilot additionalContext json');
  return { rows, fails };
}

function testLogger(p) {
  const rows = [];
  let fails = 0;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-scaffold-'));
  const run = (payload) => spawnSync(process.execPath, [p], { input: JSON.stringify(Object.assign({ cwd: tmp }, payload)), encoding: 'utf8', timeout: 10000 });
  run({ tool_name: 'Edit', tool_input: { file_path: 'src/a.js' } });
  run({ tool_name: 'Bash', tool_input: { command: 'git status' } });
  run({ toolName: 'bash', toolArgs: { command: 'npm install foo' } });
  const claudeLog = path.join(tmp, 'docs', 'activity-log', 'claude-activity.md');
  const copilotLog = path.join(tmp, 'docs', 'activity-log', 'copilot-activity.md');
  const c = fs.existsSync(claudeLog) ? fs.readFileSync(claudeLog, 'utf8') : '';
  const g = fs.existsSync(copilotLog) ? fs.readFileSync(copilotLog, 'utf8') : '';
  const okC = /src\/a\.js/.test(c) && !/git status/.test(c);
  const okG = /npm install foo/.test(g);
  if (!okC) fails++;
  if (!okG) fails++;
  rows.push((okC ? 'PASS' : 'FAIL') + '  activity-logger claude (logs Edit, skips git status)');
  rows.push((okG ? 'PASS' : 'FAIL') + '  activity-logger copilot');
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch (e) {
    // Temp cleanup is best effort.
  }
  return { rows, fails };
}

function testJson(files) {
  const rows = [];
  let fails = 0;
  for (const f of files) {
    let ok = false;
    try {
      JSON.parse(fs.readFileSync(f, 'utf8'));
      ok = true;
    } catch (e) {
      ok = false;
    }
    if (!ok) fails++;
    rows.push((ok ? 'PASS' : 'FAIL') + '  valid JSON: ' + path.basename(f));
  }
  return { rows, fails };
}

function selfTest() {
  const parts = [
    testGuard(path.join(ASSETS_HOOKS, 'guard.js')),
    testPromptGuard(path.join(ASSETS_HOOKS, 'prompt-guard.js')),
    testLogger(path.join(ASSETS_HOOKS, 'activity-logger.js')),
    testJson([path.join(ASSETS_HOOKS, 'claude.settings.fragment.json'), path.join(ASSETS_HOOKS, 'copilot.hooks.json')]),
  ];
  return finish(parts);
}

function repoTest(repo) {
  const root = path.resolve(repo);
  const rows = [];
  let fails = 0;
  const expectFiles = ['.claude/hooks/guard.js', '.claude/hooks/prompt-guard.js', '.claude/hooks/activity-logger.js', 'AGENTS.md'];
  for (const f of expectFiles) {
    const ok = fs.existsSync(path.join(root, f));
    if (!ok) fails++;
    rows.push((ok ? 'PASS' : 'FAIL') + '  exists: ' + f);
  }
  const settingsPath = path.join(root, '.claude', 'settings.json');
  const copilotPath = path.join(root, '.github', 'hooks', 'agent-guard.json');
  if (fs.existsSync(settingsPath)) {
    let ok = false;
    try {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      ok = !!(s.hooks && s.hooks.PreToolUse && JSON.stringify(s.hooks.PreToolUse).includes('guard.js') && s.permissions && Array.isArray(s.permissions.deny) && s.permissions.deny.some((x) => /\.env/.test(x)));
    } catch (e) {
      ok = false;
    }
    if (!ok) fails++;
    rows.push((ok ? 'PASS' : 'FAIL') + '  .claude/settings.json wires guard.js and denies .env');
  } else rows.push('SKIP  .claude/settings.json not present (copilot-only scaffold?)');
  if (fs.existsSync(copilotPath)) {
    let ok = false;
    try {
      const c = JSON.parse(fs.readFileSync(copilotPath, 'utf8'));
      ok = !!(c.hooks && c.hooks.preToolUse && JSON.stringify(c.hooks.preToolUse).includes('guard.js'));
    } catch (e) {
      ok = false;
    }
    if (!ok) fails++;
    rows.push((ok ? 'PASS' : 'FAIL') + '  .github/hooks/agent-guard.json wires guard.js');
  } else rows.push('SKIP  .github/hooks/agent-guard.json not present (claude-only scaffold?)');
  const parts = [{ rows, fails }];
  const guard = path.join(root, '.claude', 'hooks', 'guard.js');
  if (fs.existsSync(guard)) parts.push(testGuard(guard));
  const generated = [];
  const walk = (dir, depth) => {
    if (depth > 4) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        walk(path.join(dir, e.name), depth + 1);
      } else if (/\.generated\.[a-z]+$/i.test(e.name)) generated.push(path.relative(root, path.join(dir, e.name)).replace(/\\/g, '/'));
    }
  };
  walk(root, 0);
  parts.push({ rows: generated.length ? ['NOTE  pending manual merge:'].concat(generated.map((g) => '      ' + g)) : ['NOTE  no .generated files pending'], fails: 0 });
  return finish(parts);
}

function finish(parts) {
  let fails = 0;
  for (const p of parts) {
    fails += p.fails;
    process.stdout.write(p.rows.join('\n') + '\n');
  }
  process.stdout.write('\n' + (fails === 0 ? 'ALL CHECKS PASSED' : fails + ' CHECK(S) FAILED') + '\n');
  process.exit(fails === 0 ? 0 : 1);
}

const arg = process.argv[2];
if (!arg) {
  process.stderr.write('usage: verify.js --self | verify.js <repo>\n');
  process.exit(1);
}
if (arg === '--self') selfTest();
else repoTest(arg);
