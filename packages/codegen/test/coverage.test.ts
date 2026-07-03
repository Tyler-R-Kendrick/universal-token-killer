import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addMinMapEntry, createMinMap, parseMinMap } from '@utk/minmap';
import { loadMinMap, minMapJournalPath, minMapPath, replayMinMapJournal } from '@utk/minmap';
import { typescriptAdapter } from '../../plugins/languages/typescript/src/adapter.js';

async function workspace(): Promise<string> {
  return await mkdtemp(path.join(tmpdir(), 'utk-emission-coverage-'));
}

describe('emission negative-branch coverage', () => {
  it('createMinMap rejects non-string language ids', () => {
    expect(() => createMinMap(5 as unknown as string)).toThrow(/language/);
  });

  it('parseMinMap rejects non-string and empty language ids', () => {
    expect(() => parseMinMap('{"version":1,"language":5,"entries":[]}')).toThrow(/language/);
    expect(() => parseMinMap('{"version":1,"language":"","entries":[]}')).toThrow(/language/);
    expect(() => parseMinMap('{"version":1,"language":"typescript","entries":[[]]}')).toThrow(/entry/);
    expect(() => parseMinMap('{"version":1,"language":"typescript","entries":["x"]}')).toThrow(/entry/);
    expect(() => parseMinMap('{"version":1,"language":"typescript","entries":[null]}')).toThrow(/entry/);
  });

  it('expand skips non-ident entries and passes through unmapped identifiers', () => {
    let map = createMinMap('typescript');
    map = addMinMapEntry(map, { minId: 'm1', pretty: 'httpGetJson', kind: 'macro', provenance: 'new' });
    expect(typescriptAdapter.expand('const untouchedName = 1;\n', map)).toBe('const untouchedName = 1;\n');
  });

  it('loadMinMap rethrows non-ENOENT filesystem errors', async () => {
    const root = await workspace();
    await mkdir(minMapPath(root, 'typescript'), { recursive: true });
    await expect(loadMinMap(root, 'typescript')).rejects.toThrow(/EISDIR|directory/);
  });

  it('replayMinMapJournal rethrows non-ENOENT filesystem errors', async () => {
    const root = await workspace();
    await mkdir(minMapJournalPath(root, 'typescript'), { recursive: true });
    await expect(replayMinMapJournal(root, 'typescript')).rejects.toThrow(/EISDIR|directory/);
  });

  it('replayMinMapJournal rejects journal lines missing seq, patch, or hashAfter', async () => {
    const root = await workspace();
    const journalPath = minMapJournalPath(root, 'typescript');
    await mkdir(path.dirname(journalPath), { recursive: true });

    await writeFile(journalPath, '{"patch":"+ a alpha","hashAfter":"x"}\n', 'utf8');
    await expect(replayMinMapJournal(root, 'typescript')).rejects.toThrow(/journal/);

    await writeFile(journalPath, '{"seq":1,"hashAfter":"x"}\n', 'utf8');
    await expect(replayMinMapJournal(root, 'typescript')).rejects.toThrow(/journal/);

    await writeFile(journalPath, '{"seq":1,"patch":"+ a alpha"}\n', 'utf8');
    await expect(replayMinMapJournal(root, 'typescript')).rejects.toThrow(/journal/);
  });
});
