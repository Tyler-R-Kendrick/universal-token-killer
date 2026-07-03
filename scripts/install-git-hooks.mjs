#!/usr/bin/env node
// Point git at the repo's version-controlled hooks (.githooks/) so the OKF
// pre-commit check runs locally. Invoked from the `prepare` npm lifecycle.
// Silent no-op outside a git checkout (e.g. when installed as a dependency).
import { execSync } from 'node:child_process';
import fs from 'node:fs';

try {
  if (!fs.existsSync('.git') || !fs.existsSync('.githooks')) process.exit(0);
  execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
  console.log('Configured git core.hooksPath -> .githooks (OKF pre-commit enabled).');
} catch {
  // Never fail install because hook wiring didn't take.
  process.exit(0);
}
