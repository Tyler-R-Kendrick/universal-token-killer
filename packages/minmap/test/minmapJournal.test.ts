import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addMinMapEntry, createMinMap, minMapHash } from '@utk/minmap';
import {
  appendMinMapPatch,
  loadMinMap,
  minMapJournalPath,
  minMapPath,
  replayMinMapJournal,
  saveMinMap
} from '@utk/minmap';

async function workspace(): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), 'utk-emission-journal-'));
}

describe('min-map persistence', () => {
  it('normalizes the language id into the artifact paths', () => {
    expect(minMapPath('/ws', 'TypeScript 5')).toBe(path.join('/ws', '.utk', 'lang', 'typescript-5', 'minmap.json'));
    expect(minMapJournalPath('/ws', 'typescript')).toBe(
      path.join('/ws', '.utk', 'lang', 'typescript', 'minmap.journal.jsonl')
    );
  });

  it('saves and loads a canonical map', async () => {
    const root = await workspace();
    const map = addMinMapEntry(createMinMap('typescript'), {
      minId: 'a',
      pretty: 'applyPatch',
      kind: 'ident',
      provenance: 'new'
    });

    await saveMinMap(root, map);
    expect(await loadMinMap(root, 'typescript')).toEqual(map);
  });

  it('returns an empty map when nothing was saved yet', async () => {
    const root = await workspace();
    expect(await loadMinMap(root, 'typescript')).toEqual(createMinMap('typescript'));
  });

  it('appends patches to the journal and replays them into the same map', async () => {
    const root = await workspace();
    const first = await appendMinMapPatch(root, 'typescript', '+ a applyPatch');
    const second = await appendMinMapPatch(root, 'typescript', '+ b buildResponse\n~ a applyDelta');

    expect(first.entries).toHaveLength(1);
    expect(second.entries).toHaveLength(2);

    const replayed = await replayMinMapJournal(root, 'typescript');
    expect(replayed).toEqual(second);
    expect(await loadMinMap(root, 'typescript')).toEqual(second);

    const journalText = await readFile(minMapJournalPath(root, 'typescript'), 'utf8');
    const lines = journalText.trim().split('\n');
    expect(lines).toHaveLength(2);
    const lastEntry = JSON.parse(lines[1]!) as { seq: number; patch: string; hashAfter: string };
    expect(lastEntry.seq).toBe(2);
    expect(lastEntry.hashAfter).toBe(minMapHash(second));
  });

  it('replays an empty journal to an empty map', async () => {
    const root = await workspace();
    expect(await replayMinMapJournal(root, 'typescript')).toEqual(createMinMap('typescript'));
  });

  it('detects journal corruption via the recorded hash chain', async () => {
    const root = await workspace();
    await appendMinMapPatch(root, 'typescript', '+ a applyPatch');
    const journalPath = minMapJournalPath(root, 'typescript');
    const original = await readFile(journalPath, 'utf8');
    await writeFile(journalPath, original.replace('applyPatch', 'tamperedXX'), 'utf8');

    await expect(replayMinMapJournal(root, 'typescript')).rejects.toThrow(/journal/);
  });

  it('rejects journal lines that are not valid JSON objects', async () => {
    const root = await workspace();
    const journalPath = minMapJournalPath(root, 'typescript');
    await mkdir(path.dirname(journalPath), { recursive: true });
    await writeFile(journalPath, 'not-json\n', 'utf8');

    await expect(replayMinMapJournal(root, 'typescript')).rejects.toThrow(/journal/);
  });
});
