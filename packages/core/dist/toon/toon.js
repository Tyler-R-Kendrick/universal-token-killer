export function schemaToToon(schema) {
    return `schema${JSON.stringify(schema)}`;
}
export function routeToToon(schemaId, confidence, reason) {
    return `route{schema:"${schemaId}",confidence:${confidence.toFixed(2)},reason:${reason}}`;
}
