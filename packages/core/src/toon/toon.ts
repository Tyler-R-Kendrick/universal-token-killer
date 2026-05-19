export function schemaToToon(schema: Record<string, unknown>): string {
  return `schema${JSON.stringify(schema)}`;
}

export function routeToToon(schemaId: string, confidence: number, reason: string): string {
  return `route{schema:"${schemaId}",confidence:${confidence.toFixed(2)},reason:${reason}}`;
}
