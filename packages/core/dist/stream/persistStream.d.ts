import type { Readable } from 'node:stream';
export type PersistedStream = {
    byteCount: number;
    contentHash: string;
    chunks: Array<{
        index: number;
        byteCount: number;
    }>;
};
export declare function persistStream(stream: Readable, outputPath: string): Promise<PersistedStream>;
