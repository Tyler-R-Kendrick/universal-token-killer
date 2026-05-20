import { lstat, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  discoverSessionSkillCandidates,
  initializeWorkspaceStore,
  upsertSessionSkill,
  upsertSessionSkillsFromChat
} from '../src/index.js';

describe('session skills', () => {
  it('initializes .utk/session-skills and links it into .agents/skills', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skills-init-'));
    const result = await initializeWorkspaceStore(workspaceRoot);

    expect(result.sessionSkillsRoot).toBe(path.join(workspaceRoot, '.utk', 'session-skills'));
    expect(result.agentsSkillsPath).toBe(path.join(workspaceRoot, '.agents', 'skills'));
    await expect(lstat(result.sessionSkillsRoot)).resolves.toMatchObject({ isDirectory: expect.any(Function) });
    expect((await lstat(result.agentsSkillsPath)).isSymbolicLink()).toBe(true);

    const second = await initializeWorkspaceStore(workspaceRoot);
    expect((await lstat(second.agentsSkillsPath)).isSymbolicLink()).toBe(true);
  });

  it('leaves an existing concrete .agents/skills directory in place', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skills-existing-'));
    const agentsSkillsPath = path.join(workspaceRoot, '.agents', 'skills');
    await mkdir(agentsSkillsPath, { recursive: true });

    const result = await initializeWorkspaceStore(workspaceRoot);

    expect(result.agentsSkillsPath).toBe(agentsSkillsPath);
    expect((await lstat(agentsSkillsPath)).isSymbolicLink()).toBe(false);
  });

  it('writes a compact reusable agent skill for repeated work', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'schema route triage',
      description: 'Use when repeated UTK schema routing triage is needed.',
      purpose: 'Reduce repeated schema routing instructions across future turns.',
      triggers: ['schema routing', 'route confidence'],
      procedure: [
        'Inspect route confidence and schema id.',
        'Compare serializer artifact and raw artifact references.',
        'Report the smallest actionable fix.'
      ],
      references: {
        'route-checklist.md': 'Check route confidence, schema id, serializer id, and artifact paths.'
      }
    });

    const skillText = await readFile(path.join(result.skillRoot, 'SKILL.md'), 'utf8');
    const referenceText = await readFile(path.join(result.skillRoot, 'references', 'route-checklist.md'), 'utf8');

    expect(result.skillRoot).toBe(path.join(workspaceRoot, '.utk', 'session-skills', 'schema-route-triage'));
    expect(skillText).toContain('name: schema-route-triage');
    expect(skillText).toContain('description: Use when repeated UTK schema routing triage is needed.');
    expect(skillText).toContain('Purpose: Reduce repeated schema routing instructions across future turns.');
    expect(skillText).toContain('references/route-checklist.md');
    expect(skillText.length).toBeLessThan(850);
    expect(await readFile(path.join(result.skillRoot, 'agents', 'openai.yaml'), 'utf8')).toContain('Use $schema-route-triage when relevant; details in references.');
    expect(referenceText).toContain('route confidence');
  });

  it('normalizes default and unusual reference names', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-references-'));
    await initializeWorkspaceStore(workspaceRoot);

    const defaultReference = await upsertSessionSkill({
      workspaceRoot,
      name: 'default reference skill',
      description: 'Use when default references are needed.',
      purpose: 'Reduce repeated default reference instructions.',
      triggers: ['default references'],
      procedure: ['Use the default procedure reference.']
    });
    expect(defaultReference.referencePaths.map((item) => path.basename(item))).toEqual(['procedure.md']);

    const unusualReference = await upsertSessionSkill({
      workspaceRoot,
      name: 'unusual reference skill',
      description: 'Use when unusual references are needed.',
      purpose: 'Reduce repeated unusual reference instructions.',
      triggers: ['unusual references'],
      procedure: ['Normalize reference names.'],
      references: {
        '.txt': 'Fallback reference name.',
        'Deep Checklist.txt': 'Non-markdown extensions become markdown.'
      }
    });

    expect(unusualReference.referencePaths.map((item) => path.basename(item)).sort()).toEqual(['deep-checklist.md', 'procedure.md']);
  });

  it('discovers redundant chat work and materializes session skills', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-chat-'));
    await initializeWorkspaceStore(workspaceRoot);

    const candidates = discoverSessionSkillCandidates({
      messages: [
        'We keep doing schema routing triage for route confidence.',
        'Again, inspect route confidence and serializer artifacts.',
        'Schema routing triage should become a reusable skill.'
      ],
      profiles: [
        {
          name: 'schema route triage',
          description: 'Use when repeated UTK schema routing triage is needed.',
          purpose: 'Reduce repeated schema routing instructions across future turns.',
          triggers: ['schema routing triage', 'route confidence', 'serializer artifacts'],
          procedure: ['Inspect confidence.', 'Check artifacts.']
        }
      ],
      minTriggerHits: 2
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.expectedReuse).toContain('3 trigger hits');

    const results = await upsertSessionSkillsFromChat({
      workspaceRoot,
      messages: [
        'schema routing triage again',
        'route confidence and serializer artifacts again',
        'make schema routing triage reusable'
      ],
      profiles: [
        {
          name: 'schema route triage',
          description: 'Use when repeated UTK schema routing triage is needed.',
          purpose: 'Reduce repeated schema routing instructions across future turns.',
          triggers: ['schema routing triage', 'route confidence', 'serializer artifacts'],
          procedure: ['Inspect confidence.', 'Check artifacts.']
        }
      ],
      minTriggerHits: 2
    });

    expect(results.map((item) => path.basename(item.skillRoot))).toEqual(['schema-route-triage']);
  });

  it('skips weak patterns and sorts equally strong skill candidates by name', () => {
    expect(
      discoverSessionSkillCandidates({
        messages: ['schema routing once'],
        profiles: [
          {
            name: 'schema route triage',
            description: 'Use when repeated UTK schema routing triage is needed.',
            purpose: 'Reduce repeated schema routing instructions across future turns.',
            triggers: ['schema routing', 'route confidence'],
            procedure: ['Inspect confidence.']
          }
        ]
      })
    ).toEqual([]);

    expect(
      discoverSessionSkillCandidates({
        messages: ['alpha beta'],
        profiles: [
          { name: 'zeta skill', description: 'Use when zeta repeats.', purpose: 'Reduce zeta prompt tokens.', triggers: ['alpha'], procedure: ['Do zeta.'] },
          { name: 'alpha skill', description: 'Use when alpha repeats.', purpose: 'Reduce alpha prompt tokens.', triggers: ['beta'], procedure: ['Do alpha.'] }
        ],
        minTriggerHits: 1
      }).map((candidate) => candidate.name)
    ).toEqual(['alpha skill', 'zeta skill']);
  });
});
