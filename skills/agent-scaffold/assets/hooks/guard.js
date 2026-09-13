#!/usr/bin/env node
/*
 * agent-scaffold guard.js
 * PreToolUse (Claude Code) / preToolUse (GitHub Copilot CLI) permission guard.
 *
 * Decisions:
 *   deny - secret files and secret-shaped content, force push, history rewrite,
 *          recursive delete, disk and database wipes
 *   ask  - ordinary deletes and reversible-but-risky git or database operations
 *
 * Input:  hook payload JSON on stdin
 *         Claude:  { tool_name, tool_input }
 *         Copilot: { toolName, toolArgs }   (pass --copilot to force this output shape)
 * Output: decision JSON in the calling tool shape. No output means allow.
 * Failure policy: any internal error exits 0 with no output so a bug here can never
 * break a session. Copilot deny also exits 2 (spec: exit 2 on preToolUse = deny).
 */
'use strict';

const FORCE_COPILOT = process.argv.includes('--copilot');

// Secret file paths. Example and template env files are allowed.
const SECRET_PATH = /(^|[\\/])\.env(\.[^\\/]+)?$|\.(pem|key|p12|pfx|jks|keystore)$|(^|[\\/])id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$|(^|[\\/])\.npmrc$|(^|[\\/])secrets?[\\/]|(^|[\\/])credentials?(\.[^\\/]+)?$/i;
const SECRET_PATH_ALLOW = /\.env\.(example|sample|template|dist)$/i;

