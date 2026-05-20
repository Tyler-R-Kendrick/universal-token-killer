#!/usr/bin/env node
import {
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
  write('  pack add <source> [--force]   Install a pack (local dir, tarball, git URL, npm spec)\n');
  write('  pack remove <name>            Uninstall a pack by name\n');
  write('  pack list                     List installed packs\n');
  write('  pack lint [<path>] [--strict] Lint a pack at <path> (default: cwd). --strict treats warnings as errors\n');
  write('  pack validate [<path>]        Alias for `pack lint`\n');
}

/* v8 ignore start -- direct CLI entrypoint exercised only when invoked as a binary */
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  runUtkCli(process.argv.slice(2), {
    cwd: process.cwd(),
    stdout: (message) => process.stdout.write(message),
    stderr: (message) => process.stderr.write(message)
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
