import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runUtkCli } from '../src/utk.js';

function captureWriters() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout: (message: string) => stdout.push(message),
    stderr: (message: string) => stderr.push(message),
    getStdout: () => stdout.join(''),
    getStderr: () => stderr.join('')
  };
}

async function writeFixturePack(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, 'utk.pack.toml'),
    [
      '[pack]',
      'name = "git-cli"',
      'version = "1.0.0"',
      '',
      '[[tools]]',
      'id = "git"',
      'kind = "bash-like"',
      '',
      '[[grammars]]',
      'tool = "git"',
      'field = "ref"',
      ''
    ].join('\n'),
    'utf8'
  );
  await mkdir(path.join(dir, 'tools'), { recursive: true });
  await writeFile(path.join(dir, 'tools', 'git.toml'), '[tool]\nid = "git"\ncommand = "git"\n', 'utf8');
  await mkdir(path.join(dir, 'grammars', 'git'), { recursive: true });
  await writeFile(path.join(dir, 'grammars', 'git', 'ref.lark'), 'start: REF\nREF: /[A-Za-z]+/\n', 'utf8');
}

describe('utk cli', () => {
  it('prints usage when invoked with no args or -h', async () => {
    const writers = captureWriters();
    const result = await runUtkCli([], { cwd: process.cwd(), stdout: writers.stdout, stderr: writers.stderr });
    expect(result.exitCode).toBe(0);
    expect(writers.getStdout()).toContain('Usage:');

    const helpWriters = captureWriters();
    const helpResult = await runUtkCli(['--help'], { cwd: process.cwd(), stdout: helpWriters.stdout, stderr: helpWriters.stderr });
    expect(helpResult.exitCode).toBe(0);
    expect(helpWriters.getStdout()).toContain('Usage:');

    const shortHelp = captureWriters();
    await runUtkCli(['-h'], { cwd: process.cwd(), stdout: shortHelp.stdout, stderr: shortHelp.stderr });
    expect(shortHelp.getStdout()).toContain('Usage:');
  });

  it('rejects unknown top-level commands', async () => {
    const writers = captureWriters();
    const result = await runUtkCli(['oops'], { cwd: process.cwd(), stdout: writers.stdout, stderr: writers.stderr });
    expect(result.exitCode).toBe(1);
    expect(writers.getStderr()).toContain('Unknown command');
  });

  it('rejects unknown pack subcommands', async () => {
    const writers = captureWriters();
    const result = await runUtkCli(['pack', 'frobnicate'], { cwd: process.cwd(), stdout: writers.stdout, stderr: writers.stderr });
    expect(result.exitCode).toBe(1);
    expect(writers.getStderr()).toContain('Unknown pack subcommand');

    const noSub = captureWriters();
    const noSubResult = await runUtkCli(['pack'], { cwd: process.cwd(), stdout: noSub.stdout, stderr: noSub.stderr });
    expect(noSubResult.exitCode).toBe(1);
    expect(noSub.getStderr()).toContain('Unknown pack subcommand');
  });

  it('add: installs from a local pack', async () => {
    const source = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-add-src-'));
    await writeFixturePack(source);
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-add-ws-'));
    const writers = captureWriters();
    const result = await runUtkCli(['pack', 'add', source], { cwd: workspace, stdout: writers.stdout, stderr: writers.stderr });
    expect(result.exitCode).toBe(0);
    expect(writers.getStdout()).toContain('Installed git-cli@1.0.0');
    expect(writers.getStdout()).toContain('tools: git');
    expect(writers.getStdout()).toContain('grammars: git/ref');
  });

  it('add: reports missing source argument', async () => {
    const writers = captureWriters();
    const result = await runUtkCli(['pack', 'add'], { cwd: process.cwd(), stdout: writers.stdout, stderr: writers.stderr });
    expect(result.exitCode).toBe(1);
    expect(writers.getStderr()).toContain('Usage: utk pack add');
  });

  it('add: rejects unexpected extra arguments', async () => {
    const writers = captureWriters();
    const result = await runUtkCli(['pack', 'add', './x', './y'], { cwd: process.cwd(), stdout: writers.stdout, stderr: writers.stderr });
    expect(result.exitCode).toBe(1);
    expect(writers.getStderr()).toContain('Unexpected argument');
  });

  it('add: supports --force flag', async () => {
    const source = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-force-src-'));
    await writeFixturePack(source);
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-force-ws-'));
    await runUtkCli(['pack', 'add', source], { cwd: workspace, stdout: () => {}, stderr: () => {} });
    const writers = captureWriters();
    const result = await runUtkCli(['pack', 'add', source, '--force'], { cwd: workspace, stdout: writers.stdout, stderr: writers.stderr });
    expect(result.exitCode).toBe(0);
    expect(writers.getStdout()).toContain('Installed');
  });

  it('add: reports template ids when present', async () => {
    const source = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-tpl-src-'));
    await mkdir(source, { recursive: true });
    await writeFile(
      path.join(source, 'utk.pack.toml'),
      [
        '[pack]',
        'name = "tpl"',
        'version = "1.0.0"',
        '',
        '[[templates]]',
        'id = "git.checkout"',
        'file = "templates/x.ts"',
        'language = "typescript"',
        ''
      ].join('\n'),
      'utf8'
    );
    await mkdir(path.join(source, 'templates'), { recursive: true });
    await writeFile(path.join(source, 'templates', 'x.ts'), 'export default {};\n', 'utf8');
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-tpl-ws-'));
    const writers = captureWriters();
    await runUtkCli(['pack', 'add', source], { cwd: workspace, stdout: writers.stdout, stderr: writers.stderr });
    expect(writers.getStdout()).toContain('templates: git.checkout');
  });

  it('list: prints message when no packs installed and otherwise lists installed packs', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-list-empty-ws-'));
    const empty = captureWriters();
    await runUtkCli(['pack', 'list'], { cwd: workspace, stdout: empty.stdout, stderr: empty.stderr });
    expect(empty.getStdout()).toContain('No packs installed');

    const source = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-list-src-'));
    await writeFixturePack(source);
    await runUtkCli(['pack', 'add', source], { cwd: workspace, stdout: () => {}, stderr: () => {} });
    const filled = captureWriters();
    await runUtkCli(['pack', 'ls'], { cwd: workspace, stdout: filled.stdout, stderr: filled.stderr });
    expect(filled.getStdout()).toContain('git-cli@1.0.0');
    expect(filled.getStdout()).toContain('local:');
  });

  it('remove: removes an installed pack and rejects missing name', async () => {
    const source = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-rm-src-'));
    await writeFixturePack(source);
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-rm-ws-'));
    await runUtkCli(['pack', 'add', source], { cwd: workspace, stdout: () => {}, stderr: () => {} });

    const writers = captureWriters();
    const result = await runUtkCli(['pack', 'rm', 'git-cli'], { cwd: workspace, stdout: writers.stdout, stderr: writers.stderr });
    expect(result.exitCode).toBe(0);
    expect(writers.getStdout()).toContain('Removed git-cli');

    const missing = captureWriters();
    const missingResult = await runUtkCli(['pack', 'remove'], { cwd: workspace, stdout: missing.stdout, stderr: missing.stderr });
    expect(missingResult.exitCode).toBe(1);
    expect(missing.getStderr()).toContain('Usage');
  });

  it('lint: prints findings and exits 0 when no errors', async () => {
    const source = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-lint-'));
    await writeFixturePack(source);
    const writers = captureWriters();
    const result = await runUtkCli(['pack', 'lint', source], { cwd: process.cwd(), stdout: writers.stdout, stderr: writers.stderr });
    expect(result.exitCode).toBe(0);
    expect(writers.getStdout()).toContain('0 error');
  });

  it('lint: defaults to current working directory', async () => {
    const source = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-lint-cwd-'));
    await writeFixturePack(source);
    const writers = captureWriters();
    const result = await runUtkCli(['pack', 'validate'], { cwd: source, stdout: writers.stdout, stderr: writers.stderr });
    expect(result.exitCode).toBe(0);
    expect(writers.getStdout()).toContain('0 error');
  });

  it('lint: exits 1 when errors are present', async () => {
    const source = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-lint-bad-'));
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, 'utk.pack.toml'), '[pack]\nname = "broken!!!"\nversion = "1.0.0"\n', 'utf8');
    const writers = captureWriters();
    const result = await runUtkCli(['pack', 'lint', source], { cwd: process.cwd(), stdout: writers.stdout, stderr: writers.stderr });
    expect(result.exitCode).toBe(1);
    expect(writers.getStdout()).toContain('pack/manifest/schema');
  });

  it('lint: --strict promotes warnings to failure', async () => {
    const source = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-lint-strict-'));
    await writeFixturePack(source);
    const writers = captureWriters();
    const result = await runUtkCli(['pack', 'lint', source, '--strict'], { cwd: process.cwd(), stdout: writers.stdout, stderr: writers.stderr });
    expect(result.exitCode).toBe(1);
  });

  it('lint: rejects unexpected arguments', async () => {
    const writers = captureWriters();
    const result = await runUtkCli(['pack', 'lint', './a', './b'], { cwd: process.cwd(), stdout: writers.stdout, stderr: writers.stderr });
    expect(result.exitCode).toBe(1);
    expect(writers.getStderr()).toContain('Unexpected argument');
  });

  it('add: refuses to install packs with lint errors', async () => {
    const source = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-bad-install-'));
    await mkdir(source, { recursive: true });
    await writeFile(
      path.join(source, 'utk.pack.toml'),
      [
        '[pack]',
        'name = "broken"',
        'version = "1.0.0"',
        '',
        '[[tools]]',
        'id = "git"',
        'kind = "bash-like"',
        ''
      ].join('\n'),
      'utf8'
    );
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'utk-cli-bad-install-ws-'));
    const writers = captureWriters();
    const result = await runUtkCli(['pack', 'add', source], { cwd: workspace, stdout: writers.stdout, stderr: writers.stderr });
    expect(result.exitCode).not.toBe(0);
  });
});
