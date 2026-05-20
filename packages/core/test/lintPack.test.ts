import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatLintReport, lintPack } from '../src/pack/lintPack.js';

async function buildPack(dir: string, files: Record<string, string>): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(dir, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
}

function manifest(extra: Record<string, string> = {}): string {
  const base: Record<string, string> = {
    name: '"git-cli"',
    version: '"1.2.0"',
    description: '"d"',
    license: '"MIT"',
    homepage: '"h"',
    authors: '["alice"]',
    keywords: '["git"]',
    ...extra
  };
  const lines = ['[pack]'];
  for (const [key, value] of Object.entries(base)) {
    if (value !== '__OMIT__') lines.push(`${key} = ${value}`);
  }
  lines.push('', '[compatibility]', 'utk = ">=0.1.0"', 'pack_spec = "1"', '');
  return lines.join('\n');
}

describe('lintPack', () => {
  it('reports a clean pack with no findings', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-clean-'));
    await buildPack(dir, {
      'utk.pack.toml': [
        manifest(),
        '[[tools]]',
        'id = "git"',
        'kind = "bash-like"',
        '',
        '[[grammars]]',
        'tool = "git"',
        'field = "ref"',
        ''
      ].join('\n'),
      'tools/git.toml': [
        '[tool]',
        'id = "git"',
        'command = "git"',
        '',
        '[[parameters]]',
        'name = "subcommand"',
        'kind = "positional"',
        'completions = ["status"]',
        ''
      ].join('\n'),
      'grammars/git/ref.lark': 'start: REF\nREF: /[A-Za-z]+/\n'
    });
    const report = await lintPack(dir);
    expect(report.ok).toBe(true);
    expect(report.findings).toEqual([]);
  });

  it('reports missing manifest', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-no-manifest-'));
    const report = await lintPack(dir);
    expect(report.findings[0]?.code).toBe('pack/manifest/missing');
    expect(report.ok).toBe(false);
  });

  it('reports manifest parse error and schema error separately', async () => {
    const parseDir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-bad-toml-'));
    await buildPack(parseDir, { 'utk.pack.toml': 'not valid = = toml' });
    const parseReport = await lintPack(parseDir);
    expect(parseReport.findings[0]?.code).toBe('pack/manifest/parse');

    const schemaDir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-schema-'));
    await buildPack(schemaDir, { 'utk.pack.toml': '[pack]\nname = "ok!!"\nversion = "1.0.0"\n' });
    const schemaReport = await lintPack(schemaDir);
    expect(schemaReport.findings[0]?.code).toBe('pack/manifest/schema');
  });

  it('warns when recommended manifest fields are missing', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-recommended-'));
    await buildPack(dir, { 'utk.pack.toml': '[pack]\nname = "ok"\nversion = "1.0.0"\n' });
    const report = await lintPack(dir);
    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain('pack/manifest/missing-description');
    expect(codes).toContain('pack/manifest/missing-license');
    expect(codes).toContain('pack/manifest/missing-homepage');
    expect(codes).toContain('pack/manifest/missing-utk-compat');
  });

  it('can suppress recommended-field warnings', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-no-recommended-'));
    await buildPack(dir, { 'utk.pack.toml': '[pack]\nname = "ok"\nversion = "1.0.0"\n' });
    const report = await lintPack(dir, { recommendedFields: false });
    expect(report.findings.map((finding) => finding.code)).not.toContain('pack/manifest/missing-license');
  });

  it('detects duplicate tool ids, missing files, and id mismatches', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-tools-'));
    await buildPack(dir, {
      'utk.pack.toml': [
        manifest(),
        '[[tools]]',
        'id = "git"',
        'kind = "bash-like"',
        '',
        '[[tools]]',
        'id = "git"',
        'kind = "bash-like"',
        '',
        '[[tools]]',
        'id = "missing"',
        'kind = "bash-like"',
        '',
        '[[tools]]',
        'id = "renamed"',
        'kind = "bash-like"',
        'file = "tools/renamed.toml"'
      ].join('\n'),
      'tools/git.toml': '[tool]\nid = "git"\ncommand = "git"\n',
      'tools/renamed.toml': '[tool]\nid = "other"\ncommand = "x"\n'
    });
    const report = await lintPack(dir);
    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain('pack/tools/duplicate-id');
    expect(codes).toContain('pack/tools/file-missing');
    expect(codes).toContain('pack/tools/id-mismatch');
  });

  it('flags bash-like tools missing a command and tools with empty parameters', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-bash-'));
    await buildPack(dir, {
      'utk.pack.toml': [
        manifest(),
        '[[tools]]',
        'id = "git"',
        'kind = "bash-like"',
        ''
      ].join('\n'),
      'tools/git.toml': '[tool]\nid = "git"\n'
    });
    const report = await lintPack(dir);
    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain('pack/tools/bash-missing-command');
    expect(codes).toContain('pack/tools/empty-parameters');
  });

  it('tolerates tool files without [tool] table or with a non-string id', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-tool-shape-'));
    await buildPack(dir, {
      'utk.pack.toml': [
        manifest(),
        '[[tools]]',
        'id = "structured.search"',
        'kind = "structured"',
        'file = "tools/search.toml"',
        '',
        '[[tools]]',
        'id = "headerless"',
        'kind = "bash-like"',
        'file = "tools/headerless.toml"',
        ''
      ].join('\n'),
      'tools/search.toml': '[tool]\nid = "structured.search"\n[[parameters]]\nname = "q"\n',
      'tools/headerless.toml': '[[parameters]]\nname = "x"\n'
    });
    const report = await lintPack(dir);
    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain('pack/tools/bash-missing-command');
  });

  it('lints grammars that ship only a seed observation', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-seed-only-'));
    await buildPack(dir, {
      'utk.pack.toml': [
        manifest(),
        '[[grammars]]',
        'tool = "git"',
        'field = "ref"',
        ''
      ].join('\n'),
      'grammars/git/ref.grammar.json': JSON.stringify({
        version: 1,
        observations: 5,
        separators: { '-': { tight: 5, loose: 0 } },
        lengthRange: { min: 3, max: 12 }
      })
    });
    const report = await lintPack(dir);
    expect(report.ok).toBe(true);
  });

  it('reports tool parse errors', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-tool-parse-'));
    await buildPack(dir, {
      'utk.pack.toml': [manifest(), '[[tools]]\nid = "git"\nkind = "bash-like"\nfile = "tools/git.json"\n'].join('\n'),
      'tools/git.json': '{ not json'
    });
    const report = await lintPack(dir);
    expect(report.findings[0]?.code).toBe('pack/tools/parse');
  });

  it('detects duplicate grammar pairs and missing files', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-grammar-'));
    await buildPack(dir, {
      'utk.pack.toml': [
        manifest(),
        '[[grammars]]',
        'tool = "git"',
        'field = "ref"',
        '',
        '[[grammars]]',
        'tool = "git"',
        'field = "ref"',
        '',
        '[[grammars]]',
        'tool = "git"',
        'field = "missing"',
        ''
      ].join('\n'),
      'grammars/git/ref.lark': 'start: REF\nREF: /[A-Za-z]+/\n'
    });
    const report = await lintPack(dir);
    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain('pack/grammars/duplicate');
    expect(codes).toContain('pack/grammars/missing-files');
  });

  it('flags Lark grammars missing a start rule and seeds that are invalid', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-grammar-shape-'));
    await buildPack(dir, {
      'utk.pack.toml': [
        manifest(),
        '[[grammars]]',
        'tool = "git"',
        'field = "ref"',
        '',
        '[[grammars]]',
        'tool = "git"',
        'field = "remote"',
        ''
      ].join('\n'),
      'grammars/git/ref.lark': '# no start rule here\nFOO: /a/\n',
      'grammars/git/ref.grammar.json': '{ "garbage": true }',
      'grammars/git/remote.lark': 'start: R\nR: /b/\n',
      'grammars/git/remote.grammar.json': '{ not json'
    });
    const report = await lintPack(dir);
    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain('pack/grammars/missing-start-rule');
    expect(codes).toContain('pack/grammars/invalid-seed');
    expect(codes.filter((code) => code === 'pack/grammars/invalid-seed').length).toBeGreaterThanOrEqual(2);
  });

  it('accepts explicit lark and seed paths', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-grammar-explicit-'));
    await buildPack(dir, {
      'utk.pack.toml': [
        manifest(),
        '[[grammars]]',
        'tool = "git"',
        'field = "ref"',
        'lark = "explicit.lark"',
        'seed = "explicit.grammar.json"',
        ''
      ].join('\n'),
      'explicit.lark': 'start: R\nR: /b/\n',
      'explicit.grammar.json': JSON.stringify({
        version: 1,
        observations: 1,
        separators: {},
        lengthRange: { min: 1, max: 1 }
      })
    });
    const report = await lintPack(dir);
    expect(report.ok).toBe(true);
  });

  it('detects template file-missing, duplicate id, language mismatch, and empty file', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-templates-'));
    await buildPack(dir, {
      'utk.pack.toml': [
        manifest(),
        '[[templates]]',
        'id = "missing.template"',
        'file = "templates/missing.ts"',
        'language = "typescript"',
        '',
        '[[templates]]',
        'id = "dup"',
        'file = "templates/dup.ts"',
        'language = "typescript"',
        '',
        '[[templates]]',
        'id = "dup"',
        'file = "templates/dup.ts"',
        'language = "typescript"',
        '',
        '[[templates]]',
        'id = "lang.mismatch"',
        'file = "templates/wrong.py"',
        'language = "typescript"',
        '',
        '[[templates]]',
        'id = "empty"',
        'file = "templates/empty.ts"',
        'language = "typescript"',
        ''
      ].join('\n'),
      'templates/dup.ts': 'export default defineTemplate({ id: "t", prompt: "p", slots: {} });',
      'templates/wrong.py': 'TEMPLATE = 1',
      'templates/empty.ts': ''
    });
    const report = await lintPack(dir);
    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain('pack/templates/file-missing');
    expect(codes).toContain('pack/templates/duplicate-id');
    expect(codes).toContain('pack/templates/language-mismatch');
    expect(codes).toContain('pack/templates/empty-file');
  });

  it('heuristically flags TS templates lacking export default or descriptor cues', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-heuristic-'));
    await buildPack(dir, {
      'utk.pack.toml': [
        manifest(),
        '[[templates]]',
        'id = "noexport"',
        'file = "templates/noexport.ts"',
        'language = "typescript"',
        '',
        '[[templates]]',
        'id = "shapeless"',
        'file = "templates/shapeless.ts"',
        'language = "typescript"',
        ''
      ].join('\n'),
      'templates/noexport.ts': 'const x = 1;\n',
      'templates/shapeless.ts': 'export default function noop() { return null; }\n'
    });
    const report = await lintPack(dir);
    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain('pack/templates/missing-default-export');
    expect(codes).toContain('pack/templates/heuristic-shape');
  });

  it('warns about Python templates lacking function/TEMPLATE markers', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-py-heuristic-'));
    await buildPack(dir, {
      'utk.pack.toml': [
        manifest(),
        '[[templates]]',
        'id = "py.shapeless"',
        'file = "templates/x.py"',
        'language = "python"',
        '',
        '[[templates]]',
        'id = "py.ok"',
        'file = "templates/ok.py"',
        'language = "python"',
        ''
      ].join('\n'),
      'templates/x.py': '# just a comment\n',
      'templates/ok.py': 'def render():\n    return 1\n'
    });
    const report = await lintPack(dir);
    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain('pack/templates/heuristic-python');
    expect(codes.filter((code) => code === 'pack/templates/heuristic-python').length).toBe(1);
  });

  it('dynamic-imports executable JS templates and reports import or shape errors', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-import-'));
    await buildPack(dir, {
      'utk.pack.toml': [
        manifest(),
        '[[templates]]',
        'id = "bad.import"',
        'file = "templates/bad.js"',
        'language = "typescript"',
        '',
        '[[templates]]',
        'id = "no.default"',
        'file = "templates/nodefault.js"',
        'language = "typescript"',
        '',
        '[[templates]]',
        'id = "wrong.shape"',
        'file = "templates/wrong.js"',
        'language = "typescript"',
        '',
        '[[templates]]',
        'id = "undefined.slot"',
        'file = "templates/undef.js"',
        'language = "typescript"',
        '',
        '[[templates]]',
        'id = "external.grammar"',
        'file = "templates/external.js"',
        'language = "typescript"',
        ''
      ].join('\n'),
      'templates/bad.js': 'throw new Error("nope");',
      'templates/nodefault.js': 'export const x = 1;',
      'templates/wrong.js': 'export default { id: 1, prompt: "x", slots: {} };',
      'templates/undef.js': "export default { id: 't', prompt: 'a {{missing}} b', slots: {} };",
      'templates/external.js': "export default { id: 't', prompt: 'x {{r}}', slots: { r: { grammar: { kind: 'pack', tool: 'unknown', field: 'ref' } } } };"
    });
    const { importTemplateForLint } = await import('../src/pack/lintPack.js');
    const report = await lintPack(dir, { importTemplate: importTemplateForLint });
    const codes = report.findings.map((finding) => finding.code);
    expect(codes).toContain('pack/templates/import-failed');
    expect(codes).toContain('pack/templates/missing-default-export');
    expect(codes).toContain('pack/templates/invalid-shape');
    expect(codes).toContain('pack/templates/undefined-slot');
    expect(codes).toContain('pack/templates/external-grammar');

    // Default lint must NOT execute pack code — RCE surface.
    const safeReport = await lintPack(dir);
    const safeCodes = safeReport.findings.map((finding) => finding.code);
    expect(safeCodes).not.toContain('pack/templates/import-failed');
    expect(safeCodes.filter((code) => code === 'pack/templates/runtime-validation-skipped').length).toBeGreaterThanOrEqual(5);
  });

  it('tolerates slots with invalid or non-pack grammar refs', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-weird-slots-'));
    await buildPack(dir, {
      'utk.pack.toml': [
        manifest(),
        '[[templates]]',
        'id = "weird"',
        'file = "templates/weird.js"',
        'language = "typescript"',
        ''
      ].join('\n'),
      'templates/weird.js': '// placeholder'
    });
    const report = await lintPack(dir, {
      importTemplate: async () => ({
        default: {
          id: 'weird',
          prompt: 'go',
          slots: {
            nullSlot: null,
            primitive: 'oops',
            noGrammar: { description: 'x' },
            inlineGrammar: { grammar: { kind: 'inline', lark: 'start: x' } },
            partial: { grammar: { kind: 'pack', tool: 'git' } }
          }
        }
      })
    });
    expect(report.findings.filter((finding) => finding.code === 'pack/templates/external-grammar')).toEqual([]);
  });

  it('accepts injected importTemplate for testability', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-injected-import-'));
    await buildPack(dir, {
      'utk.pack.toml': [
        manifest(),
        '[[grammars]]',
        'tool = "git"',
        'field = "ref"',
        '',
        '[[templates]]',
        'id = "ok"',
        'file = "templates/ok.js"',
        'language = "typescript"',
        ''
      ].join('\n'),
      'grammars/git/ref.lark': 'start: R\nR: /a/\n',
      'templates/ok.js': '// stub'
    });
    const report = await lintPack(dir, {
      importTemplate: async () => ({
        default: { id: 'ok', prompt: 'x {{r}}', slots: { r: { grammar: { kind: 'pack', tool: 'git', field: 'ref' } } } }
      })
    });
    expect(report.ok).toBe(true);
  });
});

