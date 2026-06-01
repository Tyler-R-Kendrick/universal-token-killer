import { normalizeText, uniqueNormalizedLines } from './sessionSkillText.js';
import type { SessionSkillCandidate, SessionSkillProfile } from './sessionSkillTypes.js';

export function discoverSessionSkillCandidates(params: {
  messages: string[];
  profiles: SessionSkillProfile[];
  minTriggerHits?: number;
}): SessionSkillCandidate[] {
  const text = normalizeText(params.messages.join('\n'));
  const minTriggerHits = params.minTriggerHits ?? 2;
  return params.profiles
    .map((profile) => {
      const triggerHits = countProfileTriggerHits(text, profile.triggers);
      return {
        ...profile,
        triggerHits,
        expectedReuse: `${triggerHits} trigger hits across recent chat; generate a reusable session skill to reduce repeated prompt tokens.`
      };
    })
    .filter((candidate) => candidate.triggerHits >= minTriggerHits)
    .sort((left, right) => right.triggerHits - left.triggerHits || left.name.localeCompare(right.name));
}

function countProfileTriggerHits(text: string, triggers: string[]): number {
  const needles = uniqueNormalizedLines(triggers)
    .map(normalizeText)
    .filter(Boolean)
    .sort((left, right) => right.length - left.length || left.localeCompare(right));
  const claimed: Array<{ start: number; end: number }> = [];
  let count = 0;
  for (const needle of needles) {
    let index = 0;
    while (index < text.length) {
      const found = text.indexOf(needle, index);
      if (found === -1) break;
      const end = found + needle.length;
      if (!isWordChar(text[found - 1]) && !isWordChar(text[end]) && !claimed.some((range) => found < range.end && end > range.start)) {
        claimed.push({ start: found, end });
        count += 1;
      }
      index = end;
    }
  }
  return count;
}

function isWordChar(value: string | undefined): boolean {
  return Boolean(value && /[a-z0-9]/i.test(value));
}
