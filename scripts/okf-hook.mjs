#!/usr/bin/env node
// Claude Code PostToolUse hook: after an agent writes/edits a docs/ Markdown
// file, run the OKF linter on just that file and, if it fails, feed the
// findings back to the agent (exit 2) so it self-corrects before moving on.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { /* no stdin */ }

let payload = {};
try { payload = JSON.parse(raw || '{}'); } catch { /* ignore */ }

const file =
  payload?.tool_input?.file_path ||
  payload?.tool_input?.filePath ||
  payload?.toolInput?.file_path ||
  '';

// Only care about Markdown inside the bundle.
if (!file || !/\/docs\/.*\.md$/.test('/' + file.replace(/^\/+/, '')) ) process.exit(0);

const rel = file.slice(file.indexOf('docs/'));
const res = spawnSync('node', ['scripts/okf-lint.mjs', rel], { encoding: 'utf8' });
if (res.status && res.status !== 0) {
  process.stderr.write(
    'OKF conformance check failed for ' + rel + ':\n' +
    (res.stdout || '') + (res.stderr || '') +
    '\nEvery concept doc needs YAML frontmatter with a non-empty `type`; index.md/log.md are reserved. ' +
    'See docs/authoring-okf.md.\n'
  );
  process.exit(2); // surfaced to the agent as actionable feedback
}
process.exit(0);
