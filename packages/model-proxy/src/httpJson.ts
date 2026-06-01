import type { IncomingMessage, ServerResponse } from 'node:http';
import { isObject, type JsonObject } from './openai.js';

export function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(value));
}

export async function readJsonObjectBody(req: IncomingMessage): Promise<JsonObject> {
  const text = await readBody(req);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new BadRequestBodyError('Request body must be valid JSON');
  }
  if (!isObject(parsed)) throw new BadRequestBodyError('Request body must be a JSON object');
  return parsed;
}

export function isPayloadTooLargeError(error: unknown): boolean {
  return error instanceof PayloadTooLargeError || error instanceof Error && error.name === 'PayloadTooLargeError';
}

export function isBadRequestBodyError(error: unknown): error is BadRequestBodyError {
  return error instanceof BadRequestBodyError || error instanceof Error && error.name === 'BadRequestBodyError';
}

function readBody(req: IncomingMessage, maxBytes = 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    const cleanup = (): void => {
      req.off('data', onData);
      req.off('error', onError);
      req.off('end', onEnd);
      req.off('close', onClose);
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      req.resume();
      reject(error);
    };
    const onData = (chunk: Buffer | string): void => {
      const buffer = Buffer.from(chunk);
      total += buffer.byteLength;
      if (total > maxBytes) {
        fail(new PayloadTooLargeError(maxBytes));
        return;
      }
      chunks.push(buffer);
    };
    const onError = (error: Error): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onEnd = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks).toString('utf8'));
    };
    const onClose = (): void => {
      if (!req.complete) fail(new ClientClosedRequestError());
    };
    req.on('data', onData);
    req.on('error', onError);
    req.on('end', onEnd);
    req.on('close', onClose);
  });
}

class PayloadTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Request body exceeds ${maxBytes} bytes`);
    this.name = 'PayloadTooLargeError';
  }
}

export class ClientClosedRequestError extends Error {
  constructor() {
    super('Request closed before body completed');
    this.name = 'ClientClosedRequestError';
  }
}

class BadRequestBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestBodyError';
  }
}
