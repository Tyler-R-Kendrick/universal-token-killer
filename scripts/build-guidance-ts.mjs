import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const packageRoot = join(process.cwd(), 'node_modules', 'guidance-ts');
const distEntry = join(packageRoot, 'dist', 'index.js');

if (existsSync(distEntry)) {
  process.exit(0);
}

if (!existsSync(packageRoot)) {
  process.exit(0);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const install = spawnSync(npmCommand, ['install', '--ignore-scripts'], {
  cwd: packageRoot,
  stdio: 'inherit'
});

if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

const build = spawnSync(npmCommand, ['run', 'build'], {
  cwd: packageRoot,
  stdio: 'inherit'
});

process.exit(build.status ?? 1);
