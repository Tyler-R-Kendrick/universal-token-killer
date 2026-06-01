export type ContentRoute = {
  routeReason: string;
  kind: string;
  serializerId: 'toon' | 'json-compact';
  compactText: string;
  protectedPreview: string;
  rawTokens: number;
  compactTokens: number;
};
