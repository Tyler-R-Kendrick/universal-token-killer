export function buildCompactResponse(rawPath, schemaId, confidence) {
    const response = [
        `Tool result stored at: ${rawPath}`,
        `Schema: ${schemaId}`,
        `Route confidence: ${confidence.toFixed(2)}`,
        'Full payload was written to disk and omitted from chat context.'
    ].join('\n');
    return response.length > 400 ? `${response.slice(0, 397)}...` : response;
}
