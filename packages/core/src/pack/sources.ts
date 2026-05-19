import type { PackSource } from './types.js';

export function parsePackSource(spec: string): PackSource {
  if (!spec || typeof spec !== 'string') {
    throw new Error('Pack source must be a non-empty string');
  }
  const trimmed = spec.trim();
  if (!trimmed) {
    throw new Error('Pack source must be a non-empty string');
  }

  if (trimmed.startsWith('github:')) {
    return parseShortGitSpec(trimmed.slice('github:'.length), 'https://github.com/');
  }
  if (trimmed.startsWith('gitlab:')) {
    return parseShortGitSpec(trimmed.slice('gitlab:'.length), 'https://gitlab.com/');
  }
  if (trimmed.startsWith('git+')) {
    return parseGitUrl(trimmed.slice('git+'.length));
  }
  if (trimmed.startsWith('git@')) {
    return parseGitUrl(trimmed);
  }
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    if (trimmed.endsWith('.tgz') || trimmed.endsWith('.tar.gz')) {
      return { type: 'tarball', path: trimmed };
    }
    return parseGitUrl(trimmed);
  }

  if (trimmed.startsWith('./') || trimmed.startsWith('../') || trimmed.startsWith('/')) {
    if (trimmed.endsWith('.tgz') || trimmed.endsWith('.tar.gz')) {
      return { type: 'tarball', path: trimmed };
    }
    return { type: 'local', path: trimmed };
  }

  if (trimmed.endsWith('.tgz') || trimmed.endsWith('.tar.gz')) {
    return { type: 'tarball', path: trimmed };
  }

  if (trimmed.startsWith('@') || /^[a-z0-9][\w.-]*(@[^@]+)?$/i.test(trimmed)) {
    return { type: 'npm', spec: trimmed };
  }

  throw new Error(`Unrecognized pack source: ${spec}`);
}

function parseShortGitSpec(rest: string, base: string): PackSource {
  const [repo, ref] = rest.split('#');
  if (!repo) throw new Error('Empty git repository in short spec');
  return ref ? { type: 'git', url: `${base}${repo}`, ref } : { type: 'git', url: `${base}${repo}` };
}

function parseGitUrl(url: string): PackSource {
  const hashIndex = url.indexOf('#');
  if (hashIndex >= 0) {
    return { type: 'git', url: url.slice(0, hashIndex), ref: url.slice(hashIndex + 1) };
  }
  return { type: 'git', url };
}

export function describePackSource(source: PackSource): string {
  switch (source.type) {
    case 'local':
      return `local:${source.path}`;
    case 'tarball':
      return `tarball:${source.path}`;
    case 'git':
      return source.ref ? `git:${source.url}#${source.ref}` : `git:${source.url}`;
    case 'npm':
      return `npm:${source.spec}`;
  }
}
