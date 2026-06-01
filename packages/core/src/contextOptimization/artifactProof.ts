import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { contentHash } from '../artifact/canonical.js';
import { safeJoin } from '../security/pathSafety.js';
import { ensureInside, findArtifactRecord } from './artifactRecords.js';
import { expandArtifactReference } from './artifactExpansion.js';

export type ContextProof = {
  ok: boolean;
  artifactId: string;
  rawHash: string;
  compactHash: string;
  checks: Array<{ name: 'raw-artifact' | 'compact-artifact' | 'hash-match' | 'required-facts' | 'no-raw-leakage' | 'recovery'; passed: boolean; details?: string }>;
};

export async function createContextProof(params: {
  workspaceRoot: string;
  artifactId: string;
  compactText: string;
  requiredFacts?: string[];
}): Promise<ContextProof> {
  let raw = '';
  let rawArtifact = false;
  try {
    raw = (await expandArtifactReference(params.workspaceRoot, { id: params.artifactId })).content;
    rawArtifact = true;
  } catch {
    rawArtifact = false;
  }
  const requiredFacts = params.requiredFacts ?? [];
  const requiredFactsPassed = requiredFacts.every((fact) => params.compactText.includes(fact));
  const rawLeakagePassed = !detectRawLeakage(params.compactText, raw);
  const recoveryPassed = rawArtifact && raw.length > 0;
  const proof: ContextProof = {
    ok: rawArtifact && requiredFactsPassed && rawLeakagePassed && recoveryPassed,
    artifactId: params.artifactId,
    rawHash: raw ? contentHash(raw, 16) : '',
    compactHash: contentHash(params.compactText, 16),
    checks: [
      { name: 'raw-artifact', passed: rawArtifact },
      { name: 'required-facts', passed: requiredFactsPassed },
      { name: 'no-raw-leakage', passed: rawLeakagePassed },
      { name: 'recovery', passed: recoveryPassed }
    ]
  };
  await writeProof(params.workspaceRoot, params.artifactId, proof);
  return proof;
}

export async function verifyContextProof(params: {
  workspaceRoot: string;
  artifactId: string;
  compactText?: string;
  requiredFacts?: string[];
}): Promise<ContextProof> {
  const record = await findArtifactRecord(params.workspaceRoot, params.artifactId);
  let raw = '';
  let compactText = params.compactText ?? '';
  let rawArtifact = false;
  let compactArtifact = Boolean(params.compactText);
  try {
    raw = (await expandArtifactReference(params.workspaceRoot, { id: params.artifactId })).content;
    rawArtifact = true;
  } catch {
    rawArtifact = false;
  }
  if (!compactText && record?.compactPath) {
    compactText = await readFile(ensureInside(params.workspaceRoot, record.compactPath), 'utf8');
    compactArtifact = true;
  }
  const rawHash = raw ? contentHash(raw, 16) : '';
  const compactHash = compactText ? contentHash(compactText, 16) : '';
  const hashMatch = (!record?.hash || record.hash === rawHash) && (!record?.compactHash || record.compactHash === compactHash);
  const requiredFacts = params.requiredFacts ?? [];
  const requiredFactsPassed = requiredFacts.every((fact) => compactText.includes(fact));
  const rawLeakagePassed = !detectRawLeakage(compactText, raw);
  const recoveryPassed = rawArtifact && raw.length > 0;
  const proof: ContextProof = {
    ok: rawArtifact && compactArtifact && hashMatch && requiredFactsPassed && rawLeakagePassed && recoveryPassed,
    artifactId: params.artifactId,
    rawHash,
    compactHash,
    checks: [
      { name: 'raw-artifact', passed: rawArtifact },
      { name: 'compact-artifact', passed: compactArtifact },
      { name: 'hash-match', passed: hashMatch },
      { name: 'required-facts', passed: requiredFactsPassed },
      { name: 'no-raw-leakage', passed: rawLeakagePassed },
      { name: 'recovery', passed: recoveryPassed }
    ]
  };
  await writeProof(params.workspaceRoot, params.artifactId, proof);
  return proof;
}

function writeProof(workspaceRoot: string, artifactId: string, proof: ContextProof): Promise<void> {
  const proofRoot = safeJoin(workspaceRoot, '.utk', 'model-proxy', 'proofs');
  return mkdir(proofRoot, { recursive: true }).then(() =>
    writeFile(safeJoin(proofRoot, `${artifactId}.json`), `${JSON.stringify(proof, null, 2)}\n`, 'utf8')
  );
}

function detectRawLeakage(compactText: string, raw: string): boolean {
  if (/raw dump/i.test(compactText)) return true;
  if (!raw) return false;
  return compactText.length > raw.length * 0.8 && raw.length > 200;
}
