export type SessionSkillProfile = {
  name: string;
  description: string;
  purpose: string;
  triggers: string[];
  procedure: string[];
  references?: Record<string, string>;
  requiredSkills?: string[];
  whenNotToUse?: string[];
  commonMistakes?: string[];
  evalScenarios?: string[];
};

export type SessionSkillCandidate = SessionSkillProfile & {
  expectedReuse: string;
  triggerHits: number;
};

export type SessionSkillResult = {
  name: string;
  skillRoot: string;
  skillPath: string;
  referencePaths: string[];
};
