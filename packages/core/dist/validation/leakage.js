export function assertNoRawLeakage(visible, raw) {
    if (Buffer.isBuffer(raw)) {
        return;
    }
    const rawText = raw.trim();
    if (rawText.length > 0 && visible.includes(rawText)) {
        throw new Error('Raw output leakage detected');
    }
}
export function containsForbiddenSpecialCase(text) {
    return /\b(npm|pip|docker|kubectl|terraform|aws|gcp|azure|cli|command-specific|use-case-specific)\b/i.test(text);
}
