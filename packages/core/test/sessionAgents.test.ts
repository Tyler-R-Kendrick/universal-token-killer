import { lstat, mkdir, mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  discoverSessionAgentCandidates,
  initializeWorkspaceStore,
  upsertSessionAgent,
  upsertSessionAgentsFromChat
} from '../src/index.js';

describe('session agents', () => {
  it('initializes .utk/session-agents and links it into .github/agents', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-agents-init-'));
    const result = await initializeWorkspaceStore(workspaceRoot);

    expect(result.sessionAgentsRoot).toBe(path.join(workspaceRoot, '.utk', 'session-agents'));
    expect(result.githubAgentsPath).toBe(path.join(workspaceRoot, '.github', 'agents'));
    await expect(lstat(result.sessionAgentsRoot)).resolves.toMatchObject({ isDirectory: expect.any(Function) });
    expect((await lstat(result.githubAgentsPath)).isSymbolicLink()).toBe(true);

    const second = await initializeWorkspaceStore(workspaceRoot);
    expect((await lstat(second.githubAgentsPath)).isSymbolicLink()).toBe(true);
  });

  it('leaves an existing concrete .github/agents directory in place', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-agents-existing-'));
    const githubAgentsPath = path.join(workspaceRoot, '.github', 'agents');
    await mkdir(githubAgentsPath, { recursive: true });

    const result = await initializeWorkspaceStore(workspaceRoot);

    expect(result.githubAgentsPath).toBe(githubAgentsPath);
    expect((await lstat(githubAgentsPath)).isSymbolicLink()).toBe(false);
  });

  it('writes a Copilot custom subagent with sketch-of-thought and a lexicon grammar sidecar', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-agent-'));
    await initializeWorkspaceStore(workspaceRoot);

    const result = await upsertSessionAgent({
      workspaceRoot,
      name: 'schema router analyst',
      description: 'Use when UTK schema routing needs route confidence analysis.',
      domain: 'schema-routing',
      expectedReuse: 'Repeated schema routing/debugging work appears in this chat.',
      lexicon: ['schema', 'route', 'confidence', 'serializer', 'artifact'],
      triggers: ['schema routing', 'route confidence']
    });

    const agentText = await readFile(result.agentPath, 'utf8');
    const grammarText = await readFile(result.grammarPath, 'utf8');
    const toolText = await readFile(result.toolRegistrationPath, 'utf8');

    expect(result.agentPath).toBe(path.join(workspaceRoot, '.utk', 'session-agents', 'schema-router-analyst.agent.md'));
    expect(agentText).toContain('name: schema-router-analyst');
    expect(agentText).toContain('tools: ["reason-with-lexicon"]');
    expect(agentText).toContain('sketch-of-thought');
    expect(agentText).toContain(result.grammarHash);
    expect(agentText).not.toContain('serializer');
    expect(grammarText).toContain('serializer');
    expect(grammarText).toContain('confidence');
    expect(toolText).toContain('reason-with-lexicon');
    expect(toolText).toContain(result.grammarHash);
  });

  it('discovers repeated domain work and materializes reusable session agents', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-agent-chat-'));
    await initializeWorkspaceStore(workspaceRoot);

    const candidates = discoverSessionAgentCandidates({
      messages: [
        'We need schema routing confidence for the Copilot tool output.',
        'The route confidence and serializer artifact are wrong.',
        'Please debug schema routing and the compact artifact again.',
        'Artifact recovery and route confidence are both likely to repeat.'
      ],
      profiles: [
        {
          name: 'schema router analyst',
          description: 'Use when schema routing and serializer artifacts need analysis.',
          domain: 'schema-routing',
          lexicon: ['schema', 'routing', 'route', 'confidence', 'serializer', 'artifact'],
          triggers: ['schema routing', 'route confidence', 'serializer artifact']
        },
        {
          name: 'artifact recovery analyst',
          description: 'Use when artifact recovery needs analysis.',
          domain: 'artifact-recovery',
          lexicon: ['artifact', 'recovery', 'route', 'confidence'],
          triggers: ['artifact recovery', 'route confidence']
        }
      ],
      minTriggerHits: 2
    });

    expect(candidates.map((candidate) => candidate.name)).toEqual(['schema router analyst', 'artifact recovery analyst']);
    expect(candidates[0]!.expectedReuse).toContain('3 trigger hits');
    expect(
      discoverSessionAgentCandidates({
        messages: ['alpha beta'],
        profiles: [
          { name: 'zeta analyst', description: 'Use when zeta repeats.', domain: 'zeta', lexicon: ['alpha'], triggers: ['alpha'] },
          { name: 'alpha analyst', description: 'Use when alpha repeats.', domain: 'alpha', lexicon: ['beta'], triggers: ['beta'] }
        ],
        minTriggerHits: 1
      }).map((candidate) => candidate.name)
    ).toEqual(['alpha analyst', 'zeta analyst']);

    const results = await upsertSessionAgentsFromChat({
      workspaceRoot,
      messages: [
        'schema routing confidence needs review',
        'serializer artifact route confidence failed',
        'schema routing should be reusable'
      ],
      profiles: [
        {
          name: 'schema router analyst',
          description: 'Use when schema routing and serializer artifacts need analysis.',
          domain: 'schema-routing',
          lexicon: ['schema', 'routing', 'route', 'confidence', 'serializer', 'artifact'],
          triggers: ['schema routing', 'route confidence', 'serializer artifact']
        }
      ],
      minTriggerHits: 2
    });

    expect(results.map((item) => path.basename(item.agentPath))).toEqual(['schema-router-analyst.agent.md']);
  });

  it('skips weak chat patterns and supports empty lexicon fallback grammars', async () => {
    const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'utk-session-agent-fallback-'));
    await initializeWorkspaceStore(workspaceRoot);

    expect(
      discoverSessionAgentCandidates({
        messages: ['one mention of schema routing only'],
        profiles: [
          {
            name: 'schema router analyst',
            description: 'Use when schema routing and serializer artifacts need analysis.',
            domain: 'schema-routing',
            lexicon: ['schema'],
            triggers: ['schema routing', 'route confidence']
          }
        ]
      })
    ).toEqual([]);

    await expect(
      upsertSessionAgentsFromChat({
        workspaceRoot,
        messages: ['no repeated pattern'],
        profiles: [
          {
            name: 'schema router analyst',
            description: 'Use when schema routing and serializer artifacts need analysis.',
            domain: 'schema-routing',
            lexicon: ['schema'],
            triggers: ['schema routing', 'route confidence']
          }
        ]
      })
    ).resolves.toEqual([]);

    const fallback = await upsertSessionAgent({
      workspaceRoot,
      name: 'General Helper',
      description: 'Use when repeated general reasoning needs a reusable sketch.',
      domain: 'general',
      expectedReuse: 'Manual user request for a reusable general agent.',
      lexicon: [],
      triggers: []
    });

    await expect(readFile(fallback.grammarPath, 'utf8')).resolves.toContain('general');
  });
});
