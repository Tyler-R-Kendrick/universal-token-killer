const { TRON } = require('@tron-format/tron');

function registerUtkSerializerPlugin(registry, context) {
  registry.register({
    id: context.manifest.id,
    extension: context.manifest.extension,
    grammar: context.grammar,
    serialize(value) {
      return TRON.stringify(toJsonValue(value));
    },
    deserialize(text) {
      return context.parser.parse(text, (candidate) => TRON.parse(candidate));
    },
    validate(value, text) {
      try {
        const expected = TRON.stringify(toJsonValue(value));
        const decoded = context.parser.parse(text, (candidate) => TRON.parse(candidate));
        if (canonicalJson(decoded) === canonicalJson(toJsonValue(value))) {
          return { valid: true, errors: [] };
        }
        return { valid: false, errors: ['TRON artifact drifted from canonical value'], regenerated: expected };
      } catch (error) {
        return { valid: false, errors: [String(error)] };
      }
    },
    estimateTokens
  });
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function toJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalJson(value) {
  return `${JSON.stringify(sortValue(value))}\n`;
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}

module.exports = { registerUtkSerializerPlugin };
