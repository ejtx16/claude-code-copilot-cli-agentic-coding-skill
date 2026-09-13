#!/usr/bin/env node
/*
 * agent-scaffold prompt-guard.js
 * Injects a short rules reminder into the agent context.
 *   Claude Code:  UserPromptSubmit hook, plain stdout becomes context on every prompt.
 *   Copilot CLI:  sessionStart hook, {"additionalContext"} once per session
 *                 (userPromptSubmitted command hooks cannot add context by spec).
 * Never fails: any error exits 0.
 */
'use strict';

const FORCE_COPILOT = process.argv.includes('--copilot');

const REMINDER = [
  'AGENT GUARD ACTIVE (agent-scaffold hooks).',
  '- Secrets: never read, edit or write .env*, keys, tokens or connection strings; the guard denies them. Use .env.example for shape.',
  '- Git: no force push, no history rewrite, no --no-verify; the guard denies them. Do not push unless asked.',
  '- Deletes (rm, del, git clean, branch -D, DB mass writes) prompt for confirmation; prefer moving files to scratch.',
  '- Follow AGENTS.md rules. Run major changes by the user first. Log significant changes in the activity log.',
].join('\n');

function finish(raw) {
  let copilot = FORCE_COPILOT;
  try {
    const p = JSON.parse(raw || '{}');
    if (!copilot && p && p.hook_event_name === undefined && (p.sessionId !== undefined || p.toolName !== undefined)) copilot = true;
  } catch (e) {
    // Ignore malformed input; the default output still helps.
  }
  if (copilot) {
    process.stdout.write(JSON.stringify({ additionalContext: REMINDER }));
  } else {
    process.stdout.write(REMINDER + '\n');
  }
  process.exit(0);
}

let raw = '';
const timer = setTimeout(() => finish(raw), 2000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => { clearTimeout(timer); finish(raw); });
process.stdin.on('error', () => finish(raw));
