import { gen, grm, nonEmptyChoices, select } from '@utk/grammar-dsl';

export function buildSketchOfThoughtLexiconGrammar(domain: string, lexicon: string[]) {
  const lexiconChoices = nonEmptyChoices(lexicon.map((item) => item.trim()), 'general');
  return grm`sketch{domain:"${select(domain)}",move:"${select('observe', 'classify', 'compare', 'decide', 'verify')}",term:"${select(...lexiconChoices)}",claim:"${gen('claim', /[A-Za-z0-9 ._:/-]{1,160}/)}"}`;
}
