#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  compressPromptForLlm,
  formatLintReport,
  installPack,
  lintPack,
  listInstalledPacks,
  parsePackSource,
  uninstallPack
} from '@utk/core';

export type CliWriter = (message: string) => void;

export type CliHandlerContext = {
  cwd: string;
  stdout: CliWriter;
  stderr: CliWriter;
  stdin?: () => Promise<string>;
};

export type CliResult = { exitCode: number };

export async function runUtkCli(argv: string[], context: CliHandlerContext): Promise<CliResult> {
  try {
    return await dispatch(argv, context);
  } catch (error) {
    context.stderr(`${(error as Error).message}\n`);
    return { exitCode: 1 };
  }
}

async function dispatch(argv: string[], context: CliHandlerContext): Promise<CliResult> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printUsage(context.stdout);
    return { exitCode: 0 };
  }
  const [command, subcommand, ...rest] = argv;
  if (command === 'detoks-prompt') {
    return await handleDetoksPrompt([subcommand, ...rest].filter((arg): arg is string => arg !== undefined), context);
  }
  if (command !== 'pack') {
    context.stderr(`Unknown command: ${command}\n`);
    printUsage(context.stderr);
    return { exitCode: 1 };
  }
  switch (subcommand) {
    case 'add':
      return await handleAdd(rest, context);
    case 'remove':
    case 'rm':
      return await handleRemove(rest, context);
    case 'list':
    case 'ls':
      return await handleList(context);
    case 'lint':
    case 'validate':
      return await handleLint(rest, context);
    default:
      context.stderr(`Unknown pack subcommand: ${subcommand ?? '(none)'}\n`);
      printUsage(context.stderr);
      return { exitCode: 1 };
  }
}

async function handleAdd(args: string[], context: CliHandlerContext): Promise<CliResult> {
  let force = false;
  let sourceSpec: string | undefined;
  for (const arg of args) {
    if (arg === '--force' || arg === '-f') {
      force = true;
      continue;
    }
    if (sourceSpec === undefined) {
      sourceSpec = arg;
      continue;
    }
    context.stderr(`Unexpected argument: ${arg}\n`);
    return { exitCode: 1 };
  }
  if (!sourceSpec) {
    context.stderr('Usage: utk pack add <source> [--force]\n');
    return { exitCode: 1 };
  }
  const source = parsePackSource(sourceSpec);
  const installed = await installPack(context.cwd, source, { force });
  context.stdout(`Installed ${installed.name}@${installed.version}\n`);
  if (installed.tools.length > 0) {
    context.stdout(`  tools: ${installed.tools.join(', ')}\n`);
  }
  if (installed.templates.length > 0) {
    context.stdout(`  templates: ${installed.templates.join(', ')}\n`);
  }
  if (installed.grammars.length > 0) {
    context.stdout(`  grammars: ${installed.grammars.map((g) => `${g.tool}/${g.field}`).join(', ')}\n`);
  }
  return { exitCode: 0 };
}

async function handleDetoksPrompt(args: string[], context: CliHandlerContext): Promise<CliResult> {
  let prompt: string | undefined;
  let file: string | undefined;
  let model: string | undefined;
  let rate: number | undefined;
  let targetToken: number | undefined;
  let readFromStdin = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--prompt':
      case '-p':
        prompt = args[++index];
        break;
      case '--file':
      case '-f':
        file = args[++index];
        break;
      case '--stdin':
        readFromStdin = true;
        break;
      case '--model':
      case '-m':
        model = args[++index];
        break;
      case '--rate':
      case '-r':
        rate = readNumberArg(args[++index], '--rate');
        break;
      case '--target-token':
        targetToken = readNumberArg(args[++index], '--target-token');
        break;
      default:
        if (file === undefined && arg && !arg.startsWith('-')) {
          file = arg;
          break;
        }
        context.stderr(`Unexpected argument: ${arg}\n`);
        return { exitCode: 1 };
    }
  }

  if (prompt === undefined && file !== undefined) {
    prompt = await readFile(path.resolve(context.cwd, file), 'utf8');
  }
  if (prompt === undefined && (readFromStdin || file === undefined)) {
    prompt = await (context.stdin?.() ?? Promise.resolve(''));
  }
  if (prompt === undefined) {
    context.stderr(detoksPromptUsage());
    return { exitCode: 1 };
  }
  if (prompt.trim().length === 0) {
    context.stderr(detoksPromptUsage());
    return { exitCode: 1 };
  }

  const result = await compressPromptForLlm(prompt, {
    workspaceRoot: context.cwd,
    ...(model ? { model } : {}),
    ...(rate !== undefined ? { rate } : {}),
    ...(targetToken !== undefined ? { targetToken } : {})
  });
  context.stdout(`${result.compressedPrompt}\n`);
  return { exitCode: result.error ? 1 : 0 };
}

