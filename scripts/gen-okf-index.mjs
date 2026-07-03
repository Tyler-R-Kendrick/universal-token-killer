#!/usr/bin/env node
// Regenerate OKF reserved index.md progressive-disclosure listings for the
// docs/ bundle from the filesystem + each concept's frontmatter.
// Does NOT touch log.md (append-only history) or concept bodies.
//
// Usage: node scripts/gen-okf-index.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'docs';
const RESERVED = new Set(['index.md', 'log.md']);

const NAME_OVERRIDES = {
  'getting-started': 'Getting Started', 'model-routing': 'Model Routing',
  'prompt-compression': 'Prompt Compression', 'tool-output-mediation': 'Tool-Output Mediation',
  'code-authoring-minification': 'Code-Authoring Minification', 'context-gateway-proxy': 'Context-Gateway Proxy',
  'assistant-prose-compression': 'Assistant-Prose Compression', 'hard-token-pruning': 'Hard Token Pruning',
  'soft-token-compression': 'Soft-Token Compression', 'rag-and-generative': 'RAG & Generative',
  'pre-call-routing': 'Pre-Call Routing', 'cascade-routing': 'Cascade Routing',
  'selective-ensembling': 'Selective Ensembling', 'full-ensembling': 'Full Ensembling',
  'batch-aware-routing': 'Batch-Aware Routing', 'decode-time-routing': 'Decode-Time Routing',
  'routing-research': 'Routing Research', 'compound-and-productized-routers': 'Compound & Productized Routers',
  'model-proxy': 'Model Proxy', 'copilot-hook': 'Copilot Hook', 'detok': 'Detok',
  'evals': 'Evals', 'skills': 'Skills', 'serialization': 'Serialization', 'architecture': 'Architecture',
  'references': 'References', 'features': 'Features', 'competition': 'Competition',
  'research': 'Research', 'techniques': 'Techniques', 'products': 'Products',
  'lean-ctx': 'lean-ctx', 'opencode-dcp': 'OpenCode DCP', 'token-company': 'Token Company',
  'kompress-base': 'Kompress-Base', 'openslimedit': 'OpenSlimEdit', 'notdiamond': 'NotDiamond',
  'openrouter': 'OpenRouter', 'tokensugar': 'TokenSugar', 'cavegemma': 'CaveGemma',
  'caveman-code': 'Caveman Code', 'pareto-code-router': 'Pareto Code Router', 'auto-router': 'Auto Router',
  'sakana': 'Sakana', 'fugu': 'Fugu', 'anka': 'Anka', 'cavemem': 'Cavemem', 'cavekit': 'Cavekit',
  'caveman': 'Caveman', 'compresr': 'Compresr', 'headroom': 'Headroom', 'ponytail': 'Ponytail',
  'serena': 'Serena', 'fusion': 'Fusion', 'cavewoman': 'CAVEWOMAN', 'sketch-of-thought': 'Sketch-of-Thought',
};

const niceName = (slug) => NAME_OVERRIDES[slug] ||
  slug.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

function readFrontmatter(file) {
  const b = fs.readFileSync(file, 'utf8');
  if (!b.startsWith('---\n')) return {};
  const end = b.indexOf('\n---', 4);
  if (end < 0) return {};
  const fm = {};
  for (const line of b.slice(4, end).split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return fm;
}

const bundleAbs = (p) => '/' + path.relative(ROOT, p).split(path.sep).join('/');

function scan(dir) {
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  const subdirs = ents.filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name)).sort();
  const files = ents.filter((e) => e.isFile() && e.name.endsWith('.md') && !RESERVED.has(e.name))
    .map((e) => path.join(dir, e.name)).sort();
  return { subdirs, files };
}

function shouldIndex(dir) {
  if (dir === ROOT) return true;
  const { subdirs, files } = scan(dir);
  return subdirs.length > 0 || files.length >= 2;
}

function hasConcepts(dir) {
  const { subdirs, files } = scan(dir);
  return files.length > 0 || subdirs.some(hasConcepts);
}

function dirEntry(child) {
  const { subdirs, files } = scan(child);
  if (!shouldIndex(child) && files.length === 1 && subdirs.length === 0) {
    const fm = readFrontmatter(files[0]);
    return { url: bundleAbs(files[0]), title: niceName(path.basename(child)), desc: fm.description || '' };
  }
  const candidates = [path.join(child, 'overview.md'), path.join(child, 'research.md'), ...files];
  let desc = '';
  for (const c of candidates) { if (fs.existsSync(c)) { desc = readFrontmatter(c).description || ''; if (desc) break; } }
  return { url: bundleAbs(child) + '/', title: niceName(path.basename(child)), desc };
}

function fileEntry(file) {
  const fm = readFrontmatter(file);
  return { url: bundleAbs(file), title: fm.title || niceName(path.basename(file, '.md')), desc: fm.description || '' };
}

const bullet = (e) => `* [${e.title}](${e.url})${e.desc ? ' - ' + e.desc : ''}`;

let created = 0;
function generate(dir) {
  const { subdirs, files } = scan(dir);
  for (const s of subdirs) generate(s);
  if (!shouldIndex(dir)) return;

  const isRoot = dir === ROOT;
  const lines = [];
  if (isRoot) {
    lines.push('---', 'okf_version: "0.1"', 'title: UTK Knowledge Bundle',
      'description: Open Knowledge Format bundle for the Universal Token Killer project — features, competition, research, techniques, and gap analysis.',
      '---', '');
    lines.push('# UTK Knowledge Bundle', '',
      'An [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md) (OKF v0.1) bundle. Each concept is a Markdown file with YAML frontmatter; directories carry an `index.md` for progressive disclosure and a `log.md` for change history. See [authoring-okf.md](/authoring-okf.md) to add or edit docs.', '');
  } else {
    lines.push(`# ${niceName(path.basename(dir))}`, '');
    const overview = path.join(dir, 'overview.md');
    if (fs.existsSync(overview)) {
      const d = readFrontmatter(overview).description || '';
      if (d) lines.push(d, '');
    }
  }

  const dirEntries = subdirs.filter(hasConcepts).map((s) => dirEntry(s));
  if (dirEntries.length) {
    lines.push(isRoot ? '## Areas' : '## Subcategories', '');
    for (const e of dirEntries) lines.push(bullet(e));
    lines.push('');
  }

  const ordered = files.slice().sort((a, b) => {
    const ao = path.basename(a) === 'overview.md' ? 0 : 1;
    const bo = path.basename(b) === 'overview.md' ? 0 : 1;
    return ao - bo || a.localeCompare(b);
  });
  if (ordered.length) {
    lines.push('## Documents', '');
    for (const f of ordered) lines.push(bullet(fileEntry(f)));
    lines.push('');
  }

  fs.writeFileSync(path.join(dir, 'index.md'), lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
  created++;
}

generate(ROOT);
console.log(`Generated ${created} index.md file(s).`);
