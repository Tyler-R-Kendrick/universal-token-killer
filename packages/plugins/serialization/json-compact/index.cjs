function registerUtkSerializerPlugin(registry, context) {
  registry.register({
    id: context.manifest.id,
    aliases: context.manifest.aliases,
    extension: context.manifest.extension,
    grammar: context.grammar,
    serialize(value) {
      return JSON.stringify(sortValue(value));
    },
    deserialize(text) {
      return context.parser.parse(text, (candidate) => JSON.parse(candidate));
    },
    validate(value, text) {
      let expected;
      try {
        expected = JSON.stringify(sortValue(value));
      } catch {
        return { valid: false, errors: ['json-compact artifact drifted from canonical value'] };
      }
      if (text === expected) {
        return { valid: true, errors: [] };
      }
      return { valid: false, errors: ['json-compact artifact drifted from canonical value'], regenerated: expected };
    },
    estimateTokens
  });
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}

module.exports = { registerUtkSerializerPlugin };
