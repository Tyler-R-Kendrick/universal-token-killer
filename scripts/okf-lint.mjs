#!/usr/bin/env node
// OKF v0.1 conformance linter for the docs/ knowledge bundle.
// Spec: https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md
//
// Usage:
//   node scripts/okf-lint.mjs [--strict] [path ...]
//   (no path)  -> lint the whole docs/ bundle
//   [path ...] -> lint only the given files/dirs (used by the pre-commit hook)
//
// Exit code: 1 if any ERROR (or, with --strict, any WARN); else 0.

import fs from 'node:fs';
import path from 'node:path';

const BUNDLE = 'docs';
const RESERVED = new Set(['index.md', 'log.md']);
const RECOMMENDED = ['title', 'description', 'timestamp'];
const ISO = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/;

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const targets = args.filter((a) => !a.startsWith('--'));

const errors = [];
const warns = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warns.push(`${file}: ${msg}`);

const rootIndex = path.join(BUNDLE, 'index.md');

function listMarkdown(p) {
  const out = [];
  const st = fs.statSync(p);
  if (st.isFile()) { if (p.endsWith('.md')) out.push(p); return out; }
  for (const e of fs.readdirSync(p, { withFileTypes: true })) {
    const full = path.join(p, e.name);
    if (e.isDirectory()) out.push(...listMarkdown(full));
    else if (e.name.endsWith('.md')) out.push(full);
  }
  return out;
}

// Minimal, tolerant frontmatter reader. Returns:
//   { present, ok, data, bodyStart }  — ok=false means malformed block.
function parseFrontmatter(content, file) {
  if (!content.startsWith('---\n') && content !== '---') {
    return { present: false, ok: true, data: {}, bodyStart: 0 };
  }
  const lines = content.split('\n');
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { close = i; break; }
  }
  if (close === -1) { err(file, 'frontmatter opened with `---` but never closed'); return { present: true, ok: false, data: {}, bodyStart: 0 }; }

  const data = {};
  let lastKey = null;
  for (let i = 1; i < close; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9_]+):\s?(.*)$/);
    if (m) {
      lastKey = m[1];
      let v = m[2].trim();
      if (/^\[.*\]$/.test(v)) {
        v = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^"(.*)"$/, '$1')).filter(Boolean);
      } else {
        v = v.replace(/^"(.*)"$/, '$1');
      }
      data[m[1]] = v;
    } else if (/^\s+-\s+/.test(line) && lastKey) {
      if (!Array.isArray(data[lastKey])) data[lastKey] = [];
      data[lastKey].push(line.replace(/^\s+-\s+/, '').replace(/^"(.*)"$/, '$1'));
    } else {
      warn(file, `unparseable frontmatter line: ${JSON.stringify(line)}`);
    }
  }
  return { present: true, ok: true, data, bodyStart: close + 1 };
}

function checkLinks(file, content) {
  const dir = path.dirname(file);
  const re = /\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(content))) {
    let target = m[1].trim().split(/\s+/)[0];
    if (/^(https?:|mailto:|tel:|#)/i.test(target)) continue;
    const hash = target.indexOf('#');
    if (hash >= 0) target = target.slice(0, hash);
    if (!target) continue;
    let resolved;
    if (target.startsWith('/')) resolved = path.join(BUNDLE, target);
    else resolved = path.resolve(dir, target);
    // Only validate links that stay inside the bundle.
    const rel = path.relative(BUNDLE, resolved);
    if (rel.startsWith('..')) continue; // points outside docs/ (e.g. repo source) — not a bundle link
    let ok = fs.existsSync(resolved);
    if (!ok && target.endsWith('/')) ok = fs.existsSync(path.join(resolved, 'index.md')) || fs.existsSync(resolved);
    if (!ok && fs.existsSync(resolved + '.md')) ok = true;
    if (!ok) warn(file, `broken internal link -> ${m[1].trim()}`);
  }
}

function lintFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const base = path.basename(file);
  const norm = file.split(path.sep).join('/');
  const isRoot = norm === rootIndex.split(path.sep).join('/');

  if (base === 'index.md') {
    const fmStart = content.startsWith('---');
    if (isRoot) {
      if (fmStart) {
        const fm = parseFrontmatter(content, file);
        if (fm.present && !('okf_version' in fm.data)) warn(file, 'root index.md frontmatter should declare okf_version');
      }
    } else if (fmStart) {
      err(file, 'index.md must not contain frontmatter (only the bundle-root index.md may, for okf_version)');
    }
    checkLinks(file, content);
    return;
  }
  if (base === 'log.md') {
    if (content.startsWith('---')) err(file, 'log.md must not contain frontmatter');
    for (const line of content.split('\n')) {
      const h = line.match(/^##\s+(.*)$/);
      if (h && !/^\d{4}-\d{2}-\d{2}/.test(h[1].trim())) warn(file, `log.md date heading should be ISO YYYY-MM-DD: "${h[1].trim()}"`);
    }
    checkLinks(file, content);
    return;
  }

  // Concept document.
  const fm = parseFrontmatter(content, file);
  if (!fm.present) { err(file, 'concept document is missing YAML frontmatter'); return; }
  if (!fm.ok) return;
  const type = fm.data.type;
  if (!type || (typeof type === 'string' && !type.trim())) err(file, "frontmatter is missing the required non-empty `type` field");
  for (const k of RECOMMENDED) if (!(k in fm.data)) warn(file, `missing recommended field \`${k}\``);
  if (fm.data.timestamp && !ISO.test(String(fm.data.timestamp))) warn(file, `timestamp is not ISO 8601: ${fm.data.timestamp}`);
  if ('tags' in fm.data && !Array.isArray(fm.data.tags)) warn(file, 'tags should be a YAML list');
  checkLinks(file, content);
}

// Resolve targets.
let files = [];
if (targets.length === 0) {
  files = listMarkdown(BUNDLE);
} else {
  for (const t of targets) {
    if (!fs.existsSync(t)) continue;
    files.push(...listMarkdown(t));
  }
  // only lint files inside the bundle
  files = files.filter((f) => !path.relative(BUNDLE, f).startsWith('..'));
}

for (const f of [...new Set(files)]) lintFile(f);

// Report.
if (warns.length) {
  console.log(`\n⚠  ${warns.length} warning(s):`);
  for (const w of warns) console.log('   ' + w);
}
if (errors.length) {
  console.log(`\n✖  ${errors.length} error(s):`);
  for (const e of errors) console.log('   ' + e);
}
const okCount = files.length;
if (!errors.length && !warns.length) console.log(`✓ OKF lint clean — ${okCount} file(s) checked.`);
else console.log(`\nOKF lint: ${okCount} file(s), ${errors.length} error(s), ${warns.length} warning(s).`);

const failed = errors.length > 0 || (strict && warns.length > 0);
process.exit(failed ? 1 : 0);
