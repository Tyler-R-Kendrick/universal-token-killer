export function assertNoRawLeakage(text: string): boolean {
  if (!text.includes('output.raw')) return true;
  return /^Tool result stored at: [^\r\n]+[/\\]output\.raw\.(?:json|txt|bin)$/.test(text.trim());
}
