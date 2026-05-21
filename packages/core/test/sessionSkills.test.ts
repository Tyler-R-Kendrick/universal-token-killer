import { lstat, mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  discoverSessionSkillCandidates,
  initializeWorkspaceStore,
  upsertSessionSkill,
  upsertSessionSkillsFromChat
} from '../src/index.js';

async function writeSessionSkill(params: Omit<Parameters<typeof upsertSessionSkill>[0], 'workspaceRoot'>) {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-agent-specific-'));
  await initializeWorkspaceStore(workspaceRoot);
  return upsertSessionSkill({ workspaceRoot, ...params });
}

function frontmatterKeys(skillText: string): string[] {
  const frontmatter = skillText.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  return frontmatter
    .split(/\r?\n/)
    .map((line) => line.split(':')[0]?.trim())
    .filter((key): key is string => Boolean(key));
}

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

    expect(unusualReference.referencePaths.map((item) => path.basename(item)).sort()).toEqual(['deep-checklist.md', 'procedure-2.md', 'procedure.md']);
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
    expect(candidates[0]!.expectedReuse).toContain('5 trigger hits');

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

  it('counts repeated trigger occurrences when discovering reusable skills', () => {
    const candidates = discoverSessionSkillCandidates({
      messages: [
        'detoks skill refactor needed for command preservation.',
        'detoks skill refactor also needs frontmatter preservation.'
      ],
      profiles: [
        {
          name: 'detoks skill refactor',
          description: 'Use when detoks skill refactors repeat.',
          purpose: 'Reduce repeated detoks skill instructions.',
          triggers: ['detoks skill refactor'],
          procedure: ['Refactor repeated skill guidance.']
        }
      ],
      minTriggerHits: 2
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.expectedReuse).toContain('2 trigger hits');
  });

  it('sanitizes generated skill frontmatter against multiline injection', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-frontmatter-safe-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'unsafe frontmatter skill',
      description: 'Use when unsafe descriptions repeat.\nname: injected\n---\n# injected',
      purpose: 'Keep generated skill metadata parseable.',
      triggers: ['unsafe frontmatter'],
      procedure: ['Normalize multiline metadata before writing SKILL.md.']
    });

    const skillText = await readFile(result.skillPath, 'utf8');
    const openAiText = await readFile(path.join(result.skillRoot, 'agents', 'openai.yaml'), 'utf8');

    expect(skillText).toContain('name: unsafe-frontmatter-skill');
    expect(skillText).toContain('description: "Use when unsafe descriptions repeat. # injected."');
    expect(skillText.match(/^---$/gm)).toHaveLength(2);
    expect(openAiText).toContain('short_description: "Use when unsafe descriptions repeat. # injected."');
  });

  it('writes procedure.md even when additional references are supplied', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-procedure-plus-refs-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'tool workflow skill',
      description: 'Use when repeated tool workflows are needed.',
      purpose: 'Keep exact tool workflow steps out of always-loaded prompt text.',
      triggers: ['tool workflow'],
      procedure: [
        'Run `npx vitest run packages/core/test/sessionSkills.test.ts`.',
        'Run `npm run typecheck`.',
        'Compare `skills/detoks/SKILL.md` and plugin copy byte-for-byte.',
        'Do not rewrite quoted command text.',
        'Preserve C:\\src\\utk\\skills\\detoks\\references\\detoks-skill.md.',
        'Record validation output exactly.'
      ],
      references: {
        'tool-notes.md': 'Tool notes stay separate from procedure.'
      }
    });

    const referenceNames = result.referencePaths.map((item) => path.basename(item)).sort();
    const procedureText = await readFile(path.join(result.skillRoot, 'references', 'procedure.md'), 'utf8');
    const skillText = await readFile(result.skillPath, 'utf8');

    expect(referenceNames).toEqual(['procedure.md', 'tool-notes.md']);
    expect(procedureText).toContain('Record validation output exactly.');
    expect(skillText).toContain('references/procedure.md');
    expect(skillText).toContain('references/tool-notes.md');
    expect(skillText.length).toBeLessThan(900);
  });

  it('disambiguates colliding reference filenames instead of overwriting content', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-reference-collisions-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'reference collision skill',
      description: 'Use when reference filenames collide.',
      purpose: 'Preserve every extracted reference file.',
      triggers: ['reference collision'],
      procedure: ['Keep all references.'],
      references: {
        'Route Checklist.md': 'First checklist body.',
        'route-checklist.txt': 'Second checklist body.',
        'route checklist!.md': 'Third checklist body.'
      }
    });

    const referenceNames = (await readdir(path.join(result.skillRoot, 'references'))).sort();
    const contents = await Promise.all(referenceNames.map((name) => readFile(path.join(result.skillRoot, 'references', name), 'utf8')));

    expect(referenceNames).toEqual(['procedure.md', 'route-checklist-2.md', 'route-checklist-3.md', 'route-checklist.md']);
    expect(contents.join('\n')).toContain('First checklist body.');
    expect(contents.join('\n')).toContain('Second checklist body.');
    expect(contents.join('\n')).toContain('Third checklist body.');
  });

  it('keeps exact fenced snippets and markdown links inside extracted references', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-reference-literals-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'literal reference skill',
      description: 'Use when literal reference snippets repeat.',
      purpose: 'Move exact snippets into a reference file.',
      triggers: ['literal snippet'],
      procedure: [
        [
          'Keep exact snippet:',
          '```powershell',
          'npx skills add . --list',
          '```',
          'Read [detoks skill](skills/detoks/references/detoks-skill.md).'
        ].join('\n')
      ]
    });

    const procedureText = await readFile(path.join(result.skillRoot, 'references', 'procedure.md'), 'utf8');

    expect(procedureText).toContain('```powershell\nnpx skills add . --list\n```');
    expect(procedureText).toContain('[detoks skill](skills/detoks/references/detoks-skill.md)');
  });

  it('uses safe fallback text for empty trigger and procedure lists', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-empty-fields-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'empty fields skill',
      description: 'Use when sparse skill profiles repeat.',
      purpose: 'Keep sparse generated skills readable.',
      triggers: [],
      procedure: []
    });

    const skillText = await readFile(result.skillPath, 'utf8');
    const procedureText = await readFile(path.join(result.skillRoot, 'references', 'procedure.md'), 'utf8');

    expect(skillText).toContain('- sparse skill profiles');
    expect(skillText).toContain('1. See references/procedure.md.');
    expect(procedureText).toContain('No procedure captured.');
  });

  it('normalizes generated skill names to agent-skills hyphen-only slugs', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-hyphen-slug-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'API_v2 / GHCP: Subagent Cleanup!',
      description: 'Use when GHCP subagent cleanup repeats.',
      purpose: 'Keep generated skill names spec-compatible.',
      triggers: ['ghcp subagent cleanup'],
      procedure: ['Clean custom agent metadata.']
    });

    const skillText = await readFile(result.skillPath, 'utf8');

    expect(result.name).toBe('api-v2-ghcp-subagent-cleanup');
    expect(path.basename(result.skillRoot)).toBe('api-v2-ghcp-subagent-cleanup');
    expect(skillText).toContain('name: api-v2-ghcp-subagent-cleanup');
  });

  it('repairs descriptions that omit the Use when trigger phrase', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-description-prefix-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'missing trigger phrase',
      description: 'repeated build evidence capture is needed',
      purpose: 'Keep generated descriptions discoverable.',
      triggers: ['build evidence'],
      procedure: ['Capture build evidence.']
    });

    const skillText = await readFile(result.skillPath, 'utf8');
    const openAiText = await readFile(path.join(result.skillRoot, 'agents', 'openai.yaml'), 'utf8');

    expect(skillText).toContain('description: Use when repeated build evidence capture is needed.');
    expect(openAiText).toContain('short_description: Use when repeated build evidence capture is needed.');
  });

  it('bounds frontmatter metadata length while preserving full detail in references', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-long-description-'));
    await initializeWorkspaceStore(workspaceRoot);
    const longDescription = `Use when ${'very detailed trigger '.repeat(80)}must be condensed.`;

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'long metadata skill',
      description: longDescription,
      purpose: 'Keep frontmatter compact.',
      triggers: ['long metadata'],
      procedure: ['Preserve the full detail in procedure references.'],
      references: {
        'full-context.md': longDescription
      }
    });

    const skillText = await readFile(result.skillPath, 'utf8');
    const frontmatter = skillText.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const fullContext = await readFile(path.join(result.skillRoot, 'references', 'full-context.md'), 'utf8');

    expect(frontmatter.length).toBeLessThanOrEqual(1024);
    expect(skillText).toContain('description: ');
    expect(skillText).not.toContain('very detailed trigger very detailed trigger very detailed trigger very detailed trigger very detailed trigger very detailed trigger very detailed trigger very detailed trigger');
    expect(fullContext).toContain(longDescription);
  });

  it('does not match triggers as substrings inside unrelated words', () => {
    const candidates = discoverSessionSkillCandidates({
      messages: ['We concatenate strings and scatter output files.'],
      profiles: [
        {
          name: 'cat workflow',
          description: 'Use when cat workflows repeat.',
          purpose: 'Avoid substring false positives.',
          triggers: ['cat'],
          procedure: ['Run cat.']
        }
      ],
      minTriggerHits: 1
    });

    expect(candidates).toEqual([]);
  });

  it('ignores blank triggers during discovery', () => {
    const candidates = discoverSessionSkillCandidates({
      messages: ['Any non-empty chat should not match blank triggers.'],
      profiles: [
        {
          name: 'blank trigger skill',
          description: 'Use when blank trigger profiles repeat.',
          purpose: 'Avoid empty-trigger false positives.',
          triggers: ['', '   '],
          procedure: ['Do nothing.']
        }
      ],
      minTriggerHits: 1
    });

    expect(candidates).toEqual([]);
  });

  it('preserves generated procedure when custom procedure reference exists', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-custom-procedure-ref-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'custom procedure reference skill',
      description: 'Use when custom procedure references repeat.',
      purpose: 'Avoid losing generated procedure details.',
      triggers: ['custom procedure'],
      procedure: ['Generated procedure step stays available.'],
      references: {
        'procedure.md': 'Custom procedure body also stays available.'
      }
    });

    const referenceNames = result.referencePaths.map((item) => path.basename(item)).sort();
    const generatedProcedure = await readFile(path.join(result.skillRoot, 'references', 'procedure.md'), 'utf8');
    const customProcedure = await readFile(path.join(result.skillRoot, 'references', 'procedure-2.md'), 'utf8');

    expect(referenceNames).toEqual(['procedure-2.md', 'procedure.md']);
    expect(generatedProcedure).toContain('Generated procedure step stays available.');
    expect(customProcedure).toContain('Custom procedure body also stays available.');
  });

  it('uses fallback text for empty custom references', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-empty-reference-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'empty reference body skill',
      description: 'Use when empty extracted references repeat.',
      purpose: 'Keep reference files meaningful.',
      triggers: ['empty reference'],
      procedure: ['Procedure remains.'],
      references: {
        'empty-reference.md': '   '
      }
    });

    const referenceText = await readFile(path.join(result.skillRoot, 'references', 'empty-reference.md'), 'utf8');

    expect(referenceText).toContain('No reference content captured.');
  });

  it('sanitizes traversal and windows-reserved reference filenames', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-reference-path-safety-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'reference path safety skill',
      description: 'Use when unsafe reference filenames repeat.',
      purpose: 'Keep extracted reference files inside the skill root.',
      triggers: ['unsafe reference filenames'],
      procedure: ['Normalize unsafe names.'],
      references: {
        '..\\..\\escape.md': 'Traversal content.',
        'CON.md': 'Reserved console content.',
        'aux.txt': 'Reserved aux content.'
      }
    });

    const referenceNames = result.referencePaths.map((item) => path.basename(item)).sort();

    expect(referenceNames).toEqual(['aux-ref.md', 'con-ref.md', 'escape.md', 'procedure.md']);
    for (const referencePath of result.referencePaths) {
      expect(referencePath.startsWith(path.join(result.skillRoot, 'references'))).toBe(true);
    }
  });

  it('keeps all procedure steps in procedure reference while limiting SKILL.md preview', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-long-procedure-'));
    await initializeWorkspaceStore(workspaceRoot);
    const procedure = Array.from({ length: 12 }, (_, index) => `Step ${index + 1}: preserve exact command \`cmd-${index + 1}\`.`);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'long procedure skill',
      description: 'Use when long procedures repeat.',
      purpose: 'Keep long procedures in references.',
      triggers: ['long procedure'],
      procedure
    });

    const skillText = await readFile(result.skillPath, 'utf8');
    const procedureText = await readFile(path.join(result.skillRoot, 'references', 'procedure.md'), 'utf8');

    expect(skillText).toContain('5. Step 5: preserve exact command `cmd-5`.');
    expect(skillText).not.toContain('cmd-6');
    expect(procedureText).toContain('Step 12: preserve exact command `cmd-12`.');
  });

  it('deduplicates repeated triggers in SKILL.md preview without losing discovery evidence', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-trigger-dedupe-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'duplicate trigger skill',
      description: 'Use when duplicate triggers repeat.',
      purpose: 'Keep trigger previews compact.',
      triggers: ['build gate', 'build gate', 'Build Gate', 'typecheck'],
      procedure: ['Run verification.']
    });

    const skillText = await readFile(result.skillPath, 'utf8');

    expect((skillText.match(/- build gate/gi) ?? [])).toHaveLength(1);
    expect(skillText).toContain('- typecheck');
  });

  it('sorts generated references before rendering refs list', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-reference-sort-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'sorted reference skill',
      description: 'Use when reference ordering repeats.',
      purpose: 'Keep generated ref lists stable.',
      triggers: ['reference ordering'],
      procedure: ['Keep stable output.'],
      references: {
        'zeta.md': 'Zeta body.',
        'alpha.md': 'Alpha body.'
      }
    });

    const skillText = await readFile(result.skillPath, 'utf8');
    const refsIndex = skillText.indexOf('Refs:');
    const alphaIndex = skillText.indexOf('references/alpha.md');
    const procedureIndex = skillText.indexOf('references/procedure.md');
    const zetaIndex = skillText.indexOf('references/zeta.md');

    expect(refsIndex).toBeLessThan(alphaIndex);
    expect(alphaIndex).toBeLessThan(procedureIndex);
    expect(procedureIndex).toBeLessThan(zetaIndex);
  });

  it('quotes YAML scalars containing colon, bracket, or hash characters', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-yaml-scalars-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionSkill({
      workspaceRoot,
      name: 'YAML: scalar # skill [v2]',
      description: 'Use when YAML: scalar # hazards [v2] repeat.',
      purpose: 'Keep generated YAML parseable.',
      triggers: ['yaml scalar'],
      procedure: ['Quote unsafe scalars.']
    });

    const skillText = await readFile(result.skillPath, 'utf8');
    const openAiText = await readFile(path.join(result.skillRoot, 'agents', 'openai.yaml'), 'utf8');

    expect(skillText).toContain('description: "Use when YAML: scalar # hazards [v2] repeat."');
    expect(openAiText).toContain('display_name: "YAML: scalar # skill [v2]"');
    expect(openAiText).toContain('short_description: "Use when YAML: scalar # hazards [v2] repeat."');
  });

  it('keeps generated SKILL.md frontmatter limited to name and description keys', async () => {
    const result = await writeSessionSkill({
      name: 'strict frontmatter skill',
      description: 'Use when strict frontmatter repeats.\ntags: [unsafe]\ntools: [bash]\nversion: 2',
      purpose: 'Keep agent skill metadata minimal.',
      triggers: ['strict frontmatter'],
      procedure: ['Inspect generated frontmatter.']
    });

    const skillText = await readFile(result.skillPath, 'utf8');

    expect(frontmatterKeys(skillText)).toEqual(['name', 'description']);
    expect(skillText).not.toContain('tools: [bash]');
    expect(skillText).not.toContain('tags: [unsafe]');
  });

  it('adds a skill heading for agent-skill discovery after frontmatter', async () => {
    const result = await writeSessionSkill({
      name: 'heading discovery skill',
      description: 'Use when heading discovery repeats.',
      purpose: 'Keep generated skills scannable.',
      triggers: ['heading discovery'],
      procedure: ['Scan the generated skill quickly.']
    });

    const skillText = await readFile(result.skillPath, 'utf8');

    expect(skillText).toContain('---\n\n# heading-discovery-skill\n\nPurpose:');
  });

  it('keeps required sub-skill references visible in the generated skill body', async () => {
    const result = await writeSessionSkill({
      name: 'required subskill routing',
      description: 'Use when required subskill routing repeats.',
      purpose: 'Route future agents to required skills.',
      triggers: ['required subskill'],
      procedure: ['Use the required skills before implementation.'],
      requiredSkills: ['superpowers:test-driven-development', 'detoks', 'superpowers:test-driven-development']
    });

    const skillText = await readFile(result.skillPath, 'utf8');

    expect(skillText).toContain('Required skills:');
    expect((skillText.match(/superpowers:test-driven-development/g) ?? [])).toHaveLength(1);
    expect(skillText).toContain('- detoks');
  });

  it('normalizes required skill names without stripping namespace separators', async () => {
    const result = await writeSessionSkill({
      name: 'required skill namespace',
      description: 'Use when namespaced required skills repeat.',
      purpose: 'Keep plugin skill names usable.',
      triggers: ['namespaced required skills'],
      procedure: ['Load namespaced skills.'],
      requiredSkills: [' github:gh-fix-ci ', '$detoks', 'superpowers:writing-skills']
    });

    const skillText = await readFile(result.skillPath, 'utf8');

    expect(skillText).toContain('- github:gh-fix-ci');
    expect(skillText).toContain('- detoks');
    expect(skillText).toContain('- superpowers:writing-skills');
  });

  it('omits required skills section when only blank required skill names are supplied', async () => {
    const result = await writeSessionSkill({
      name: 'blank required skills',
      description: 'Use when blank required skills repeat.',
      purpose: 'Avoid empty generated sections.',
      triggers: ['blank required skills'],
      procedure: ['Skip blank skill names.'],
      requiredSkills: ['', '   ']
    });

    const skillText = await readFile(result.skillPath, 'utf8');

    expect(skillText).not.toContain('Required skills:');
  });

  it('adds when-not-to-use guidance for agent skill selection boundaries', async () => {
    const result = await writeSessionSkill({
      name: 'selection boundary skill',
      description: 'Use when skill selection boundaries repeat.',
      purpose: 'Prevent over-triggering generated skills.',
      triggers: ['selection boundary'],
      procedure: ['Check boundaries before using this skill.'],
      whenNotToUse: ['One-off tasks.', 'Requests that need live secrets.']
    });

    const skillText = await readFile(result.skillPath, 'utf8');

    expect(skillText).toContain('Do not use when:');
    expect(skillText).toContain('- One-off tasks.');
    expect(skillText).toContain('- Requests that need live secrets.');
  });

  it('deduplicates when-not-to-use guidance case-insensitively', async () => {
    const result = await writeSessionSkill({
      name: 'dedupe boundary skill',
      description: 'Use when duplicate boundaries repeat.',
      purpose: 'Keep boundary guidance compact.',
      triggers: ['duplicate boundaries'],
      procedure: ['Render unique boundaries.'],
      whenNotToUse: ['one-off tasks', 'One-Off Tasks', '  one-off tasks  ']
    });

    const skillText = await readFile(result.skillPath, 'utf8');

    expect((skillText.match(/one-off tasks/gi) ?? [])).toHaveLength(1);
  });

  it('keeps common mistakes in references rather than bloating SKILL.md', async () => {
    const result = await writeSessionSkill({
      name: 'mistake reference skill',
      description: 'Use when common mistake guidance repeats.',
      purpose: 'Keep root skill concise.',
      triggers: ['common mistake guidance'],
      procedure: ['Read mistake guidance when needed.'],
      commonMistakes: ['Putting 200 lines in SKILL.md.', 'Repeating reference content in root skill.']
    });

    const skillText = await readFile(result.skillPath, 'utf8');
    const mistakes = await readFile(path.join(result.skillRoot, 'references', 'common-mistakes.md'), 'utf8');

    expect(skillText).toContain('references/common-mistakes.md');
    expect(skillText).not.toContain('Putting 200 lines in SKILL.md.');
    expect(mistakes).toContain('- Putting 200 lines in SKILL.md.');
  });

  it('keeps evaluation scenarios in references for skill TDD loops', async () => {
    const result = await writeSessionSkill({
      name: 'skill eval scenario',
      description: 'Use when skill eval scenarios repeat.',
      purpose: 'Keep skill evaluation cases reusable.',
      triggers: ['skill eval scenario'],
      procedure: ['Run skill eval scenarios.'],
      evalScenarios: ['Agent ignores required subskill under time pressure.', 'Agent inlines references into SKILL.md.']
    });

    const skillText = await readFile(result.skillPath, 'utf8');
    const evals = await readFile(path.join(result.skillRoot, 'references', 'eval-scenarios.md'), 'utf8');

    expect(skillText).toContain('references/eval-scenarios.md');
    expect(evals).toContain('- Agent ignores required subskill under time pressure.');
  });

  it('does not create empty common-mistakes or eval-scenarios references', async () => {
    const result = await writeSessionSkill({
      name: 'empty optional references',
      description: 'Use when optional reference lists are empty.',
      purpose: 'Avoid noisy generated skill folders.',
      triggers: ['empty optional references'],
      procedure: ['Skip empty optional references.'],
      commonMistakes: [],
      evalScenarios: []
    });

    const referenceNames = await readdir(path.join(result.skillRoot, 'references'));

    expect(referenceNames).not.toContain('common-mistakes.md');
    expect(referenceNames).not.toContain('eval-scenarios.md');
  });

  it('moves multiline procedure previews to references to avoid broken markdown in SKILL.md', async () => {
    const result = await writeSessionSkill({
      name: 'multiline procedure preview',
      description: 'Use when multiline procedures repeat.',
      purpose: 'Keep root markdown valid.',
      triggers: ['multiline procedure'],
      procedure: ['Read this exact block:\n```bash\nnpm test\n```']
    });

    const skillText = await readFile(result.skillPath, 'utf8');
    const procedure = await readFile(path.join(result.skillRoot, 'references', 'procedure.md'), 'utf8');

    expect(skillText).toContain('1. See references/procedure.md.');
    expect(skillText).not.toContain('```bash');
    expect(procedure).toContain('```bash\nnpm test\n```');
  });

  it('removes stale generated references on upsert', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-stale-refs-'));
    await initializeWorkspaceStore(workspaceRoot);
    const base = {
      workspaceRoot,
      name: 'stale reference skill',
      description: 'Use when stale reference cleanup repeats.',
      purpose: 'Keep regenerated skill folders clean.',
      triggers: ['stale references'],
      procedure: ['Initial procedure.']
    };

    const first = await upsertSessionSkill({ ...base, references: { 'old.md': 'Old content.' } });
    const second = await upsertSessionSkill({ ...base, references: { 'new.md': 'New content.' } });
    const referenceNames = await readdir(path.join(second.skillRoot, 'references'));

    expect(first.skillRoot).toBe(second.skillRoot);
    expect(referenceNames.sort()).toEqual(['new.md', 'procedure.md']);
  });

  it('strips control characters from metadata but preserves reference text', async () => {
    const result = await writeSessionSkill({
      name: 'control char skill\u0000',
      description: 'Use when control\u0000 metadata repeats.',
      purpose: 'Keep generated metadata readable.',
      triggers: ['control metadata'],
      procedure: ['Preserve reference control sample.'],
      references: {
        'control-sample.md': 'Raw sample keeps visible text around \u0000 marker.'
      }
    });

    const skillText = await readFile(result.skillPath, 'utf8');
    const referenceText = await readFile(path.join(result.skillRoot, 'references', 'control-sample.md'), 'utf8');

    expect(skillText).not.toContain('\u0000');
    expect(referenceText).toContain('Raw sample keeps visible text around \u0000 marker.');
  });

  it('falls back to useful metadata when generated name and description are empty', async () => {
    const result = await writeSessionSkill({
      name: '!!!',
      description: '',
      purpose: '',
      triggers: [],
      procedure: []
    });

    const skillText = await readFile(result.skillPath, 'utf8');

    expect(result.name).toBe('skill');
    expect(skillText).toContain('description: Use when this workflow repeats.');
    expect(skillText).toContain('Purpose: Reduce repeated instructions across future turns.');
  });

  it('keeps skill root under session-skills for path-like skill names', async () => {
    const result = await writeSessionSkill({
      name: '..\\..\\detoks escape',
      description: 'Use when path-like skill names repeat.',
      purpose: 'Keep skill roots inside session-skills.',
      triggers: ['path-like skill name'],
      procedure: ['Normalize skill root.']
    });

    expect(result.skillRoot.endsWith(path.join('.utk', 'session-skills', 'detoks-escape'))).toBe(true);
    expect(result.skillPath.startsWith(result.skillRoot)).toBe(true);
  });

  it('preserves markdown tables in procedure references while keeping root preview small', async () => {
    const result = await writeSessionSkill({
      name: 'table reference skill',
      description: 'Use when table references repeat.',
      purpose: 'Keep exact markdown table syntax in references.',
      triggers: ['table reference'],
      procedure: ['| Skill | Use |\n|---|---|\n| detoks | compress prompt text |']
    });

    const skillText = await readFile(result.skillPath, 'utf8');
    const procedure = await readFile(path.join(result.skillRoot, 'references', 'procedure.md'), 'utf8');

    expect(skillText).toContain('1. See references/procedure.md.');
    expect(procedure).toContain('| Skill | Use |\n|---|---|');
  });

  it('preserves admonitions in procedure references without rendering them inline', async () => {
    const result = await writeSessionSkill({
      name: 'admonition reference skill',
      description: 'Use when admonition references repeat.',
      purpose: 'Keep admonition syntax intact.',
      triggers: ['admonition reference'],
      procedure: ['!!! warning\n    Do not skip verification.']
    });

    const skillText = await readFile(result.skillPath, 'utf8');
    const procedure = await readFile(path.join(result.skillRoot, 'references', 'procedure.md'), 'utf8');

    expect(skillText).toContain('1. See references/procedure.md.');
    expect(procedure).toContain('!!! warning\n    Do not skip verification.');
  });

  it('normalizes existing bullet markers in trigger previews', async () => {
    const result = await writeSessionSkill({
      name: 'bullet trigger skill',
      description: 'Use when bullet trigger profiles repeat.',
      purpose: 'Avoid double bullet markers.',
      triggers: ['- detoks skill', '* prompt compression', '1. agent skill'],
      procedure: ['Render triggers.']
    });

    const skillText = await readFile(result.skillPath, 'utf8');

    expect(skillText).toContain('- detoks skill');
    expect(skillText).toContain('- prompt compression');
    expect(skillText).toContain('- agent skill');
    expect(skillText).not.toContain('- - detoks skill');
  });

  it('normalizes existing numbering in procedure previews', async () => {
    const result = await writeSessionSkill({
      name: 'numbered procedure skill',
      description: 'Use when numbered procedure profiles repeat.',
      purpose: 'Avoid double numbered procedure lines.',
      triggers: ['numbered procedure'],
      procedure: ['1. Read SKILL.md.', '2) Read references/procedure.md.']
    });

    const skillText = await readFile(result.skillPath, 'utf8');

    expect(skillText).toContain('1. Read SKILL.md.');
    expect(skillText).toContain('2. Read references/procedure.md.');
    expect(skillText).not.toContain('1. 1. Read SKILL.md.');
  });

  it('keeps reference names stable for spaces, dots, plus signs, and scoped package names', async () => {
    const result = await writeSessionSkill({
      name: 'reference name stability',
      description: 'Use when reference name stability repeats.',
      purpose: 'Keep skill references predictable.',
      triggers: ['reference name stability'],
      procedure: ['Normalize references.'],
      references: {
        'Node v20.11+.md': 'Node reference.',
        '@scope/package.md': 'Package reference.'
      }
    });

    const referenceNames = result.referencePaths.map((item) => path.basename(item)).sort();

    expect(referenceNames).toEqual(['node-v20-11.md', 'package.md', 'procedure.md']);
  });

  it('materializes selected candidates in deterministic trigger-strength order', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-skill-materialize-order-'));
    await initializeWorkspaceStore(workspaceRoot);

    const results = await upsertSessionSkillsFromChat({
      workspaceRoot,
      messages: ['alpha alpha beta beta beta'],
      minTriggerHits: 1,
      profiles: [
        { name: 'alpha skill', description: 'Use when alpha repeats.', purpose: 'Alpha.', triggers: ['alpha'], procedure: ['Do alpha.'] },
        { name: 'beta skill', description: 'Use when beta repeats.', purpose: 'Beta.', triggers: ['beta'], procedure: ['Do beta.'] }
      ]
    });

    expect(results.map((item) => item.name)).toEqual(['beta-skill', 'alpha-skill']);
  });

  it('deduplicates overlapping trigger phrases by longest match during discovery', () => {
    const candidates = discoverSessionSkillCandidates({
      messages: ['detoks skill refactor happened once.'],
      minTriggerHits: 2,
      profiles: [
        {
          name: 'overlap trigger skill',
          description: 'Use when overlap trigger detection repeats.',
          purpose: 'Avoid inflated trigger evidence.',
          triggers: ['detoks skill', 'detoks skill refactor'],
          procedure: ['Count trigger evidence.']
        }
      ]
    });

    expect(candidates).toEqual([]);
  });

  it('caps trigger and procedure previews while full references retain exact content', async () => {
    const triggers = Array.from({ length: 12 }, (_, index) => `trigger-${index + 1}`);
    const procedure = Array.from({ length: 12 }, (_, index) => `Procedure ${index + 1}`);
    const result = await writeSessionSkill({
      name: 'preview cap skill',
      description: 'Use when preview caps repeat.',
      purpose: 'Keep root skill compact.',
      triggers,
      procedure
    });

    const skillText = await readFile(result.skillPath, 'utf8');
    const procedureText = await readFile(path.join(result.skillRoot, 'references', 'procedure.md'), 'utf8');

    expect(skillText).toContain('- trigger-5');
    expect(skillText).not.toContain('trigger-6');
    expect(skillText).not.toContain('Procedure 6');
    expect(procedureText).toContain('Procedure 12');
  });

  it('keeps SKILL.md under compact size even with agent-skill extras', async () => {
    const result = await writeSessionSkill({
      name: 'compact extras skill',
      description: 'Use when compact extras repeat.',
      purpose: 'Keep root skill compact while extras exist.',
      triggers: Array.from({ length: 20 }, (_, index) => `trigger ${index}`),
      procedure: Array.from({ length: 20 }, (_, index) => `Procedure ${index}`),
      requiredSkills: ['detoks', 'superpowers:test-driven-development'],
      whenNotToUse: ['one-off work', 'work without repeated value'],
      commonMistakes: Array.from({ length: 20 }, (_, index) => `Mistake ${index}`),
      evalScenarios: Array.from({ length: 20 }, (_, index) => `Scenario ${index}`)
    });

    const skillText = await readFile(result.skillPath, 'utf8');

    expect(skillText.length).toBeLessThan(1200);
    expect(skillText).toContain('references/common-mistakes.md');
    expect(skillText).toContain('references/eval-scenarios.md');
  });
});
