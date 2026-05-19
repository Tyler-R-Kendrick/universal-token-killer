export function assertNoRawLeakage(text: string): boolean {
  return !text.includes('output.raw') || text.includes('Tool result stored at:');
}
