export function buildCompactResponse(rawPath: string, schemaId: string, confidence: number, serializerId?: string, serializedPath?: string): string {
  const response = [
    `Tool result stored at: ${rawPath}`,
    `Schema: ${schemaId}`,
    serializerId ? `Serializer: ${serializerId}` : undefined,
    serializedPath ? `Compact artifact: ${serializedPath}` : undefined,
    `Route confidence: ${confidence.toFixed(2)}`,
    'Full payload was written to disk and omitted from chat context.'
  ].filter((line): line is string => Boolean(line)).join('\n');

  return response.length > 400 ? `${response.slice(0, 397)}...` : response;
}
