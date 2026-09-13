#!/usr/bin/env node
/*
 * agent-scaffold activity-logger.js
 * PostToolUse (Claude Code) / postToolUse (Copilot CLI) logger.
 * Appends one line per mutating tool call to docs/activity-log/<tool>-activity.md
 * so agent changes stay traceable next to git history.
 * Never blocks: any failure exits 0 silently.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const FORCE_COPILOT = process.argv.includes('--copilot');
const MUTATING = /^(edit|write|multiedit|notebookedit|bash|powershell|shell|execute|create|create_file|edit_file|write_file|replace_string_in_file|insert_edit_into_file|apply_patch)$/i;
const READ_ONLY_CMD = /^(ls|dir|cat|type|head|tail|grep|rg|find|echo|pwd|which|where|node --check|node -e|git (status|log|diff|show|branch|remote|rev-parse|fetch)|gh (pr view|pr checks|auth status)|Get-Content|Get-ChildItem|Select-String|Test-Path)\b/i;

function run(raw) {
  try {
    const p = JSON.parse(raw || '{}');
    const copilot = FORCE_COPILOT || (p.toolName !== undefined && p.tool_name === undefined);
    const tool = String(p.tool_name || p.toolName || '');
    if (!MUTATING.test(tool)) process.exit(0);
    const input = p.tool_input || p.toolArgs || {};
    const args = input && typeof input === 'object' ? input : {};

    let detail = String(args.file_path || args.filePath || args.path || '').replace(/\\/g, '/');
    if (!detail) {
      detail = String(args.command || args.cmd || args.script || (typeof input === 'string' ? input : '')).replace(/\s+/g, ' ').slice(0, 160);
      if (READ_ONLY_CMD.test(detail)) process.exit(0);
    }
    if (!detail || detail.includes('docs/activity-log/')) process.exit(0);

    const cwd = p.cwd || process.cwd();
    const logDir = path.join(cwd, 'docs', 'activity-log');
    const logFile = path.join(logDir, copilot ? 'copilot-activity.md' : 'claude-activity.md');
    const project = path.basename(cwd);

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const ts = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());

    if (!fs.existsSync(logFile)) {
      fs.mkdirSync(logDir, { recursive: true });
      fs.writeFileSync(
        logFile,
        '# ' + project + ' - ' + (copilot ? 'Copilot CLI' : 'Claude Code') + ' Activity Log\n\n' +
          'Auto-generated one line per mutating agent tool call\n' +
          '(PostToolUse hook: .claude/hooks/activity-logger.js).\n\n---\n\n'
      );
    }
    fs.appendFileSync(logFile, '- **' + ts + '** `' + tool + '` - ' + detail + '\n');
  } catch (e) {
    // Never interfere with the session.
  }
  process.exit(0);
}

let raw = '';
const timer = setTimeout(() => process.exit(0), 3000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => { clearTimeout(timer); run(raw); });
process.stdin.on('error', () => process.exit(0));
