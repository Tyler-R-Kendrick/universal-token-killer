import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('minmap grammar files', () => {
  it('ships the declare-before-use min-map patch grammars as committed .lark files', async () => {
    for (const fileName of ['minmap-patch.lark', 'minmap-patch-block.lark']) {
      const content = await readFile(new URL(`../grammars/${fileName}`, import.meta.url), 'utf8');
      expect(content.length, fileName).toBeGreaterThan(0);
      expect(content.endsWith('\n'), fileName).toBe(true);
    }
  });
});
