export function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
export function assertMaxPromptTokens(prompt, maxTokens = 700) {
    return estimateTokens(prompt) <= maxTokens;
}
export function assertMaxOutputTokens(output, maxTokens = 32) {
    return estimateTokens(output) <= maxTokens;
}
export function assertCompactResponse(response, maxChars = 400) {
    return response.length <= maxChars;
}
