import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
export async function persistStream(stream, outputPath) {
    const writer = createWriteStream(outputPath);
    const hash = createHash('sha256');
    const chunks = [];
    let index = 0;
    let byteCount = 0;
    stream.on('data', (chunk) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push({ index, byteCount: buffer.byteLength });
        index += 1;
        byteCount += buffer.byteLength;
        hash.update(buffer);
    });
    stream.pipe(writer);
    await finished(writer);
    return { byteCount, contentHash: hash.digest('hex').slice(0, 10), chunks };
}
