import { gen, grm, select } from 'guidance-ts';

export function buildSketchOfThoughtLexiconGrammar(domain: string, lexicon: string[]) {
  const lexiconChoices = nonEmptyChoices(lexicon.map((item) => item.trim()).filter(Boolean));
  return grm`sketch{domain:"${select(domain)}",move:"${select('observe', 'classify', 'compare', 'decide', 'verify')}",term:"${select(...lexiconChoices)}",claim:"${gen('claim', /[A-Za-z0-9 ._:/-]{1,160}/)}"}`;
}

function nonEmptyChoices(values: string[]): [string, ...string[]] {
  const unique = [...new Set(values)];
  return unique.length === 0 ? ['general'] : (unique as [string, ...string[]]);
}
