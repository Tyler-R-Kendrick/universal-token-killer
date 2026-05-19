export function assertNoRawLeakage(text: string): boolean {
  if (!text.includes('output.raw')) return true;
  const pathReference = String.raw`Tool result stored at: [^\r\n]+[/\\]output\.raw\.(?:json|txt|bin)`;
  const compactResponse = String.raw`${pathReference}\r?\nSchema: [^\r\n]+\r?\nRoute confidence: \d+(?:\.\d+)?\r?\nFull payload was written to disk and omitted from chat context\.`;
  return new RegExp(`^(?:${pathReference}|${compactResponse})$`).test(text.trim());
}