// Secret-shaped content that must never be written into source.
const CONTENT_DENY = [
  [/\b(mongodb(\+srv)?|postgres(ql)?|mysql|redis|amqps?|mssql):\/\/[^\s'"@\/]+:[^\s'"@]+@/i, 'connection string with embedded credentials'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key id'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key block'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, 'Anthropic API key'],
  [/\bsk-[A-Za-z0-9]{32,}\b/, 'API key (sk- prefix)'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'GitHub token'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
];
const CONTENT_ASK = [
  [/\b(api[_-]?key|secret|passw(or)?d|token|client[_-]?secret|private[_-]?key)\b\s*[:=]\s*['"][^'"\s]{8,}['"]/i, 'hardcoded credential-like value'],
];

// Shell command patterns. Deny is checked before ask.
const SHELL_DENY = [
  [/\bgit\s+push\b[^|;&\n]*(\s--force(-with-lease)?\b|\s-f\b|\s\+\S)/i, 'git force push'],
  [/\bgit\s+reset\s+--hard\b/i, 'git reset --hard'],
  [/\bgit\s+(filter-branch|filter-repo)\b/i, 'git history rewrite'],
  [/\bgit\s+update-ref\s+-d\b/i, 'git update-ref -d'],
  [/\bgit\s+reflog\s+expire\b/i, 'git reflog expire'],
  [/\bgit\s+\S+[^|;&\n]*\s--no-verify\b/i, 'git --no-verify (hook bypass)'],
  [/\brm\s+(-[a-zA-Z]*[rR][a-zA-Z]*\b|--recursive\b)/i, 'recursive rm'],
  [/\bremove-item\b[^|;&\n]*\s-recurse\b/i, 'Remove-Item -Recurse'],
  [/\b(rd|rmdir)\s+\/s\b/i, 'rmdir /s'],
  [/\bdd\s+if=/i, 'dd'],
  [/\bmkfs(\.\w+)?\b/i, 'mkfs'],
  [/\bshred\b/i, 'shred'],
  [/\bdrop\s+(database|table|collection|schema)\b/i, 'database drop'],
  [/\.(dropDatabase|drop)\s*\(\s*\)/i, 'database drop'],
  [/\.(deleteMany|remove)\s*\(\s*(\{\s*\})?\s*\)/i, 'unfiltered mass delete'],
  [/\baws\s+s3\s+rb\b/i, 'aws s3 rb (bucket delete)'],
  [/\baws\s+s3\s+rm\b[^|;&\n]*--recursive\b/i, 'aws s3 rm --recursive'],
];
const SHELL_ASK = [
  [/\brm\s/i, 'rm'],
  [/(^|[\s;&|(])(del|erase)\s/i, 'del/erase'],
  [/(^|[\s;&|(])(rmdir|rd)\s/i, 'rmdir'],
  [/\bremove-item\b|(^|[\s;&|(])ri\s+-|\[system\.io\.(file|directory)\]::delete/i, 'Remove-Item'],
  [/(^|[\s;&|(])unlink\s/i, 'unlink'],
  [/\bfind\b[^|;&\n]*\s-delete\b/i, 'find -delete'],
  [/\bclear-content\b/i, 'Clear-Content'],
  [/\btruncate\b/i, 'truncate'],
  [/\bgit\s+branch\s+(-D|-d|--delete)\b/i, 'git branch delete'],
  [/\bgit\s+clean\b/i, 'git clean'],
  [/\bgit\s+checkout\s+--\s/i, 'git checkout -- (discard changes)'],
  [/\bgit\s+restore\b/i, 'git restore'],
  [/\bgit\s+rm\b/i, 'git rm'],
  [/\bgit\s+add\s+(-A|--all)\b/i, 'git add -A (may sweep untracked secrets)'],
  [/\bgit\s+stash\s+(drop|clear)\b/i, 'git stash drop/clear'],
  [/\bgit\s+push\b[^|;&\n]*(\s--delete\b|\s:\S)/i, 'deleting a remote branch'],
  [/\baws\s+s3\s+rm\b/i, 'aws s3 rm'],
  [/\b(deleteMany|updateMany|dropIndex|dropIndexes)\s*\(/i, 'mass database write'],
  [/(^|[\s;&|(])(mongosh|mongo|psql|mysql|sqlite3)\s/i, 'direct database shell'],
  [/(^|[\s;&|(])(printenv|env|set)\s*($|[|;&])/i, 'environment dump'],
  [/\b(get-childitem|gci|dir|ls)\s+env:/i, 'environment dump'],
  [/\bnpm\s+(rm|uninstall|un|remove)\b|\byarn\s+remove\b|\bpnpm\s+(rm|remove)\b/i, 'package removal'],
];

// MCP tool names (suffix match).
const MCP_DENY = [/drop-database$/i, /drop-collection$/i, /atlas-local-delete-deployment$/i];
const MCP_ASK = [/delete-many$/i, /update-many$/i, /drop-index$/i, /rename-collection$/i];
const AWS_MCP = /aws___call_aws|aws___run_script/i;
const AWS_DESTRUCTIVE = /\b(delete|remove|terminate|destroy|purge|deregister|revoke|detach|abort)[\w-]*|\brb\b|\brm\b/i;

const SHELL_TOOL = /^(bash|powershell|shell|execute|cmd|terminal|run_terminal_cmd|run_in_terminal|execute_command)$/i;
const WRITE_TOOL = /^(write|edit|multiedit|notebookedit|create|create_file|edit_file|write_file|replace_string_in_file|insert_edit_into_file|str_replace_editor|apply_patch)$/i;

function pick(obj, keys) {
  for (const k of keys) {
    if (typeof obj[k] === 'string' && obj[k]) return obj[k];
  }
  return '';
}

function normalize(payload) {
  const copilot = FORCE_COPILOT || (payload.toolName !== undefined && payload.tool_name === undefined);
  const tool = String(payload.tool_name || payload.toolName || '');
  const raw = payload.tool_input !== undefined ? payload.tool_input : payload.toolArgs;
  const args = raw && typeof raw === 'object' ? raw : {};
  let blob = '';
  try {
    blob = typeof raw === 'string' ? raw : JSON.stringify(raw || {});
  } catch (e) {
    blob = '';
  }
  let content = pick(args, ['content', 'new_string', 'newString', 'new_str', 'text', 'file_text', 'data', 'code']);
  if (Array.isArray(args.edits)) content += ' ' + JSON.stringify(args.edits);
  return {
    copilot,
    tool,
    command: pick(args, ['command', 'cmd', 'script', 'commandLine']) || (typeof raw === 'string' ? raw : ''),
    filePath: pick(args, ['file_path', 'filePath', 'path', 'notebook_path', 'target_file', 'file', 'target']),
    content,
    blob,
  };
}

function secretToken(text) {
  const tokens = String(text).split(/[\s"'`=;|&()<>,]+/);
  return tokens.find((t) => t && SECRET_PATH.test(t) && !SECRET_PATH_ALLOW.test(t)) || null;
}

function firstMatch(rules, text) {
  for (const [re, label] of rules) {
    if (re.test(text)) return label;
  }
  return null;
}

function decide(n) {
  const { tool, command, filePath, content, blob } = n;

  // MCP tools.
  if (AWS_MCP.test(tool)) {
    if (AWS_DESTRUCTIVE.test(blob)) return ['ask', 'Potentially destructive AWS operation via ' + tool + ': ' + blob.slice(0, 200)];
    return null;
  }
  if (/__/.test(tool)) {
    if (MCP_DENY.some((re) => re.test(tool))) return ['deny', 'Destructive database tool ' + tool + ' is blocked by the agent guard.'];
    if (MCP_ASK.some((re) => re.test(tool))) return ['ask', 'Mass database write via ' + tool + '. Confirm the target and filter.'];
  }

  // File tools: secret paths and secret content.
  if (filePath) {
    const hit = secretToken(filePath);
    if (hit) return ['deny', 'Access to secret file "' + hit + '" is blocked. Env files, keys and credentials are off limits to the agent.'];
  }
  if (content && (WRITE_TOOL.test(tool) || filePath)) {
    const d = firstMatch(CONTENT_DENY, content);
    if (d) return ['deny', 'Refusing to write a ' + d + '. Keep secrets in environment variables, never in source.'];
    const a = firstMatch(CONTENT_ASK, content);
    if (a) return ['ask', 'Content contains a ' + a + '. Confirm this is a placeholder, not a real secret.'];
  }

  // Shell commands.
  if (command && (SHELL_TOOL.test(tool) || !filePath)) {
    const hit = secretToken(command);
    if (hit) return ['deny', 'Command references secret file "' + hit + '". Run it yourself outside the agent.'];
    const d = firstMatch(SHELL_DENY, command);
    if (d) return ['deny', 'Blocked (' + d + '): ' + command.slice(0, 200)];
    const a = firstMatch(SHELL_ASK, command);
    if (a) return ['ask', 'Destructive or risky command (' + a + '): ' + command.slice(0, 200)];
    return null;
  }

  // Unknown tool shape: still refuse secret paths anywhere in the arguments.
  if (!filePath && !command && blob) {
    const hit = secretToken(blob);
    if (hit) return ['deny', 'Tool arguments reference secret file "' + hit + '".'];
  }
  return null;
}

function emit(copilot, decision, reason) {
  if (copilot) {
    process.stdout.write(JSON.stringify({ permissionDecision: decision, permissionDecisionReason: reason }));
    if (decision === 'deny') {
      process.stderr.write(reason);
      process.exit(2);
    }
    process.exit(0);
  }
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

function main(raw) {
  let payload;
  try {
    payload = JSON.parse(raw || '{}');
  } catch (e) {
    process.exit(0);
  }
  try {
    const n = normalize(payload || {});
    const result = decide(n);
    if (!result) process.exit(0);
    emit(n.copilot, result[0], result[1]);
  } catch (e) {
    process.exit(0);
  }
}

let raw = '';
const timer = setTimeout(() => process.exit(0), 4000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => { clearTimeout(timer); main(raw); });
process.stdin.on('error', () => process.exit(0));
