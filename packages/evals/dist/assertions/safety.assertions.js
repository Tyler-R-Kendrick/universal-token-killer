export function assertNoRawLeakage(text) {
    return !text.includes('output.raw') || text.includes('Tool result stored at:');
}