describe('lintPack tracer wiring', () => {
  it('emits one trace span per finding into the injected tracer', async () => {
    const { createRunContext, loadUtkConfig } = await import('../src/index.js');
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-tracer-'));
    await import('node:fs/promises').then((fs) => fs.mkdir(path.join(workspace, '.utk'), { recursive: true }));
    await import('node:fs/promises').then((fs) =>
      fs.writeFile(
        path.join(workspace, '.utk', 'config.toml'),
        [
          '[serialization]',
          'default = "toon"',
          '',
          '[serialization.providers.toon]',
          'enabled = true',
          '',
          '[serialization.providers.compressed-json]',
          'enabled = true',
          '',
          '[tracing]',
          'enabled = true',
          ''
        ].join('\n'),
        'utf8'
      )
    );
    const config = await loadUtkConfig(workspace);
    const tracer = createRunContext(config, workspace, { runId: 'r-lint', now: () => new Date('2026-05-19T22:00:00Z') });

    const dir = await mkdtemp(path.join(os.tmpdir(), 'utk-lint-tracer-pack-'));
    await buildPack(dir, {
      'utk.pack.toml': '[pack]\nname = "ok"\nversion = "1.0.0"\n'
    });
    await lintPack(dir, { tracer });
    const codes = tracer.spans.flatMap((span) => span.tags.filter((tag) => tag.key === 'utk.failure.code').map((tag) => tag.value));
    expect(codes).toContain('pack/manifest/missing-description');
    expect(codes).toContain('pack/manifest/missing-license');
    expect(tracer.spans.length).toBeGreaterThan(0);
    // Each finding's log entry must remain well-formed even when file/hint are absent.
    const extras = tracer.spans
      .flatMap((span) => span.logs)
      .flatMap((log) => log.fields)
      .filter((field) => field.key === 'utk.failure.extra')
      .map((field) => JSON.parse(field.value as string) as Record<string, unknown>);
    expect(extras.every((extra) => 'severity' in extra && 'packDir' in extra)).toBe(true);
  });
});

describe('formatLintReport', () => {
  it('formats reports with and without findings', () => {
    const clean = formatLintReport({ ok: true, findings: [], errorCount: 0, warningCount: 0, infoCount: 0 }, 'pack');
    expect(clean).toContain('OK pack');
    const dirty = formatLintReport(
      {
        ok: false,
        findings: [
          { severity: 'error', code: 'c', message: 'msg' },
          { severity: 'warning', code: 'w', message: 'm2', file: 'f.toml', hint: 'check it' }
        ],
        errorCount: 1,
        warningCount: 1,
        infoCount: 0
      },
      'pack'
    );
    expect(dirty).toContain('[ERROR] c: msg');
    expect(dirty).toContain('(f.toml) — check it');
    expect(dirty).toContain('1 error(s)');
  });
});
