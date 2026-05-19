import { encode } from '@toon-format/toon';

export function schemaToToon(schema: Record<string, unknown>): string {
  return encode({ schema });
}

export function routeToToon(schemaId: string, confidence: number, reason: string): string {
  return encode({ route: { schema: schemaId, confidence: Number(confidence.toFixed(2)), reason } });
}
