import type { SessionAgentCandidate, SessionAgentProfile } from './sessionAgentTypes.js';

export function discoverSessionAgentCandidates(params: {
  messages: string[];
  profiles: SessionAgentProfile[];
  minTriggerHits?: number;
}): SessionAgentCandidate[] {
  const text = normalizeText(params.messages.join('\n'));
  const minTriggerHits = params.minTriggerHits ?? 2;
  return params.profiles
    .map((profile) => {
      const triggerHits = profile.triggers.filter((trigger) => text.includes(normalizeText(trigger))).length;
      return {
        ...profile,
        triggerHits,
        expectedReuse: `${triggerHits} trigger hits across recent chat; generate a reusable session subagent.`
      };
    })
    .filter((candidate) => candidate.triggerHits >= minTriggerHits)
    .sort((left, right) => right.triggerHits - left.triggerHits || left.name.localeCompare(right.name));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}
