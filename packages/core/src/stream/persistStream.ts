import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';

export type PersistedStream = {
  byteCount: number;
  contentHash: string;
  chunks: Array<{ index: number; byteCount: number }>;
};

export async function persistStream(stream: Readable, outputPath: string): Promise<PersistedStream> {
  const writer = createWriteStream(outputPath);
  const hash = createHash('sha256');
  const chunks: PersistedStream['chunks'] = [];
  let index = 0;
  let byteCount = 0;

  const tracker = new Transform({
    transform(chunk: Buffer | string, _encoding, callback) {
      const buffer = Buffer.from(chunk);
      chunks.push({ index, byteCount: buffer.byteLength });
      index += 1;
      byteCount += buffer.byteLength;
      hash.update(buffer);
      callback(null, chunk);
    }
  });

  try {
    await pipeline(stream, tracker, writer);
  } catch (error) {
    await rm(outputPath, { force: true });
    throw error;
  }
  return { byteCount, contentHash: hash.digest('hex').slice(0, 10), chunks };
}
