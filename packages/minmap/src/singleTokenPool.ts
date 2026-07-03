/**
 * Committed pool of min-map identifiers.
 *
 * Ids are ordered by allocation preference: bare lowercase letters first,
 * then letter+digit pairs. Every id is heuristically a single token in the
 * common BPE vocabularies (cl100k/o200k families tokenize 1–2 character
 * ASCII identifiers as one token); savings are verified by measurement in
 * `@utk/evals`, never assumed from id length. The pool intentionally avoids
 * uppercase ids and ids longer than two characters so the worst case stays
 * cheap across tokenizers.
 */
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

function buildPool(): readonly string[] {
  const pool: string[] = [];
  for (const letter of LETTERS) {
    pool.push(letter);
  }
  for (const letter of LETTERS) {
    for (let digit = 0; digit <= 9; digit += 1) {
      pool.push(`${letter}${digit}`);
    }
  }
  return pool;
}

export const SINGLE_TOKEN_POOL: readonly string[] = buildPool();