async function handleRemove(args: string[], context: CliHandlerContext): Promise<CliResult> {
  const name = args[0];
  if (!name || args.length !== 1) {
    context.stderr('Usage: utk pack remove <name>\n');
    return { exitCode: 1 };
  }
  await uninstallPack(context.cwd, name);
  context.stdout(`Removed ${name}\n`);
  return { exitCode: 0 };
}

async function handleList(context: CliHandlerContext): Promise<CliResult> {
  const installed = await listInstalledPacks(context.cwd);
  if (installed.length === 0) {
    context.stdout('No packs installed\n');
    return { exitCode: 0 };
  }
  for (const pack of installed) {
    context.stdout(`${pack.name}@${pack.version}  (${pack.source})\n`);
  }
  return { exitCode: 0 };
}

async function handleLint(args: string[], context: CliHandlerContext): Promise<CliResult> {
  let strict = false;
  let target: string | undefined;
  for (const arg of args) {
    if (arg === '--strict') {
      strict = true;
      continue;
    }
    if (target === undefined) {
      target = arg;
      continue;
    }
    context.stderr(`Unexpected argument: ${arg}\n`);
    return { exitCode: 1 };
  }
  const resolved = target ?? context.cwd;
  const report = await lintPack(resolved);
  context.stdout(formatLintReport(report, resolved));
  if (report.errorCount > 0) return { exitCode: 1 };
  if (strict && report.warningCount > 0) return { exitCode: 1 };
  return { exitCode: 0 };
}

function printUsage(write: CliWriter): void {
  write('Usage: utk <command> <subcommand> [options]\n');
  write('\n');
  write('Commands:\n');
  write('  detoks-prompt [--prompt <text> | --file <path> | --stdin] Compress prompt prose while preserving code and quoted spans\n');
  write('  pack add <source> [--force]   Install a pack (local dir, tarball, git URL, npm spec)\n');
  write('  pack remove <name>            Uninstall a pack by name\n');
  write('  pack list                     List installed packs\n');
  write('  pack lint [<path>] [--strict] Lint a pack at <path> (default: cwd). --strict treats warnings as errors\n');
  write('  pack validate [<path>]        Alias for `pack lint`\n');
}

function readNumberArg(value: string | undefined, name: string): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) throw new Error(`${name} must be a number`);
  return numberValue;
}

function detoksPromptUsage(): string {
  return 'Usage: utk detoks-prompt [--prompt <text> | --file <path> | --stdin] [--model <provider/model>] [--rate <0..1>]\n';
}

async function readProcessStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/* v8 ignore start -- direct CLI entrypoint exercised only when invoked as a binary */
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  runUtkCli(process.argv.slice(2), {
    cwd: process.cwd(),
    stdout: (message) => process.stdout.write(message),
    stderr: (message) => process.stderr.write(message),
    stdin: readProcessStdin
  })
    .then((result) => {
      process.exit(result.exitCode);
    })
    .catch((error) => {
      process.stderr.write(`${(error as Error).message}\n`);
      process.exit(1);
    });
}
/* v8 ignore stop */
